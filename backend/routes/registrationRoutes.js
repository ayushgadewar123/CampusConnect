const express = require("express");
const router = express.Router();

const Registration = require("../models/Registration");
const Event = require("../models/Event");
const AuditLog = require("../models/AuditLog");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { coordinatorOrAdmin, canManageEvent } = require("../middleware/roleMiddleware");
const { emitToEvent, emitToAdmins } = require("../services/socket");
const { sendRegistrationEmail, sendCancellationEmail, sendWaitlistPromotionEmail } = require("../services/emailService");
const { shouldSendToEmail } = require("../services/emailPolicy");
const { notifyUser, shouldSendEmail } = require("../services/notificationService");
const { clearCache } = require("../services/cache");

const generateTicketCode = (eventId, userId) => {
  const tail = `${String(eventId).slice(-4)}${String(userId).slice(-4)}`.toUpperCase();
  return `CC-${Date.now().toString(36).toUpperCase()}-${tail}`;
};

const generateCertificateCode = (eventId, userId) => {
  const tail = `${String(eventId).slice(-3)}${String(userId).slice(-3)}`.toUpperCase();
  return `CERT-${Date.now().toString(36).toUpperCase()}-${tail}`;
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

const isRegistrationOpen = (event) => {
  if (!event || event.isArchived) return false;
  return !["draft", "cancelled", "completed"].includes(String(event.status || "").toLowerCase());
};

const buildRealtimePayload = async (eventId) => {
  const [confirmed, waitlisted, cancelled] = await Promise.all([
    Registration.countDocuments({ event: eventId, status: "confirmed" }),
    Registration.countDocuments({ event: eventId, status: "waitlisted" }),
    Registration.countDocuments({ event: eventId, status: "cancelled" }),
  ]);
  return { eventId: String(eventId), confirmed, waitlisted, cancelled };
};

const promoteNextWaitlisted = async (eventId) => {
  const next = await Registration.findOne({ event: eventId, status: "waitlisted" }).sort({ waitlistPosition: 1, createdAt: 1 }).populate("user", "name email").populate("event", "title date venue status");
  if (!next) return null;
  next.status = "confirmed";
  next.waitlistPosition = 0;
  next.ticketCode = generateTicketCode(next.event, next.user);
  await next.save();
  return next;
};

router.post("/:eventId", protect, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await Event.findById(eventId);
    if (!event || !isRegistrationOpen(event)) return res.status(404).json({ message: "Event not found or registration closed" });

    const existing = await Registration.findOne({ user: req.user._id, event: eventId });
    const confirmedCount = await Registration.countDocuments({ event: eventId, status: "confirmed" });
    const waitlistCount = await Registration.countDocuments({ event: eventId, status: "waitlisted" });
    const isFull = Number.isFinite(event.capacity) && event.capacity > 0 && confirmedCount >= event.capacity;
    const isWaitlistFull = Number.isFinite(event.waitlistCapacity) && event.waitlistCapacity > 0 && waitlistCount >= event.waitlistCapacity;
    const status = isFull && !isWaitlistFull ? "waitlisted" : "confirmed";
    const waitlistPosition = status === "waitlisted" ? waitlistCount + 1 : 0;

    if (existing) {
      if (existing.status !== "cancelled") return res.status(400).json({ message: "Already registered" });
      existing.status = status;
      existing.waitlistPosition = waitlistPosition;
      existing.cancelledAt = null;
      existing.checkedIn = false;
      existing.checkedInAt = null;
      existing.certificateCode = "";
      existing.ticketCode = status === "confirmed" ? generateTicketCode(eventId, req.user._id) : "";
      await existing.save();
      await recordAudit({ req, action: "registration.restore", entityType: "Registration", entityId: existing._id, title: event.title, metadata: { status } });
    clearCache("admin:");
      const realtime = await buildRealtimePayload(eventId);
      emitToEvent(eventId, "registration:update", realtime);
      emitToAdmins("dashboard:update", { type: "registration", ...realtime });
      if (await shouldSendEmail(req.user._id, status === "confirmed" ? "registration" : "waitlist") && shouldSendToEmail(req.user.email)) {
        sendRegistrationEmail({ user: req.user, event, status, waitlistPosition, ticketCode: existing.ticketCode }).catch(() => {});
      }
      notifyUser(req.user, { type: status === "confirmed" ? "registration" : "waitlist", title: event.title, message: status === "confirmed" ? `Your registration for ${event.title} is confirmed.` : `You are back on the waitlist for ${event.title}.`, link: `/events/${eventId}`, sourceType: "Event", sourceId: eventId, metadata: { status, waitlistPosition } }).catch(() => {});
      return res.status(200).json({ message: status === "confirmed" ? "Registration restored" : "Restored to waitlist", registration: existing });
    }

    const registration = await Registration.create({
      user: req.user._id,
      event: eventId,
      status,
      ticketCode: status === "confirmed" ? generateTicketCode(eventId, req.user._id) : "",
      waitlistPosition,
    });

    await recordAudit({ req, action: "registration.create", entityType: "Registration", entityId: registration._id, title: event.title, metadata: { status, waitlistPosition } });
    clearCache("admin:");
    const realtime = await buildRealtimePayload(eventId);
    emitToEvent(eventId, "registration:update", realtime);
    emitToAdmins("dashboard:update", { type: "registration", ...realtime });
    if (await shouldSendEmail(req.user._id, status === "confirmed" ? "registration" : "waitlist") && shouldSendToEmail(req.user.email)) {
      sendRegistrationEmail({ user: req.user, event, status, waitlistPosition, ticketCode: registration.ticketCode }).catch(() => {});
    }
    notifyUser(req.user, { type: status === "confirmed" ? "registration" : "waitlist", title: event.title, message: status === "confirmed" ? `Your registration for ${event.title} is confirmed.` : `You were added to the waitlist for ${event.title}.`, link: `/events/${eventId}`, sourceType: "Event", sourceId: eventId, metadata: { status, waitlistPosition } }).catch(() => {});
    res.status(201).json({ message: status === "confirmed" ? "Registered successfully ✅" : "Added to waitlist", registration });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: "Already registered" });
    console.log("REGISTER ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/my", protect, async (req, res) => {
  try {
    const registrations = await Registration.find({ user: req.user._id }).populate("event").sort({ createdAt: -1 });
    res.json(registrations);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/event/:eventId", protect, async (req, res) => {
  try {
    const registrations = await Registration.find({ event: req.params.eventId })
      .populate("user", "name email role department year")
      .sort({ createdAt: 1 });
    res.json(registrations);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/event/:eventId/checkins", protect, coordinatorOrAdmin, canManageEvent, async (req, res) => {
  try {
    const registrations = await Registration.find({ event: req.params.eventId })
      .populate("user", "name email role department year")
      .sort({ createdAt: 1 });

    const summary = registrations.reduce((acc, registration) => {
      acc.total += 1;
      if (registration.status === "confirmed") acc.confirmed += 1;
      if (registration.status === "waitlisted") acc.waitlisted += 1;
      if (registration.status === "cancelled") acc.cancelled += 1;
      if (registration.checkedIn) acc.checkedIn += 1;
      return acc;
    }, { total: 0, confirmed: 0, waitlisted: 0, cancelled: 0, checkedIn: 0 });

    res.json({ registrations, summary });
  } catch (error) {
    console.log("CHECKIN ROSTER ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/event/:eventId/checkin", protect, coordinatorOrAdmin, canManageEvent, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const { registrationId = "", ticketCode = "" } = req.body || {};

    let registration = null;
    if (registrationId) {
      registration = await Registration.findOne({ _id: registrationId, event: eventId }).populate("event").populate("user", "name email");
    } else if (ticketCode) {
      registration = await Registration.findOne({ event: eventId, ticketCode: String(ticketCode).trim() }).populate("event").populate("user", "name email");
    }

    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    if (registration.status === "waitlisted") {
      return res.status(400).json({ message: "Waitlisted participants cannot be checked in" });
    }

    if (registration.status === "cancelled") {
      return res.status(400).json({ message: "Cancelled registration cannot be checked in" });
    }

    registration.checkedIn = true;
    registration.checkedInAt = registration.checkedInAt || new Date();

    if (!registration.ticketCode) {
      registration.ticketCode = generateTicketCode(eventId, registration.user?._id || registration.user);
    }

    if (!registration.certificateCode && registration.event?.certificateEnabled !== false) {
      registration.certificateCode = generateCertificateCode(registration.event._id, registration.user?._id || registration.user);
    }

    await registration.save();

    await recordAudit({
      req,
      action: "registration.checkin.desk",
      entityType: "Registration",
      entityId: registration._id,
      title: registration.event?.title || "Event",
      metadata: { eventId: String(eventId), ticketCode: registration.ticketCode, checkedInAt: registration.checkedInAt },
    });

    clearCache("admin:");
    const realtime = await buildRealtimePayload(eventId);
    emitToEvent(eventId, "registration:update", realtime);
    emitToEvent(eventId, "waitlist:update", realtime);
    emitToAdmins("dashboard:update", { type: "attendance", ...realtime });

    res.json({
      message: "Attendance marked",
      registration,
      summary: realtime,
    });
  } catch (error) {
    console.log("CHECKIN DESK ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const registrations = await Registration.find()
      .populate("user", "name email role department year")
      .populate("event", "title date venue category status capacity featured views organizerName speakerName speakerRole rules certificateEnabled approvalRequired posterUrl imageUrl");
    res.json(registrations);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:registrationId/checkin", protect, adminOnly, async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.registrationId).populate("event").populate("user", "name email");
    if (!registration) return res.status(404).json({ message: "Registration not found" });
    registration.checkedIn = true;
    registration.checkedInAt = new Date();
    if (!registration.certificateCode && registration.event?.certificateEnabled !== false) {
      registration.certificateCode = generateCertificateCode(registration.event._id, registration.user);
    }
    await registration.save();
    await recordAudit({ req, action: "registration.checkin", entityType: "Registration", entityId: registration._id, title: registration.event?.title || "Event", metadata: { checkedInAt: registration.checkedInAt } });
    clearCache("admin:");
    const realtime = await buildRealtimePayload(registration.event._id);
    emitToEvent(registration.event._id, "registration:update", realtime);
    emitToAdmins("dashboard:update", { type: "attendance", ...realtime });
    res.json({ message: "Attendance marked", registration });
  } catch (error) {
    console.log("CHECKIN ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:eventId", protect, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const registration = await Registration.findOne({ user: req.user._id, event: eventId }).populate("event").populate("user", "name email");
    if (!registration) return res.status(404).json({ message: "Registration not found" });

    registration.status = "cancelled";
    registration.checkedIn = false;
    registration.checkedInAt = null;
    registration.cancelledAt = new Date();
    registration.ticketCode = "";
    registration.waitlistPosition = 0;
    await registration.save();

    await recordAudit({ req, action: "registration.cancel", entityType: "Registration", entityId: registration._id, title: registration.event?.title || "Event", metadata: { cancelledAt: registration.cancelledAt } });
    clearCache("admin:");
    if (await shouldSendEmail(req.user._id, "registration") && shouldSendToEmail(req.user.email)) {
      sendCancellationEmail({ user: req.user, event: registration.event }).catch(() => {});
    }
    notifyUser(req.user, { type: "registration", title: registration.event?.title || "Event", message: `Your registration for ${registration.event?.title || "the event"} has been cancelled.`, link: `/events/${eventId}`, sourceType: "Event", sourceId: eventId, metadata: { status: "cancelled" } }).catch(() => {});

    const promoted = await promoteNextWaitlisted(eventId);
    if (promoted) {
      if (await shouldSendEmail(promoted.user._id || promoted.user, "promotion") && shouldSendToEmail(promoted.user.email)) {
        sendWaitlistPromotionEmail({ user: promoted.user, event: promoted.event, ticketCode: promoted.ticketCode }).catch(() => {});
      }
      notifyUser(promoted.user, { type: "promotion", title: promoted.event?.title || "Event", message: `You were promoted from the waitlist for ${promoted.event?.title || "the event"}.`, link: `/events/${eventId}`, sourceType: "Event", sourceId: eventId, metadata: { ticketCode: promoted.ticketCode } }).catch(() => {});
      await recordAudit({ req, action: "registration.waitlist.promote", entityType: "Registration", entityId: promoted._id, title: promoted.event?.title || "Event", metadata: { promotedFrom: "waitlist" } });
      clearCache("admin:");
    }

    const realtime = await buildRealtimePayload(eventId);
    emitToEvent(eventId, "waitlist:update", realtime);
    emitToEvent(eventId, "registration:update", realtime);
    emitToAdmins("dashboard:update", { type: "registration", ...realtime });
    res.json({ message: "Registration cancelled ❌", registration, promoted });
  } catch (error) {
    console.log("CANCEL ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
