const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const AuditLog = require("../models/AuditLog");
const Announcement = require("../models/Announcement");
const Notification = require("../models/Notification");
const VolunteerAssignment = require("../models/VolunteerAssignment");
const { getCache, setCache } = require("../services/cache");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const toCSV = (rows, headers) => {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const head = headers.join(",");
  const body = rows.map((row) => headers.map((key) => escape(row[key])).join(",")).join("\n");
  return `${head}\n${body}`;
};

const getDateWindow = (range = "90") => {
  const days = Math.max(Number(range) || 90, 7);
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start, days };
};

router.get("/dashboard", protect, adminOnly, async (req, res) => {
  try {
    const cacheKey = "admin:dashboard:summary";
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);
    const [totalUsers, totalEvents, totalRegistrations, upcomingEvents, liveEvents, archivedEvents, waitlistedRegistrations] = await Promise.all([
      User.countDocuments(),
      Event.countDocuments({ isArchived: { $ne: true } }),
      Registration.countDocuments(),
      Event.countDocuments({ status: { $in: ["upcoming", "published"] }, isArchived: { $ne: true } }),
      Event.countDocuments({ status: "live", isArchived: { $ne: true } }),
      Event.countDocuments({ isArchived: true }),
      Registration.countDocuments({ status: "waitlisted" }),
    ]);

    const byCategory = await Event.aggregate([
      { $match: { isArchived: { $ne: true } } },
      { $group: { _id: { $ifNull: ["$category", "General"] }, value: { $sum: 1 } } },
      { $sort: { value: -1 } },
      { $limit: 8 },
    ]);

    const byStatus = await Registration.aggregate([
      { $group: { _id: "$status", value: { $sum: 1 } } },
      { $sort: { value: -1 } },
    ]);

    const roleBreakdown = await User.aggregate([
      { $group: { _id: "$role", value: { $sum: 1 } } },
      { $sort: { value: -1 } },
    ]);

    const monthlyEvents = await Event.aggregate([
      { $match: { isArchived: { $ne: true } } },
      { $group: { _id: { month: { $month: "$date" } }, value: { $sum: 1 } } },
      { $sort: { "_id.month": 1 } },
    ]);

    const monthlyRegistrations = await Registration.aggregate([
      { $group: { _id: { month: { $month: "$createdAt" } }, value: { $sum: 1 } } },
      { $sort: { "_id.month": 1 } },
    ]);

    const payload = { totalUsers, totalEvents, totalRegistrations, upcomingEvents, liveEvents, archivedEvents, waitlistedRegistrations, byCategory, byStatus, roleBreakdown, monthlyEvents, monthlyRegistrations };
    setCache(cacheKey, payload, 60 * 1000);
    res.json(payload);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/analytics", protect, adminOnly, async (req, res) => {
  try {
    const { start, days } = getDateWindow(req.query.range);
    const cacheKey = `admin:analytics:${days}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);
    const [events, registrations, users, logs, volunteerAssignments] = await Promise.all([
      Event.find({ isArchived: { $ne: true } }).select("title category status date views capacity featured").sort({ views: -1 }).limit(20),
      Registration.find({ createdAt: { $gte: start } }).populate("event", "title category status date").populate("user", "name role department year").sort({ createdAt: -1 }).limit(40),
      User.find().select("name role department year interests skills createdAt").sort({ createdAt: -1 }).limit(40),
      AuditLog.find().populate("actor", "name email role").sort({ createdAt: -1 }).limit(30),
      require("../models/VolunteerAssignment").find({ createdAt: { $gte: start } }).populate("event", "title category date status").populate("volunteer", "name department year").sort({ createdAt: -1 }).limit(40),
    ]);

    const topEvents = await Registration.aggregate([
      { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: start } } },
      { $group: { _id: "$event", registrations: { $sum: 1 }, checkedIn: { $sum: { $cond: ["$checkedIn", 1, 0] } } } },
      { $sort: { registrations: -1 } },
      { $limit: 8 },
    ]);

    const eventIds = topEvents.map((item) => item._id).filter(Boolean);
    const eventDocs = await Event.find({ _id: { $in: eventIds } }).select("title category venue date status capacity views");
    const topEventsDetailed = topEvents.map((item) => ({
      event: eventDocs.find((doc) => String(doc._id) === String(item._id)) || null,
      registrations: item.registrations,
      checkedIn: item.checkedIn,
    }));

    const roleBreakdown = await User.aggregate([{ $group: { _id: "$role", value: { $sum: 1 } } }, { $sort: { value: -1 } }]);
    const categoryBreakdown = await Event.aggregate([{ $match: { isArchived: { $ne: true } } }, { $group: { _id: "$category", value: { $sum: 1 } } }, { $sort: { value: -1 } }, { $limit: 10 }]);
    const registrationsOverTime = await Registration.aggregate([
      { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: start } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          registrations: { $sum: 1 },
          checkedIn: { $sum: { $cond: ["$checkedIn", 1, 0] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    const participationByDepartmentYear = await Registration.aggregate([
      { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: start } } },
      { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      {
        $group: {
          _id: { department: { $ifNull: ["$user.department", "Unknown"] }, year: { $ifNull: ["$user.year", "Unknown"] } },
          registrations: { $sum: 1 },
          checkedIn: { $sum: { $cond: ["$checkedIn", 1, 0] } },
        },
      },
      { $sort: { registrations: -1 } },
      { $limit: 20 },
    ]);

    const attendanceVsRegistration = topEventsDetailed.map((item) => ({
      title: item.event?.title || "Event",
      registrations: item.registrations,
      checkedIn: item.checkedIn,
      attendanceRate: item.registrations ? Math.round((item.checkedIn / item.registrations) * 100) : 0,
    }));

    const registrationsByDepartment = await Registration.aggregate([
      { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: start } } },
      { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $group: { _id: { $ifNull: ["$user.department", "Unknown"] }, registrations: { $sum: 1 }, checkedIn: { $sum: { $cond: ["$checkedIn", 1, 0] } } } },
      { $sort: { registrations: -1 } },
      { $limit: 12 },
    ]);

    const registrationsByYear = await Registration.aggregate([
      { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: start } } },
      { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $group: { _id: { $ifNull: ["$user.year", "Unknown"] }, registrations: { $sum: 1 }, checkedIn: { $sum: { $cond: ["$checkedIn", 1, 0] } } } },
      { $sort: { registrations: -1 } },
      { $limit: 12 },
    ]);

    const eventCapacityUtilization = topEventsDetailed.map((item) => ({
      title: item.event?.title || "Event",
      capacity: Number(item.event?.capacity || 0),
      registrations: item.registrations,
      utilization: item.event?.capacity ? Math.round((item.registrations / item.event.capacity) * 100) : 0,
    }));

    const volunteerLoad = await require("../models/VolunteerAssignment").aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: "$status", value: { $sum: 1 } } },
    ]);

    const payload = { topEvents: topEventsDetailed, roleBreakdown, categoryBreakdown, registrationsOverTime, participationByDepartmentYear, attendanceVsRegistration, registrationsByDepartment, registrationsByYear, eventCapacityUtilization, volunteerLoad, days, events, registrations, users, logs, volunteerAssignments };
    setCache(cacheKey, payload, 90 * 1000);
    res.json(payload);
  } catch (error) {
    console.log("ANALYTICS ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/reports", protect, adminOnly, async (req, res) => {
  try {
    const cached = getCache("admin:reports");
    if (cached) return res.json(cached);
    const topEvents = await Registration.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $group: { _id: "$event", registrations: { $sum: 1 }, checkedIn: { $sum: { $cond: ["$checkedIn", 1, 0] } } } },
      { $sort: { registrations: -1 } },
      { $limit: 8 },
    ]);

    const byDepartment = await User.aggregate([
      { $group: { _id: { $ifNull: ["$department", "Unknown"] }, users: { $sum: 1 } } },
      { $sort: { users: -1 } },
      { $limit: 8 },
    ]);

    const eventIds = topEvents.map((item) => item._id).filter(Boolean);
    const eventDocs = await Event.find({ _id: { $in: eventIds } }).select("title category venue date status capacity views");
    const topEventsDetailed = topEvents.map((item) => ({
      event: eventDocs.find((doc) => String(doc._id) === String(item._id)) || null,
      registrations: item.registrations,
      checkedIn: item.checkedIn,
    }));

    const payload = { topEvents: topEventsDetailed, byDepartment };
    setCache("admin:reports", payload, 120 * 1000);
    res.json(payload);
  } catch (error) {
    console.log("REPORTS ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/users", protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select("name email role department year interests skills badges createdAt").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.log("USERS ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/users/:id/role", protect, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    const allowed = ["student", "admin", "coordinator", "super_admin", "volunteer"];
    if (!allowed.includes(role)) return res.status(400).json({ message: "Invalid role" });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.role = role;
    if (role === "coordinator" && !user.badges.includes("Coordinator")) user.badges.push("Coordinator");
    if (role === "volunteer" && !user.badges.includes("Volunteer")) user.badges.push("Volunteer");
    await user.save();

    await AuditLog.create({ actor: req.user._id, actorName: req.user.name, action: "user.role.update", entityType: "User", entityId: String(user._id), title: user.name, metadata: { role } });
    res.json({ message: "Role updated", user: { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department, year: user.year } });
  } catch (error) {
    console.log("ROLE UPDATE ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/logs", protect, adminOnly, async (req, res) => {
  try {
    const logs = await AuditLog.find().populate("actor", "name email role").sort({ createdAt: -1 }).limit(60);
    res.json(logs);
  } catch (error) {
    console.log("LOGS ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/reports/export", protect, adminOnly, async (req, res) => {
  try {
    const { start, days } = getDateWindow(req.query.range);
    const format = String(req.query.format || "csv").toLowerCase();

    const [topEvents, byDepartment, participationByDepartmentYear, attendanceVsRegistration] = await Promise.all([
      Registration.aggregate([
        { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: start } } },
        { $group: { _id: "$event", registrations: { $sum: 1 }, checkedIn: { $sum: { $cond: ["$checkedIn", 1, 0] } } } },
        { $sort: { registrations: -1 } },
        { $limit: 8 },
      ]),
      User.aggregate([
        { $group: { _id: { $ifNull: ["$department", "Unknown"] }, users: { $sum: 1 } } },
        { $sort: { users: -1 } },
        { $limit: 8 },
      ]),
      Registration.aggregate([
        { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: start } } },
        { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
        {
          $group: {
            _id: { department: { $ifNull: ["$user.department", "Unknown"] }, year: { $ifNull: ["$user.year", "Unknown"] } },
            registrations: { $sum: 1 },
            checkedIn: { $sum: { $cond: ["$checkedIn", 1, 0] } },
          },
        },
        { $sort: { registrations: -1 } },
        { $limit: 20 },
      ]),
      Registration.aggregate([
        { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: start } } },
        { $group: { _id: "$event", registrations: { $sum: 1 }, checkedIn: { $sum: { $cond: ["$checkedIn", 1, 0] } } } },
        { $sort: { registrations: -1 } },
        { $limit: 8 },
      ]),
    ]);

    const eventIds = topEvents.map((item) => item._id).filter(Boolean);
    const eventDocs = await Event.find({ _id: { $in: eventIds } }).select("title category venue date status capacity views");
    const topEventsDetailed = topEvents.map((item) => {
      const event = eventDocs.find((doc) => String(doc._id) === String(item._id)) || null;
      return {
        title: event?.title || "Event",
        category: event?.category || "General",
        venue: event?.venue || "",
        date: event?.date ? new Date(event.date).toISOString() : "",
        capacity: Number(event?.capacity || 0),
        registrations: item.registrations,
        checkedIn: item.checkedIn,
        attendanceRate: item.registrations ? Math.round((item.checkedIn / item.registrations) * 100) : 0,
      };
    });

    const eventDocsById = Object.fromEntries(eventDocs.map((doc) => [String(doc._id), doc]));
    const attendanceByEvent = attendanceVsRegistration.map((row) => {
      const event = eventDocsById[String(row._id)] || null;
      return {
        title: event?.title || "Event",
        category: event?.category || "General",
        registrations: row.registrations,
        checkedIn: row.checkedIn,
        attendanceRate: row.registrations ? Math.round((row.checkedIn / row.registrations) * 100) : 0,
      };
    });

    const rows = [
      ...topEventsDetailed.map((row) => ({ section: "top_events", label: row.title, category: row.category, venue: row.venue, registrations: row.registrations, checkedIn: row.checkedIn, attendanceRate: row.attendanceRate, value: "" })),
      ...byDepartment.map((row) => ({ section: "users_by_department", label: row._id, value: row.users, registrations: "", checkedIn: "", attendanceRate: "", category: "", venue: "" })),
      ...participationByDepartmentYear.map((row) => ({ section: "participation_by_department_year", label: `${row._id?.department || "Unknown"} / ${row._id?.year || "Unknown"}`, registrations: row.registrations, checkedIn: row.checkedIn, attendanceRate: row.registrations ? Math.round((row.checkedIn / row.registrations) * 100) : 0, value: "", category: "", venue: "" })),
      ...attendanceByEvent.map((row) => ({ section: "attendance_vs_registration", label: row.title, category: row.category, registrations: row.registrations, checkedIn: row.checkedIn, attendanceRate: row.attendanceRate, value: "", venue: "" })),
    ];

    const payload = { range: days, topEvents: topEventsDetailed, byDepartment, participationByDepartmentYear, attendanceVsRegistration: attendanceByEvent };

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      return res.json(payload);
    }

    const csv = toCSV(rows, ["section", "label", "category", "venue", "registrations", "checkedIn", "attendanceRate", "value"]);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="campusconnect-reports-${days}d.csv"`);
    return res.send(csv);
  } catch (error) {
    console.log("REPORT EXPORT ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/export/:type", protect, adminOnly, async (req, res) => {
  try {
    const { type } = req.params;
    let rows = [];
    let headers = [];
    let filename = `${type}.csv`;

    if (type === "events") {
      headers = ["title", "category", "status", "venue", "date", "featured", "views"];
      rows = await Event.find({ isArchived: { $ne: true } }).select(headers.join(" ")).sort({ createdAt: -1 }).lean();
      filename = "events.csv";
    } else if (type === "registrations") {
      headers = ["student", "event", "status", "checkedIn", "waitlistPosition", "createdAt"];
      rows = await Registration.find().populate("user", "name").populate("event", "title").sort({ createdAt: -1 }).lean();
      rows = rows.map((row) => ({
        student: row.user?.name || "",
        event: row.event?.title || "",
        status: row.status,
        checkedIn: row.checkedIn,
        waitlistPosition: row.waitlistPosition || 0,
        createdAt: row.createdAt,
      }));
      filename = "registrations.csv";
    } else if (type === "users") {
      headers = ["name", "email", "role", "department", "year", "createdAt"];
      rows = await User.find().select(headers.join(" ")).sort({ createdAt: -1 }).lean();
      filename = "users.csv";
    } else if (type === "feedback") {
      const Feedback = require("../models/EventFeedback");
      headers = ["student", "event", "rating", "comment", "createdAt"];
      rows = await Feedback.find().populate("user", "name").populate("event", "title").sort({ createdAt: -1 }).lean();
      rows = rows.map((row) => ({
        student: row.user?.name || "",
        event: row.event?.title || "",
        rating: row.rating,
        comment: row.comment || "",
        createdAt: row.createdAt,
      }));
      filename = "feedback.csv";
    } else if (type === "logs") {
      headers = ["actorName", "action", "entityType", "entityId", "title", "createdAt"];
      rows = await AuditLog.find().sort({ createdAt: -1 }).lean();
      filename = "logs.csv";
    } else if (type === "announcements") {
      headers = ["title", "message", "audience", "isPinned", "createdAt"];
      rows = await Announcement.find().sort({ createdAt: -1 }).lean();
      filename = "announcements.csv";
    } else if (type === "notifications") {
      headers = ["user", "type", "title", "message", "isRead", "createdAt"];
      rows = await Notification.find().populate("user", "name email").sort({ createdAt: -1 }).lean();
      rows = rows.map((row) => ({
        user: row.user?.name || row.user?.email || "",
        type: row.type,
        title: row.title,
        message: row.message,
        isRead: row.isRead,
        createdAt: row.createdAt,
      }));
      filename = "notifications.csv";
    } else if (type === "volunteers") {
      headers = ["event", "volunteer", "task", "status", "completionStatus", "createdAt"];
      rows = await VolunteerAssignment.find().populate("event", "title").populate("volunteer", "name email").sort({ createdAt: -1 }).lean();
      rows = rows.map((row) => ({
        event: row.event?.title || "",
        volunteer: row.volunteer?.name || row.volunteer?.email || "",
        task: row.taskTitle || "",
        status: row.status || "",
        completionStatus: row.status === "completed" ? "completed" : row.status === "in_progress" ? "in_progress" : "assigned",
        createdAt: row.createdAt,
      }));
      filename = "volunteers.csv";
    } else {
      return res.status(400).json({ message: "Unsupported export type" });
    }

    const csv = toCSV(rows, headers);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    res.send(csv);
  } catch (error) {
    console.log("EXPORT ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});


const parseDelimitedRows = (content = "") => {
  const lines = String(content).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((item) => item.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    return row;
  });
};

router.post("/import/:type", protect, adminOnly, async (req, res) => {
  try {
    const { type } = req.params;
    const rows = parseDelimitedRows(req.body?.content || "");
    if (!rows.length) return res.status(400).json({ message: "No rows found in import" });

    if (type === "events") {
      const created = [];
      for (const row of rows) {
        if (!row.title || !row.description || !row.date || !row.venue) continue;
        const event = await Event.create({
          title: row.title,
          description: row.description,
          date: new Date(row.date),
          venue: row.venue,
          category: row.category || "General",
          subcategory: row.subcategory || "",
          mode: ["online", "hybrid"].includes(String(row.mode || "").toLowerCase()) ? String(row.mode).toLowerCase() : "offline",
          status: ["draft", "published", "upcoming", "live", "completed", "cancelled"].includes(String(row.status || "").toLowerCase()) ? String(row.status).toLowerCase() : "upcoming",
          featured: String(row.featured || "").toLowerCase() === "true",
          approvalRequired: String(row.approvalRequired || "").toLowerCase() === "true",
          capacity: row.capacity ? Number(row.capacity) : null,
          waitlistCapacity: row.waitlistCapacity ? Number(row.waitlistCapacity) : 0,
          organizerName: row.organizerName || "",
          speakerName: row.speakerName || "",
          speakerRole: row.speakerRole || "",
          schedule: row.schedule || "",
          rules: row.rules || "",
          certificateEnabled: row.certificateEnabled ? String(row.certificateEnabled).toLowerCase() !== "false" : true,
          tags: String(row.tags || "").split("|").map((item) => item.trim()).filter(Boolean),
          attachments: String(row.attachments || "").split("|").map((item) => item.trim()).filter(Boolean),
          imageUrl: row.imageUrl || "",
          locationUrl: row.locationUrl || "",
          createdBy: req.user._id,
        });
        created.push(event);
      }
      return res.status(201).json({ message: "Events imported", created: created.length });
    }

    if (type === "users") {
      const bcrypt = require("bcryptjs");
      const allowed = ["student", "admin", "coordinator", "super_admin", "volunteer"];
      let created = 0;
      for (const row of rows) {
        if (!row.name || !row.email || !row.password) continue;
        const exists = await User.findOne({ email: String(row.email).trim().toLowerCase() });
        if (exists) continue;
        const hashed = await bcrypt.hash(String(row.password), 10);
        await User.create({
          name: row.name,
          email: String(row.email).trim().toLowerCase(),
          password: hashed,
          role: allowed.includes(String(row.role || "student").toLowerCase()) ? String(row.role).toLowerCase() : "student",
          department: row.department || "",
          year: row.year || "",
          phone: row.phone || "",
          interests: String(row.interests || "").split("|").map((item) => item.trim()).filter(Boolean),
          skills: String(row.skills || "").split("|").map((item) => item.trim()).filter(Boolean),
        });
        created += 1;
      }
      return res.status(201).json({ message: "Users imported", created });
    }

    return res.status(400).json({ message: "Unsupported import type" });
  } catch (error) {
    console.log("IMPORT ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/announcements", protect, adminOnly, async (req, res) => {
  try {
    const announcements = await Announcement.find().populate("createdBy", "name role").sort({ createdAt: -1 }).limit(30);
    res.json(announcements);
  } catch (error) {
    console.log("ADMIN ANNOUNCEMENTS ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
