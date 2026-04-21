const Notification = require("../models/Notification");
const NotificationPreference = require("../models/NotificationPreference");
const { emitToEvent, emitToAdmins, emitToUser } = require("./socket");

const normalizeUsers = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.flatMap((item) => normalizeUsers(item));
  if (typeof input === "object" && input._id) return [input];
  return [];
};

const buildPayload = ({ user, type = "system", title, message, link = "", sourceType = "", sourceId = "", metadata = {}, expiresAt = null }) => ({
  user: user._id || user,
  type,
  title,
  message,
  link,
  sourceType,
  sourceId: String(sourceId || ""),
  metadata,
  expiresAt,
});

const getPreferences = async (userId) => {
  if (!userId) return null;
  return NotificationPreference.findOne({ user: userId }).lean();
};

const isMuted = async (userId, type, channel = "inApp") => {
  const prefs = await getPreferences(userId);
  if (!prefs) return false;
  if (channel === "email" && prefs.emailEnabled === false) return true;
  if (channel === "email" && String(type || "").toLowerCase() === "digest" && prefs.digestEnabled === false) return true;
  if (channel === "inApp" && prefs.inAppEnabled === false) return true;
  const mutedTypes = Array.isArray(prefs.mutedTypes) ? prefs.mutedTypes.map((item) => String(item).toLowerCase()) : [];
  return mutedTypes.includes(String(type || "system").toLowerCase());
};

const emitNotification = (notification, userId) => {
  emitToUser(userId || notification.user, "notification:new", notification);
  if (notification.type === "announcement") {
    emitToAdmins("dashboard:update", { type: "notification", action: "announcement" });
  }
};

const createNotification = async (payload) => {
  const users = normalizeUsers(payload.user || payload.users);
  if (!users.length) return [];

  const filteredUsers = [];
  for (const user of users) {
    const userId = user._id || user;
    if (!(await isMuted(userId, payload.type, "inApp"))) filteredUsers.push(user);
  }
  if (!filteredUsers.length) return [];

  const docs = await Notification.insertMany(filteredUsers.map((user) => buildPayload({ ...payload, user })));
  docs.forEach((doc) => emitNotification(doc.toObject ? doc.toObject() : doc, doc.user));
  return docs;
};

const createEventNotification = async (eventId, payload, users = []) => {
  const docs = await createNotification({ ...payload, users, sourceType: "Event", sourceId: String(eventId) });
  if (eventId) {
    emitToEvent(eventId, "notification:new", { eventId: String(eventId), type: payload.type, title: payload.title });
  }
  return docs;
};

const notifyUser = async (user, payload) => createNotification({ ...payload, users: [user] });

const shouldSendEmail = async (userId, type = "system") => !await isMuted(userId, type, "email");

module.exports = { createNotification, createEventNotification, notifyUser, getPreferences, isMuted, shouldSendEmail };
