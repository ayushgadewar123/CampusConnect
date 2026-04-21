const express = require("express");
const router = express.Router();

const Announcement = require("../models/Announcement");
const Registration = require("../models/Registration");
const User = require("../models/User");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { emitToAdmins, emitToEvent } = require("../services/socket");
const { sendAnnouncementEmail } = require("../services/emailService");
const { shouldSendToEmail, canSendBulkEmail, getEmailBulkCap } = require("../services/emailPolicy");
const { createNotification, shouldSendEmail } = require("../services/notificationService");
const { clearCache } = require("../services/cache");

const audienceFilter = async (payload) => {
  if (payload.audience === "event_participants" && payload.event) {
    const registrations = await Registration.find({ event: payload.event, status: { $ne: "cancelled" } }).populate("user", "name email role");
    return registrations.map((item) => item.user).filter(Boolean);
  }

  const query = {};
  if (payload.audience === "students") query.role = "student";
  else if (payload.audience === "admins") query.role = { $in: ["admin", "super_admin"] };
  else if (payload.audience === "coordinators") query.role = "coordinator";
  else if (payload.audience === "volunteers") query.role = "volunteer";
  return User.find(query).select("name email role");
};

router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const announcements = await Announcement.find({
      isArchived: { $ne: true },
      $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
    })
      .populate("createdBy", "name role")
      .populate("event", "title")
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(30);

    res.json(announcements);
  } catch (error) {
    console.log("ANNOUNCEMENTS GET ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const payload = {
      title: String(req.body.title || "").trim(),
      message: String(req.body.message || "").trim(),
      audience: ["all", "students", "admins", "coordinators", "volunteers", "event_participants"].includes(req.body.audience)
        ? req.body.audience
        : "all",
      event: req.body.event || null,
      isPinned: Boolean(req.body.isPinned),
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      sendEmail: Boolean(req.body.sendEmail),
      createdBy: req.user._id,
    };

    if (!payload.title || !payload.message) return res.status(400).json({ message: "Title and message are required" });
    if (payload.expiresAt && Number.isNaN(payload.expiresAt.getTime())) return res.status(400).json({ message: "Invalid expiry date" });

    const announcement = await Announcement.create(payload);
    const recipients = await audienceFilter(payload);

    let sent = 0;
    if (payload.sendEmail) {
      const emailCap = getEmailBulkCap();
      if (recipients.length <= emailCap && canSendBulkEmail(recipients.length)) {
        for (const user of recipients) {
          if (sent >= emailCap) break;
          if (await shouldSendEmail(user._id, "announcement") && shouldSendToEmail(user.email)) {
            await sendAnnouncementEmail({ user, announcement });
            sent += 1;
          }
        }
      }
    }

await Promise.allSettled(recipients.map((user) => createNotification({
  users: [user],
  type: "announcement",
  title: announcement.title,
  message: announcement.message,
  link: payload.event ? `/events/${payload.event}` : "/announcements",
  sourceType: "Announcement",
  sourceId: announcement._id,
  metadata: { audience: payload.audience, sendEmail: payload.sendEmail },
})));

clearCache("admin:");
emitToAdmins("announcement:update", { action: "create", announcement });
if (payload.audience === "event_participants" && payload.event) {
  emitToEvent(payload.event, "announcement:update", { action: "create", announcement });
  emitToEvent(payload.event, "notification:new", { type: "announcement", title: announcement.title, message: announcement.message });
}

res.status(201).json({ message: "Announcement published", announcement, sent: sent });
  } catch (error) {
    console.log("ANNOUNCEMENTS POST ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/pin", protect, adminOnly, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });
    announcement.isPinned = !announcement.isPinned;
    await announcement.save();
    clearCache("admin:");
    emitToAdmins("announcement:update", { action: "pin", announcement });
    res.json({ message: "Announcement updated", announcement });
  } catch (error) {
    console.log("ANNOUNCEMENTS PIN ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });
    announcement.isArchived = true;
    await announcement.save();
    clearCache("admin:");
    emitToAdmins("announcement:update", { action: "archive", announcement });
    res.json({ message: "Announcement archived" });
  } catch (error) {
    console.log("ANNOUNCEMENTS DELETE ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
