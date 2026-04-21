const Event = require("../models/Event");
const Registration = require("../models/Registration");
const Notification = require("../models/Notification");
const MaintenanceRun = require("../models/MaintenanceRun");
const { createNotification, shouldSendEmail, getPreferences } = require("./notificationService");
const { sendReminderEmail, sendDigestEmail } = require("./emailService");
const { shouldSendToEmail, canSendBulkEmail, getEmailBulkCap } = require("./emailPolicy");
const { emitToAdmins } = require("./socket");
const { clearCache } = require("./cache");
const logger = require("./logger");

const REMINDER_WINDOWS = [
  { label: "24h", ms: 24 * 60 * 60 * 1000 },
  { label: "1h", ms: 60 * 60 * 1000 },
];

const state = {
  running: false,
  lastRunAt: null,
  lastReason: "startup",
  lastDurationMs: 0,
  lastSummary: { updatedEvents: 0, reminderNotifications: 0, reminderEmails: 0, digestNotifications: 0, digestEmails: 0, cleanedNotifications: 0 },
  nextRunAt: null,
};

let intervalHandle = null;

const toISO = (value) => (value ? new Date(value).toISOString() : null);

const syncEventLifecycle = async (now) => {
  const events = await Event.find({ isArchived: { $ne: true }, status: { $nin: ["cancelled", "completed"] } });
  let updatedEvents = 0;

  for (const event of events) {
    const currentStatus = String(event.status || "").toLowerCase();
    if (currentStatus === "draft") continue;
    const date = event.date ? new Date(event.date) : null;
    const endDate = event.endDate ? new Date(event.endDate) : null;
    let nextStatus = event.status;

    if (endDate && endDate <= now) {
      nextStatus = "completed";
    } else if (date && date <= now) {
      nextStatus = "live";
    } else if (["published", "live"].includes(currentStatus) || !event.status || currentStatus === "upcoming") {
      nextStatus = "upcoming";
    }

    if (nextStatus !== event.status) {
      event.status = nextStatus;
      await event.save();
      updatedEvents += 1;
    }
  }

  return updatedEvents;
};

const alreadySentReminder = async ({ userId, eventId, label }) => Notification.exists({
  user: userId,
  type: "reminder",
  sourceType: "Event",
  sourceId: String(eventId),
  "metadata.reminderWindow": label,
});

const sendReminders = async (now) => {
  let reminderNotifications = 0;
  let reminderEmails = 0;
  const emailCap = getEmailBulkCap();
  let emailsSentThisRun = 0;

  for (const { label, ms } of REMINDER_WINDOWS) {
    const windowStart = new Date(now.getTime());
    const windowEnd = new Date(now.getTime() + ms);
    const events = await Event.find({
      isArchived: { $ne: true },
      status: { $in: ["upcoming", "published", "live"] },
      date: { $gte: windowStart, $lte: windowEnd },
    }).select("title date venue category status organizerName speakerName speakerRole posterUrl imageUrl");

    for (const event of events) {
      const registrations = await Registration.find({ event: event._id, status: "confirmed" })
        .populate("user", "name email role department year")
        .lean();

      for (const registration of registrations) {
        const user = registration.user;
        if (!user?._id) continue;
        if (await alreadySentReminder({ userId: user._id, eventId: event._id, label })) continue;

        const title = `Reminder: ${event.title} starts ${label}`;
        const message = `${event.title} is coming up ${label === "1h" ? "within the hour" : "tomorrow"}.`;

        await createNotification({
          users: [user],
          type: "reminder",
          title,
          message,
          link: `/events/${event._id}`,
          sourceType: "Event",
          sourceId: event._id,
          metadata: { reminderWindow: label, hoursAhead: label === "24h" ? 24 : 1, scheduledFor: toISO(event.date) },
        });
        reminderNotifications += 1;

        if (await shouldSendEmail(user._id, "reminder") && shouldSendToEmail(user.email) && emailsSentThisRun < emailCap && canSendBulkEmail(emailCap)) {
          await sendReminderEmail({ user, event, hoursAhead: label === "24h" ? 24 : 1 });
          reminderEmails += 1;
          emailsSentThisRun += 1;
        }
      }
    }
  }

  return { reminderNotifications, reminderEmails };
};

const sendDigests = async (now) => {
  const cutoff = new Date(now.getTime() - 1000 * 60 * 60 * 24);
  const emailCap = getEmailBulkCap();
  let emailsSentThisRun = 0;
  const notifications = await Notification.find({ isRead: false, createdAt: { $gte: cutoff } })
    .populate("user", "name email role department year")
    .sort({ createdAt: -1 })
    .limit(500);

  const grouped = new Map();
  for (const item of notifications) {
    const user = item.user;
    if (!user?._id) continue;
    if (!(await shouldSendEmail(user._id, "digest"))) continue;
    if (!grouped.has(String(user._id))) grouped.set(String(user._id), { user, notifications: [] });
    grouped.get(String(user._id)).notifications.push({
      type: item.type,
      title: item.title,
      message: item.message,
      createdAt: item.createdAt,
    });
  }

  let digestNotifications = 0;
  let digestEmails = 0;
  for (const { user, notifications: userNotifications } of grouped.values()) {
    if (!userNotifications.length) continue;
    digestNotifications += userNotifications.length;
    if (!shouldSendToEmail(user.email) || emailsSentThisRun >= emailCap || !canSendBulkEmail(emailCap)) continue;
    try {
      await sendDigestEmail({ user, notifications: userNotifications });
      digestEmails += 1;
      emailsSentThisRun += 1;
    } catch (error) {
      logger.warn("Digest email failed", { userId: String(user._id), message: error.message });
    }
  }

  return { digestNotifications, digestEmails };
};

const cleanupNotifications = async (now) => {
  const expiryCutoff = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 90);
  const result = await Notification.deleteMany({
    $or: [
      { expiresAt: { $lt: now } },
      { isRead: true, createdAt: { $lt: expiryCutoff } },
    ],
  });
  return result.deletedCount || 0;
};

const persistRun = async ({ reason, startedAt, summary, status, error = "" }) => {
  try {
    await MaintenanceRun.create({
      reason,
      status,
      startedAt: new Date(startedAt),
      finishedAt: new Date(),
      durationMs: Date.now() - startedAt,
      summary,
      error,
    });
  } catch (err) {
    logger.warn("Unable to persist maintenance run", { message: err.message });
  }
};

const runMaintenanceSweep = async (reason = "scheduled") => {
  if (state.running) return { ...state, skipped: true };
  state.running = true;
  const startedAt = Date.now();
  try {
    const now = new Date();
    const [updatedEvents, reminders, digests, cleanedNotifications] = await Promise.all([
      syncEventLifecycle(now),
      sendReminders(now),
      sendDigests(now),
      cleanupNotifications(now),
    ]);

    const summary = {
      updatedEvents,
      reminderNotifications: reminders.reminderNotifications,
      reminderEmails: reminders.reminderEmails,
      digestNotifications: digests.digestNotifications,
      digestEmails: digests.digestEmails,
      cleanedNotifications,
    };

    state.lastRunAt = toISO(now);
    state.lastReason = reason;
    state.lastDurationMs = Date.now() - startedAt;
    state.lastSummary = summary;
    clearCache("admin:");
    emitToAdmins("dashboard:update", { type: "maintenance", reason, summary, lastRunAt: state.lastRunAt });
    await persistRun({ reason, startedAt, summary, status: "success" });
    return { ...state, running: false };
  } catch (error) {
    logger.error("Maintenance sweep failed", { message: error.message, stack: error.stack });
    state.lastRunAt = toISO(new Date());
    state.lastReason = `${reason}:error`;
    state.lastDurationMs = Date.now() - startedAt;
    const summary = { ...state.lastSummary };
    await persistRun({ reason, startedAt, summary, status: "error", error: error.message });
    return { ...state, running: false, error: error.message };
  } finally {
    state.running = false;
  }
};

const initMaintenanceJobs = () => {
  if (intervalHandle) return state;
  const intervalMs = Math.max(Number(process.env.MAINTENANCE_INTERVAL_MS || 15 * 60 * 1000), 5 * 60 * 1000);
  state.nextRunAt = toISO(Date.now() + intervalMs);
  intervalHandle = setInterval(async () => {
    state.nextRunAt = toISO(Date.now() + intervalMs);
    await runMaintenanceSweep("scheduled");
  }, intervalMs);
  if (typeof intervalHandle.unref === "function") intervalHandle.unref();
  runMaintenanceSweep("startup").catch((error) => logger.error("Startup maintenance error", { message: error.message }));
  return state;
};

const getMaintenanceState = () => ({ ...state });

const getMaintenanceRuns = async (limit = 20) => {
  const runs = await MaintenanceRun.find().sort({ createdAt: -1 }).limit(Math.max(1, Number(limit) || 20));
  return runs;
};

module.exports = { initMaintenanceJobs, runMaintenanceSweep, getMaintenanceState, getMaintenanceRuns };
