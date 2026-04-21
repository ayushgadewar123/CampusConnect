const express = require("express");
const router = express.Router();

const Event = require("../models/Event");
const Registration = require("../models/Registration");
const User = require("../models/User");
const Announcement = require("../models/Announcement");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/authMiddleware");

const buildCertificateCode = (eventId, regId) => `CERT-${String(eventId).slice(-4)}-${String(regId).slice(-4)}`.toUpperCase();

const escapeXml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const buildCertificateSvg = ({ title, name, category, venue, date, certificateCode, organizerName, speakerName, speakerRole }) => {
  const issuedDate = new Date().toLocaleDateString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
  </defs>
  <rect width="1200" height="850" fill="url(#bg)" />
  <rect x="50" y="50" width="1100" height="750" rx="34" fill="url(#card)" stroke="#cbd5e1" stroke-width="6" />
  <text x="600" y="150" text-anchor="middle" font-size="46" font-family="Arial, sans-serif" fill="#0f172a" font-weight="700">CampusConnect Certificate</text>
  <text x="600" y="220" text-anchor="middle" font-size="28" font-family="Arial, sans-serif" fill="#334155">This certificate is awarded to</text>
  <text x="600" y="310" text-anchor="middle" font-size="58" font-family="Georgia, serif" fill="#111827" font-weight="700">${escapeXml(name)}</text>
  <line x1="160" y1="350" x2="1040" y2="350" stroke="#94a3b8" stroke-width="3" />
  <text x="600" y="415" text-anchor="middle" font-size="30" font-family="Arial, sans-serif" fill="#0f172a">for successful participation in</text>
  <text x="600" y="470" text-anchor="middle" font-size="40" font-family="Arial, sans-serif" fill="#1d4ed8" font-weight="700">${escapeXml(title)}</text>
  <text x="600" y="530" text-anchor="middle" font-size="24" font-family="Arial, sans-serif" fill="#334155">Category: ${escapeXml(category || 'General')} • Venue: ${escapeXml(venue || 'TBA')}</text>
  <text x="600" y="570" text-anchor="middle" font-size="24" font-family="Arial, sans-serif" fill="#334155">Date: ${escapeXml(new Date(date).toLocaleDateString())}</text>
  <text x="170" y="670" font-size="21" font-family="Arial, sans-serif" fill="#475569">Organizer: ${escapeXml(organizerName || 'CampusConnect')}</text>
  <text x="170" y="705" font-size="21" font-family="Arial, sans-serif" fill="#475569">Speaker: ${escapeXml(speakerName || 'Campus team')} ${speakerRole ? `(${escapeXml(speakerRole)})` : ''}</text>
  <text x="170" y="760" font-size="21" font-family="Arial, sans-serif" fill="#475569">Issued: ${escapeXml(issuedDate)}</text>
  <text x="930" y="720" text-anchor="middle" font-size="22" font-family="Arial, sans-serif" fill="#475569">Code</text>
  <text x="930" y="760" text-anchor="middle" font-size="26" font-family="monospace" fill="#111827" font-weight="700">${escapeXml(certificateCode)}</text>
</svg>`;
};

const escapePdfText = (value) => String(value ?? "")
  .replace(/\\/g, "\\\\")
  .replace(/\(/g, "\\(")
  .replace(/\)/g, "\\)");

const buildCertificatePdf = ({ title, name, category, venue, date, certificateCode, organizerName, speakerName, speakerRole }) => {
  const issuedDate = new Date().toLocaleDateString();
  const lines = [
    "CampusConnect Certificate",
    `Awarded To: ${name}`,
    `Event: ${title}`,
    `Category: ${category || 'General'}`,
    `Venue: ${venue || 'TBA'}`,
    `Date: ${date ? new Date(date).toLocaleDateString() : 'TBA'}`,
    `Certificate Code: ${certificateCode}`,
    `Organizer: ${organizerName || 'CampusConnect'}`,
    `Speaker: ${speakerName ? `${speakerName}${speakerRole ? ` • ${speakerRole}` : ''}` : 'N/A'}`,
    `Issued: ${issuedDate}`,
  ];

  const contentLines = [
    'BT',
    '/F1 24 Tf',
    '72 760 Td',
    `(${escapePdfText(lines[0])}) Tj`,
    '/F1 14 Tf',
  ];
  lines.slice(1).forEach((line) => {
    contentLines.push('0 -28 Td');
    contentLines.push(`(${escapePdfText(line)}) Tj`);
  });
  contentLines.push('ET');
  const content = contentLines.join('\\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\\nstream\\n${content}\\nendstream`,
  ];
  let pdf = '%PDF-1.4\\n';
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\\n${obj}\\nendobj\\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\\n0 ${objects.length + 1}\\n`;
  pdf += '0000000000 65535 f \\n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \\n`;
  });
  pdf += `trailer\\n<< /Size ${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n${xrefStart}\\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
};


const daysUntil = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const buildAchievements = (stats, user = {}) => {
  const badges = [];
  const registrations = stats?.registeredEvents || 0;
  const checkedIn = stats?.checkedIn || 0;
  const waitlisted = stats?.waitlisted || 0;
  const completed = stats?.completedEvents || 0;

  if (registrations >= 1) badges.push({ id: "first-step", label: "First Step", text: "Registered for your first event." });
  if (registrations >= 5) badges.push({ id: "explorer", label: "Explorer", text: "Joined five or more events." });
  if (registrations >= 10) badges.push({ id: "enthusiast", label: "Enthusiast", text: "Built a strong event streak." });
  if (checkedIn >= 3) badges.push({ id: "checkin-pro", label: "Check-in Pro", text: "Checked in to multiple events." });
  if (waitlisted >= 1) badges.push({ id: "waitlist-warrior", label: "Waitlist Warrior", text: "Stayed active even on waitlists." });
  if (completed >= 3) badges.push({ id: "certificate-hunter", label: "Certificate Hunter", text: "Completed events with attendance proof." });
  if ((user.skills || []).length >= 3) badges.push({ id: "skill-builder", label: "Skill Builder", text: "Maintains a growing skill profile." });
  if ((user.interests || []).length >= 3) badges.push({ id: "curious-mind", label: "Curious Mind", text: "Tracks broad campus interests." });

  const points = registrations * 10 + checkedIn * 15 + completed * 20 + waitlisted * 3;

  return { badges, points };
};

router.get("/", protect, async (req, res) => {
  try {
    const user = req.user;

    if (["admin", "super_admin"].includes(user.role)) {
      const [totalEvents, totalRegistrations, totalUsers, upcomingEvents, liveEvents, waitlistedRegistrations] = await Promise.all([
        Event.countDocuments({ isArchived: { $ne: true } }),
        Registration.countDocuments(),
        User.countDocuments(),
        Event.countDocuments({ status: { $in: ["upcoming", "published"] }, isArchived: { $ne: true } }),
        Event.countDocuments({ status: "live", isArchived: { $ne: true } }),
        Registration.countDocuments({ status: "waitlisted" }),
      ]);

      const registrationsByStatus = await Registration.aggregate([{ $group: { _id: "$status", value: { $sum: 1 } } }]);
      const roleBreakdown = await User.aggregate([{ $group: { _id: "$role", value: { $sum: 1 } } }]);

      return res.json({
        message: "Admin dashboard",
        user,
        stats: { totalUsers, totalEvents, totalRegistrations, upcomingEvents, liveEvents, waitlistedRegistrations },
        registrationsByStatus,
        roleBreakdown,
      });
    }

    const myRegistrations = await Registration.find({ user: user._id })
      .populate("event", "title date venue category status capacity featured views organizerName speakerName speakerRole rules certificateEnabled")
      .sort({ createdAt: -1 });

    const upcoming = myRegistrations.filter((item) => item.event && !["completed", "cancelled"].includes(item.event.status)).length;
    const confirmed = myRegistrations.filter((item) => item.status === "confirmed").length;
    const waitlisted = myRegistrations.filter((item) => item.status === "waitlisted").length;
    const cancelled = myRegistrations.filter((item) => item.status === "cancelled").length;
    const completedEvents = myRegistrations.filter((item) => item.event && item.event.status === "completed").length;
    const checkedIn = myRegistrations.filter((item) => item.checkedIn).length;

    const achievements = buildAchievements({ registeredEvents: myRegistrations.length, upcoming, confirmed, waitlisted, cancelled, completedEvents, checkedIn }, user);

    return res.json({
      message: "Student dashboard",
      user,
      stats: { registeredEvents: myRegistrations.length, upcoming, confirmed, waitlisted, cancelled, completedEvents, checkedIn },
      achievements,
      myRegistrations,
    });
  } catch (error) {
    console.log("DASHBOARD ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/calendar", protect, async (req, res) => {
  try {
    const upcomingEvents = await Event.find({ isArchived: { $ne: true }, status: { $in: ["upcoming", "published", "live"] } })
      .sort({ date: 1 })
      .populate("createdBy", "name role");

    const myRegistrations = await Registration.find({ user: req.user._id })
      .populate("event", "title date venue category status mode featured")
      .sort({ createdAt: -1 });

    const events = ["admin", "super_admin"].includes(req.user.role) ? upcomingEvents : myRegistrations.map((registration) => registration.event).filter(Boolean);

    res.json({
      events,
      registrations: myRegistrations,
      upcomingCount: upcomingEvents.length,
      registeredCount: myRegistrations.length,
    });
  } catch (error) {
    console.log("CALENDAR ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/calendar.ics", protect, async (req, res) => {
  try {
    const events = await Event.find({ isArchived: { $ne: true }, status: { $in: ["upcoming", "published", "live"] } })
      .sort({ date: 1 })
      .select("title description date endDate venue category status mode")
      .lean();

    const pad = (value) => String(value).padStart(2, "0");
    const toUtcStamp = (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
    };

    const escapeLine = (value) => String(value || "").replace(/\n/g, " ");

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CampusConnect//Campus Calendar//EN",
      ...events.flatMap((event) => {
        const startDate = new Date(event.date);
        if (Number.isNaN(startDate.getTime())) return [];
        const endDate = new Date(event.endDate || event.date);
        return [
          "BEGIN:VEVENT",
          `UID:${event._id}@campusconnect`,
          `DTSTAMP:${toUtcStamp(new Date())}`,
          `DTSTART:${toUtcStamp(startDate)}`,
          `DTEND:${toUtcStamp(endDate)}`,
          `SUMMARY:${escapeLine(event.title || "Campus Event")}`,
          `DESCRIPTION:${escapeLine(event.description)}`,
          `LOCATION:${escapeLine(event.venue)}`,
          "END:VEVENT",
        ];
      }),
      "END:VCALENDAR",
    ];

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="campusconnect-calendar.ics"');
    res.send(lines.join("\r\n"));
  } catch (error) {
    console.log("CALENDAR ICS ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/certificates", protect, async (req, res) => {
  try {
    const completedRegistrations = await Registration.find({
      user: req.user._id,
      status: { $ne: "cancelled" },
      checkedIn: true,
    }).populate("event", "title date venue category status certificateEnabled organizerName speakerName speakerRole");

    const certificates = completedRegistrations
      .filter((registration) => registration.event && registration.event.status === "completed" && registration.event.certificateEnabled !== false)
      .map((registration) => ({
        id: registration._id,
        certificateCode: registration.certificateCode || buildCertificateCode(registration.event._id, registration._id),
        title: registration.event.title,
        category: registration.event.category,
        venue: registration.event.venue,
        date: registration.event.date,
        organizerName: registration.event.organizerName,
        speakerName: registration.event.speakerName,
        speakerRole: registration.event.speakerRole,
        issuedAt: registration.checkedInAt || registration.updatedAt,
      }));

    res.json({ certificates, count: certificates.length });
  } catch (error) {
    console.log("CERTIFICATE ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/certificates/:id/download", protect, async (req, res) => {
  try {
    const registration = await Registration.findOne({ _id: req.params.id, user: req.user._id })
      .populate("event", "title date venue category status certificateEnabled organizerName speakerName speakerRole");

    if (!registration || !registration.event || registration.event.status !== "completed" || registration.event.certificateEnabled === false) {
      return res.status(404).json({ message: "Certificate not available" });
    }

    const certificateCode = registration.certificateCode || buildCertificateCode(registration.event._id, registration._id);
    const format = String(req.query.format || "svg").toLowerCase();
    const payload = {
      title: registration.event.title,
      name: req.user.name,
      category: registration.event.category,
      venue: registration.event.venue,
      date: registration.event.date,
      certificateCode,
      organizerName: registration.event.organizerName,
      speakerName: registration.event.speakerName,
      speakerRole: registration.event.speakerRole,
    };

    if (format === "json") {
      return res.json({ ...payload, id: registration._id });
    }


    if (format === "txt") {
      const lines = [
        'CampusConnect Certificate',
        `Name: ${req.user.name}`,
        `Event: ${registration.event.title}`,
        `Category: ${registration.event.category || 'General'}`,
        `Venue: ${registration.event.venue || 'TBA'}`,
        `Certificate Code: ${certificateCode}`,
      ];
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${String(registration.event.title).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-certificate.txt"`);
      return res.send(lines.join('\n'));
    }

    if (format === "pdf") {
      const pdf = buildCertificatePdf(payload);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${String(registration.event.title).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-certificate.pdf"`);
      return res.send(pdf);
    }

    const svg = buildCertificateSvg(payload);

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${String(registration.event.title).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-certificate.svg"`);
    return res.send(svg);
  } catch (error) {
    console.log('CERTIFICATE DOWNLOAD ERROR:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get("/certificates/verify/:code", async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ message: "Certificate code is required" });

    let registration = await Registration.findOne({ certificateCode: code })
      .populate("event", "title date venue category status certificateEnabled organizerName speakerName speakerRole")
      .populate("user", "name department year role");

    if (!registration) {
      const fallbackMatches = await Registration.find({ checkedIn: true })
        .populate("event", "title date venue category status certificateEnabled organizerName speakerName speakerRole")
        .populate("user", "name department year role");
      registration = fallbackMatches.find((item) => {
        const derived = buildCertificateCode(item.event?._id, item._id);
        return derived === code;
      }) || null;
    }

    if (!registration || !registration.event) {
      return res.status(404).json({ verified: false, message: "Certificate not found" });
    }

    const canonicalCode = registration.certificateCode || buildCertificateCode(registration.event._id, registration._id);
    const eligible = registration.event.status === "completed" && registration.checkedIn && registration.event.certificateEnabled !== false;
    return res.json({
      verified: eligible,
      certificateCode: canonicalCode,
      event: registration.event,
      participant: {
        name: registration.user?.name || "Participant",
        department: registration.user?.department || "",
        year: registration.user?.year || "",
        role: registration.user?.role || "student",
      },
      issuedAt: registration.checkedInAt || registration.updatedAt,
      checkedIn: Boolean(registration.checkedIn),
      status: registration.event.status,
      message: eligible ? "Certificate verified" : "Certificate exists but is not yet eligible",
    });
  } catch (error) {
    console.log('CERTIFICATE VERIFY ERROR:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get("/leaderboard", protect, async (req, res) => {
  try {
    const leaderboard = await Registration.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: "$user",
          registrations: { $sum: 1 },
          checkedIn: { $sum: { $cond: ["$checkedIn", 1, 0] } },
          waitlisted: { $sum: { $cond: [{ $eq: ["$status", "waitlisted"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$checkedIn", true] }, 1, 0] } },
        },
      },
      { $sort: { checkedIn: -1, registrations: -1 } },
      { $limit: 10 },
    ]);

    const userIds = leaderboard.map((entry) => entry._id).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).select("name email role department year interests skills badges");

    const rows = leaderboard.map((entry, index) => {
      const user = users.find((item) => String(item._id) === String(entry._id));
      const points = entry.registrations * 10 + entry.checkedIn * 15 + entry.completed * 20 + entry.waitlisted * 3;
      return {
        rank: index + 1,
        user: user ? { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department, year: user.year } : null,
        registrations: entry.registrations,
        checkedIn: entry.checkedIn,
        waitlisted: entry.waitlisted,
        completed: entry.completed,
        points,
      };
    });

    res.json({ leaderboard: rows });
  } catch (error) {
    console.log("LEADERBOARD ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/achievements", protect, async (req, res) => {
  try {
    const registrations = await Registration.find({ user: req.user._id }).populate("event", "title status category certificateEnabled");

    const stats = {
      registeredEvents: registrations.length,
      upcoming: registrations.filter((item) => item.event && !["completed", "cancelled"].includes(item.event.status)).length,
      confirmed: registrations.filter((item) => item.status === "confirmed").length,
      waitlisted: registrations.filter((item) => item.status === "waitlisted").length,
      completedEvents: registrations.filter((item) => item.event && item.event.status === "completed").length,
      checkedIn: registrations.filter((item) => item.checkedIn).length,
    };

    const achievements = buildAchievements(stats, req.user);
    res.json({ ...achievements, stats });
  } catch (error) {
    console.log("ACHIEVEMENT ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/notifications", protect, async (req, res) => {
  try {
    const registrations = await Registration.find({ user: req.user._id }).populate("event", "title date venue status category mode capacity certificateEnabled approvalRequired").sort({ createdAt: -1 });
    const storedNotifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(40);
    const notifications = [];

    registrations.forEach((reg) => {
      const event = reg.event || {};
      const diff = daysUntil(event.date);

      if (reg.status === "waitlisted") {
        notifications.push({ id: `${reg._id}-wait`, type: "waitlist", title: event.title, text: `You are waitlisted${reg.waitlistPosition ? ` at position ${reg.waitlistPosition}` : ""}.`, daysUntil: diff, createdAt: reg.createdAt, source: "derived" });
      }

      if (reg.status === "confirmed" && typeof diff === "number" && diff >= 0 && diff <= 7) {
        notifications.push({ id: `${reg._id}-rem`, type: "reminder", title: event.title, text: `${diff} day${diff === 1 ? "" : "s"} left until ${event.venue || "the venue"}.`, daysUntil: diff, createdAt: reg.createdAt, source: "derived" });
      }

      if (reg.status === "confirmed" && event.status === "live" && !reg.checkedIn) {
        notifications.push({ id: `${reg._id}-check`, type: "checkin", title: event.title, text: "Event is live. Check in now.", daysUntil: 0, createdAt: reg.createdAt, source: "derived" });
      }

      if (event.status === "completed" && reg.checkedIn && event.certificateEnabled !== false) {
        notifications.push({ id: `${reg._id}-cert`, type: "certificate", title: event.title, text: "Your certificate archive is ready.", daysUntil: null, createdAt: reg.updatedAt, source: "derived" });
      }

      if (event.approvalRequired) {
        notifications.push({ id: `${reg._id}-approval`, type: "approval", title: event.title, text: "This event is awaiting admin approval.", daysUntil: null, createdAt: reg.createdAt, source: "derived" });
      }
    });

    storedNotifications.forEach((item) => {
      notifications.push({
        id: String(item._id),
        type: item.type,
        title: item.title,
        text: item.message,
        link: item.link || "",
        isRead: item.isRead,
        createdAt: item.createdAt,
        meta: item.metadata || {},
        source: "stored",
      });
    });

    notifications.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json({ notifications, total: notifications.length, persisted: storedNotifications.length });
  } catch (error) {
    console.log("NOTIFICATIONS ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/resume", protect, async (req, res) => {
  try {
    const EventFeedback = require("../models/EventFeedback");
    const [registrations, feedback] = await Promise.all([
      Registration.find({ user: req.user._id })
        .populate("event", "title date venue category status certificateEnabled organizerName speakerName speakerRole")
        .sort({ createdAt: -1 }),
      EventFeedback.find({ user: req.user._id })
        .populate("event", "title date venue category status")
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    const completed = registrations.filter((item) => item.event && item.event.status === "completed" && item.checkedIn);
    const checkedIn = registrations.filter((item) => item.checkedIn).length;
    const waitlisted = registrations.filter((item) => item.status === "waitlisted").length;

    res.json({
      profile: {
        name: req.user.name,
        email: req.user.email,
        department: req.user.department,
        year: req.user.year,
        interests: req.user.interests || [],
        skills: req.user.skills || [],
        badges: req.user.badges || [],
      },
      stats: {
        total: registrations.length,
        completed: completed.length,
        checkedIn,
        waitlisted,
      },
      certificates: registrations
        .filter((item) => item.event && item.event.status === "completed" && item.checkedIn && item.event.certificateEnabled !== false)
        .map((item) => ({
          id: item._id,
          title: item.event.title,
          venue: item.event.venue,
          category: item.event.category,
          date: item.event.date,
          certificateCode: item.certificateCode || `CERT-${String(item.event._id).slice(-4)}-${String(item._id).slice(-4)}`.toUpperCase(),
        })),
      recentEvents: registrations.slice(0, 12),
      feedback,
    });
  } catch (error) {
    console.log("RESUME ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/volunteer", protect, async (req, res) => {
  try {
    const [upcomingEvents, myRegistrations, pendingApprovals, recentLogs] = await Promise.all([
      Event.find({ isArchived: { $ne: true }, status: { $in: ["upcoming", "published", "live"] } })
        .populate("createdBy", "name role")
        .sort({ date: 1 })
        .limit(12),
      Registration.find({ user: req.user._id })
        .populate("event", "title date venue status category mode")
        .sort({ createdAt: -1 })
        .limit(12),
      Event.find({ isArchived: { $ne: true }, $or: [{ approvalRequired: true }, { status: "draft" }] })
        .sort({ createdAt: -1 })
        .limit(8),
      require("../models/AuditLog").find().sort({ createdAt: -1 }).limit(8),
    ]);

    res.json({
      role: req.user.role,
      upcomingEvents,
      myRegistrations,
      pendingApprovals,
      recentLogs,
      tasks: [
        { id: "check-in", title: "Review live events", detail: "Mark attendance and manage the venue desk." },
        { id: "announce", title: "Share announcements", detail: "Publish reminders and updates to students." },
        { id: "support", title: "Support registrations", detail: "Monitor waitlists and help with approvals." },
      ],
    });
  } catch (error) {
    console.log("VOLUNTEER ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
