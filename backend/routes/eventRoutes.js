const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const Event = require("../models/Event");
const AuditLog = require("../models/AuditLog");
const Registration = require("../models/Registration");
const EventFeedback = require("../models/EventFeedback");
const User = require("../models/User");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { canManageEvent, coordinatorOrAdmin } = require("../middleware/roleMiddleware");
const { clearCache } = require("../services/cache");

const normalizeTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean);
  return String(tags).split(",").map((tag) => tag.trim()).filter(Boolean);
};

const normalizeList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
};

const normalizeStatus = (status) => {
  const allowed = ["draft", "published", "upcoming", "live", "completed", "cancelled"];
  if (!status) return "upcoming";
  const clean = String(status).trim().toLowerCase();
  return allowed.includes(clean) ? clean : "upcoming";
};

const parseNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return false;
};

const getOptionalUser = async (req) => {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return null;
    const token = header.split(" ")[1];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return await User.findById(decoded.id).select("-password");
  } catch (error) {
    return null;
  }
};

const buildEventPayload = (body, req) => ({
  title: body.title?.trim(),
  description: body.description?.trim(),
  date: body.date ? new Date(body.date) : null,
  endDate: body.endDate ? new Date(body.endDate) : null,
  venue: body.venue?.trim(),
  category: body.category?.trim() || "General",
  subcategory: body.subcategory?.trim() || "",
  mode: ["online", "hybrid"].includes(String(body.mode || "").toLowerCase()) ? String(body.mode).toLowerCase() : "offline",
  status: normalizeStatus(body.status),
  featured: parseBoolean(body.featured),
  approvalRequired: parseBoolean(body.approvalRequired),
  capacity: parseNumber(body.capacity),
  waitlistCapacity: parseNumber(body.waitlistCapacity) || 0,
  organizerName: body.organizerName?.trim() || "",
  speakerName: body.speakerName?.trim() || "",
  speakerRole: body.speakerRole?.trim() || "",
  schedule: body.schedule?.trim() || "",
  rules: body.rules?.trim() || "",
  certificateEnabled: body.certificateEnabled === undefined ? true : parseBoolean(body.certificateEnabled),
  tags: normalizeTags(body.tags),
  attachments: normalizeList(body.attachments),
  imageUrl: body.imageUrl?.trim() || "",
  posterUrl: body.posterUrl?.trim() || body.imageUrl?.trim() || "",
  certificateTemplateUrl: body.certificateTemplateUrl?.trim() || "",
  locationUrl: body.locationUrl?.trim() || "",
  createdBy: req.user._id,
});

const buildQuery = (query, currentUser) => {
  const criteria = { isArchived: { $ne: true } };
  const {
    search = "",
    status = "",
    category = "",
    subcategory = "",
    mode = "",
    featured = "",
    tag = "",
    venue = "",
    dateFrom = "",
    dateTo = "",
    minCapacity = "",
    maxCapacity = "",
    sort = "",
    page = "",
    limit = "",
  } = query;

  if (!currentUser || !["admin", "super_admin"].includes(currentUser.role)) {
    criteria.status = { $ne: "draft" };
  }

  if (status) criteria.status = String(status).toLowerCase();
  if (category) criteria.category = String(category);
  if (subcategory) criteria.subcategory = String(subcategory);
  if (mode) criteria.mode = String(mode).toLowerCase();
  if (featured === "true") criteria.featured = true;
  if (featured === "false") criteria.featured = false;
  if (tag) criteria.tags = { $in: [String(tag).trim()] };
  if (venue) criteria.venue = { $regex: String(venue).trim(), $options: "i" };
  if (dateFrom || dateTo) {
    criteria.date = {};
    if (dateFrom) criteria.date.$gte = new Date(dateFrom);
    if (dateTo) criteria.date.$lte = new Date(dateTo);
  }
  if (minCapacity !== "" || maxCapacity !== "") {
    criteria.capacity = {};
    if (minCapacity !== "") criteria.capacity.$gte = Number(minCapacity);
    if (maxCapacity !== "") criteria.capacity.$lte = Number(maxCapacity);
  }

  if (search) {
    const safe = String(search).trim();
    criteria.$or = [
      { title: { $regex: safe, $options: "i" } },
      { description: { $regex: safe, $options: "i" } },
      { venue: { $regex: safe, $options: "i" } },
      { category: { $regex: safe, $options: "i" } },
      { subcategory: { $regex: safe, $options: "i" } },
      { tags: { $in: [safe] } },
    ];
  }

  let sortQuery = { createdAt: -1 };
  const sortValue = String(sort || "").toLowerCase();
  if (sortValue === "soonest") sortQuery = { date: 1 };
  if (sortValue === "latest") sortQuery = { date: -1 };
  if (sortValue === "popular") sortQuery = { views: -1, createdAt: -1 };
  if (sortValue === "capacity") sortQuery = { capacity: 1, createdAt: -1 };

  const pageNumber = Math.max(Number(page) || 1, 1);
  const limitNumber = Math.min(Math.max(Number(limit) || 0, 0), 100) || null;

  return { criteria, sortQuery, pageNumber, limitNumber };
};

const recordAudit = async ({ req, action, entityType, entityId = "", title = "", metadata = {} }) => {
  try {
    await AuditLog.create({
      actor: req.user?._id || null,
      actorName: req.user?.name || "System",
      action,
      entityType,
      entityId: String(entityId || ""),
      title,
      metadata,
    });
  } catch (error) {
    console.log("AUDIT LOG ERROR:", error.message);
  }
};

router.post("/", protect, coordinatorOrAdmin, async (req, res) => {
  try {
    const payload = buildEventPayload(req.body, req);
    if (!payload.title || !payload.description || !payload.date || !payload.venue) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (Number.isNaN(payload.date.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    if (!payload.posterUrl) payload.posterUrl = payload.imageUrl;
    const event = await Event.create(payload);
    await recordAudit({ req, action: "event.create", entityType: "Event", entityId: event._id, title: event.title, metadata: { category: event.category, status: event.status } });
    clearCache("admin:");
    emitToAdmins("dashboard:update", { type: "event", eventId: String(event._id), action: "create" });
    res.status(201).json({ message: "Event created successfully", event });
  } catch (error) {
    console.log("CREATE EVENT ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/stats/summary", async (req, res) => {
  try {
    const [totalEvents, featuredEvents, upcomingEvents, liveEvents, archivedEvents, draftEvents] = await Promise.all([
      Event.countDocuments({ isArchived: { $ne: true } }),
      Event.countDocuments({ isArchived: { $ne: true }, featured: true }),
      Event.countDocuments({ isArchived: { $ne: true }, status: "upcoming" }),
      Event.countDocuments({ isArchived: { $ne: true }, status: "live" }),
      Event.countDocuments({ isArchived: true }),
      Event.countDocuments({ isArchived: { $ne: true }, status: "draft" }),
    ]);
    res.json({ totalEvents, featuredEvents, upcomingEvents, liveEvents, archivedEvents, draftEvents });
  } catch (error) {
    console.log("EVENT STATS ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/recommendations", async (req, res) => {
  try {
    const currentUser = await getOptionalUser(req);
    const registrations = currentUser
      ? await Registration.find({ user: currentUser._id }).populate("event", "category subcategory tags organizerName speakerName speakerRole").select("event status checkedIn createdAt").sort({ createdAt: -1 }).lean()
      : [];
    const feedback = currentUser
      ? await EventFeedback.find({ user: currentUser._id }).select("event rating").lean()
      : [];

    const recentCategories = registrations.slice(0, 5).map((item) => String(item.event?.category || "").toLowerCase()).filter(Boolean);
    const interests = new Set([
      ...(currentUser?.interests || []).map((item) => String(item || "").toLowerCase()),
      ...(currentUser?.skills || []).map((item) => String(item || "").toLowerCase()),
      ...recentCategories,
    ]);

    const registeredEventIds = new Set(registrations.map((item) => String(item.event)));
    const ratedEventIds = new Set(feedback.map((item) => String(item.event)));

    const [events, popularity, departmentStats] = await Promise.all([
      Event.find({ isArchived: { $ne: true }, status: { $ne: "draft" } })
        .populate("createdBy", "name role")
        .sort({ views: -1, createdAt: -1 })
        .limit(120),
      Registration.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: "$event", registrations: { $sum: 1 }, checkedIn: { $sum: { $cond: ["$checkedIn", 1, 0] } } } },
      ]),
      currentUser?.department
        ? Registration.aggregate([
            { $match: { status: { $ne: "cancelled" } } },
            { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "user" } },
            { $unwind: "$user" },
            { $match: { "user.department": currentUser.department } },
            { $group: { _id: "$event", deptCount: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
    ]);

    const popularityMap = new Map(popularity.map((item) => [String(item._id), item]));
    const deptMap = new Map(departmentStats.map((item) => [String(item._id), item.deptCount || 0]));

    const scored = events
      .filter((event) => !registeredEventIds.has(String(event._id)) && !ratedEventIds.has(String(event._id)))
      .map((event) => {
        const eventTokens = [event.category, event.subcategory, ...(event.tags || []), event.organizerName, event.speakerName, event.speakerRole]
          .map((item) => String(item || "").toLowerCase())
          .filter(Boolean);
        const interestScore = eventTokens.reduce((score, token) => score + (interests.has(token) ? 3 : 0), 0);
        const featuredScore = event.featured ? 2 : 0;
        const liveScore = event.status === "live" ? 4 : event.status === "upcoming" ? 2 : 0;
        const pop = popularityMap.get(String(event._id));
        const popularityScore = Math.min(6, Math.floor(((pop?.registrations || 0) * 2 + (pop?.checkedIn || 0) * 3 + (event.views || 0)) / 10));
        const categoryBoost = recentCategories.includes(String(event.category || "").toLowerCase()) ? 3 : 0;
        const departmentBoost = deptMap.get(String(event._id)) ? 2 : 0;
        const capacityScore = Number.isFinite(event.capacity) && event.capacity > 0 && event.capacity < 50 ? 1 : 0;
        return { event, score: interestScore + featuredScore + liveScore + popularityScore + categoryBoost + departmentBoost + capacityScore };
      })
      .sort((a, b) => b.score - a.score || new Date(a.event.date) - new Date(b.event.date))
      .slice(0, 10)
      .map(({ event, score }) => ({
        _id: event._id,
        title: event.title,
        description: event.description,
        date: event.date,
        venue: event.venue,
        category: event.category,
        subcategory: event.subcategory,
        mode: event.mode,
        status: event.status,
        featured: event.featured,
        tags: event.tags,
        views: event.views,
        posterUrl: event.posterUrl || event.imageUrl || "",
        score,
        reasons: [
          event.featured ? "Featured" : null,
          recentCategories.includes(String(event.category || "").toLowerCase()) ? "Matches recent interests" : null,
          deptMap.get(String(event._id)) ? "Popular in your department" : null,
          event.status === "live" ? "Live now" : event.status === "upcoming" ? "Starting soon" : null,
        ].filter(Boolean),
      }));

    res.json({ recommendations: scored });
  } catch (error) {
    console.log("RECOMMENDATIONS ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/pending", protect, adminOnly, async (req, res) => {
  try {
    const pending = await Event.find({ isArchived: { $ne: true }, $or: [{ approvalRequired: true }, { status: "draft" }] })
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 });
    res.json(pending);
  } catch (error) {
    console.log("PENDING EVENTS ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/mine", protect, coordinatorOrAdmin, async (req, res) => {
  try {
    const criteria = { isArchived: { $ne: true } };
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      criteria.createdBy = req.user._id;
    }
    const events = await Event.find(criteria).populate("createdBy", "name email role").sort({ date: 1, createdAt: -1 });
    res.json(events);
  } catch (error) {
    console.log("MY EVENTS ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const currentUser = await getOptionalUser(req);
    const { criteria, sortQuery, pageNumber, limitNumber } = buildQuery(req.query, currentUser);
    const query = Event.find(criteria).populate("createdBy", "name email role").sort(sortQuery);

    if (limitNumber) {
      query.skip((pageNumber - 1) * limitNumber).limit(limitNumber);
    }

    const events = await query;
    if (limitNumber) {
      const total = await Event.countDocuments(criteria);
      return res.json({ events, pagination: { page: pageNumber, limit: limitNumber, total, pages: Math.max(Math.ceil(total / limitNumber), 1) } });
    }

    res.json(events);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const currentUser = await getOptionalUser(req);
    const event = await Event.findById(req.params.id).populate("createdBy", "name email role");
    if (!event || event.isArchived) return res.status(404).json({ message: "Event not found" });
    if (event.status === "draft" && !["admin", "super_admin"].includes(currentUser?.role)) return res.status(404).json({ message: "Event not found" });

    await Event.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true });
    const fresh = await Event.findById(req.params.id).populate("createdBy", "name email role");
    const [confirmed, waitlisted, cancelled] = await Promise.all([
      Registration.countDocuments({ event: req.params.id, status: "confirmed" }),
      Registration.countDocuments({ event: req.params.id, status: "waitlisted" }),
      Registration.countDocuments({ event: req.params.id, status: "cancelled" }),
    ]);
    res.json({ ...fresh.toObject(), registrationStats: { confirmed, waitlisted, cancelled } });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", protect, canManageEvent, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.isArchived) return res.status(404).json({ message: "Event not found" });

    const payload = buildEventPayload(req.body, req);
    if (payload.title !== undefined && !payload.title) return res.status(400).json({ message: "Title cannot be empty" });
    if (payload.description !== undefined && !payload.description) return res.status(400).json({ message: "Description cannot be empty" });
    if (payload.venue !== undefined && !payload.venue) return res.status(400).json({ message: "Venue cannot be empty" });
    if (req.body.date !== undefined && Number.isNaN(payload.date.getTime())) return res.status(400).json({ message: "Invalid date format" });

    const before = event.toObject();
    if (payload.title) event.title = payload.title;
    if (payload.description) event.description = payload.description;
    if (req.body.date !== undefined) event.date = payload.date;
    if (req.body.endDate !== undefined) event.endDate = payload.endDate;
    if (payload.venue) event.venue = payload.venue;
    if (req.body.category !== undefined) event.category = payload.category;
    if (req.body.subcategory !== undefined) event.subcategory = payload.subcategory;
    if (req.body.mode !== undefined) event.mode = payload.mode;
    if (req.body.status !== undefined) event.status = payload.status;
    if (req.body.featured !== undefined) event.featured = payload.featured;
    if (req.body.approvalRequired !== undefined) event.approvalRequired = payload.approvalRequired;
    if (req.body.capacity !== undefined) event.capacity = payload.capacity;
    if (req.body.waitlistCapacity !== undefined) event.waitlistCapacity = payload.waitlistCapacity;
    if (req.body.organizerName !== undefined) event.organizerName = payload.organizerName;
    if (req.body.speakerName !== undefined) event.speakerName = payload.speakerName;
    if (req.body.speakerRole !== undefined) event.speakerRole = payload.speakerRole;
    if (req.body.schedule !== undefined) event.schedule = payload.schedule;
    if (req.body.rules !== undefined) event.rules = payload.rules;
    if (req.body.certificateEnabled !== undefined) event.certificateEnabled = payload.certificateEnabled;
    if (req.body.tags !== undefined) event.tags = payload.tags;
    if (req.body.attachments !== undefined) event.attachments = payload.attachments;
    if (req.body.imageUrl !== undefined) event.imageUrl = payload.imageUrl;
    if (req.body.posterUrl !== undefined) event.posterUrl = payload.posterUrl || payload.imageUrl;
    if (req.body.locationUrl !== undefined) event.locationUrl = payload.locationUrl;
    if (req.body.certificateTemplateUrl !== undefined) event.certificateTemplateUrl = payload.certificateTemplateUrl || "";

    await event.save();
    await recordAudit({ req, action: "event.update", entityType: "Event", entityId: event._id, title: event.title, metadata: { changed: Object.keys(req.body || {}), beforeStatus: before.status, afterStatus: event.status } });
    clearCache("admin:");
    emitToEvent(event._id, "event:update", { eventId: String(event._id), title: event.title, status: event.status });
    emitToAdmins("dashboard:update", { type: "event", eventId: String(event._id), action: "update" });
    res.json({ message: "Event updated successfully", event });
  } catch (error) {
    console.log("UPDATE EVENT ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/approve", protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.isArchived) return res.status(404).json({ message: "Event not found" });
    event.approvalRequired = false;
    if (event.status === "draft") event.status = "published";
    await event.save();
    await recordAudit({ req, action: "event.approve", entityType: "Event", entityId: event._id, title: event.title, metadata: { status: event.status } });
    clearCache("admin:");
    emitToAdmins("dashboard:update", { type: "event", eventId: String(event._id), action: "approve" });
    res.json({ message: "Event approved", event });
  } catch (error) {
    console.log("APPROVE EVENT ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/publish", protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.isArchived) return res.status(404).json({ message: "Event not found" });
    event.status = "published";
    event.approvalRequired = false;
    await event.save();
    await recordAudit({ req, action: "event.publish", entityType: "Event", entityId: event._id, title: event.title, metadata: { status: event.status } });
    clearCache("admin:");
    emitToAdmins("dashboard:update", { type: "event", eventId: String(event._id), action: "publish" });
    res.json({ message: "Event published", event });
  } catch (error) {
    console.log("PUBLISH EVENT ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/archive", protect, canManageEvent, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.isArchived) return res.status(404).json({ message: "Event not found" });
    event.isArchived = true;
    event.status = "cancelled";
    await event.save();
    await recordAudit({ req, action: "event.archive", entityType: "Event", entityId: event._id, title: event.title, metadata: { status: event.status } });
    emitToEvent(event._id, "event:update", { eventId: String(event._id), title: event.title, status: event.status });
    emitToAdmins("dashboard:update", { type: "event", eventId: String(event._id), action: "archive" });
    res.json({ message: "Event archived successfully", event });
  } catch (error) {
    console.log("ARCHIVE ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", protect, canManageEvent, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.isArchived) return res.status(404).json({ message: "Event not found" });
    event.isArchived = true;
    event.status = "cancelled";
    await event.save();
    await recordAudit({ req, action: "event.archive", entityType: "Event", entityId: event._id, title: event.title, metadata: { status: event.status } });
    emitToEvent(event._id, "event:update", { eventId: String(event._id), title: event.title, status: event.status });
    emitToAdmins("dashboard:update", { type: "event", eventId: String(event._id), action: "delete" });
    res.json({ message: "Event archived successfully" });
  } catch (error) {
    console.log("DELETE ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
