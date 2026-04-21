const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const NotificationPreference = require("../models/NotificationPreference");

const DEFAULT_PREFS = {
  inAppEnabled: true,
  emailEnabled: true,
  digestEnabled: true,
  mutedTypes: [],
};

const normalizeTypes = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)));
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index);
};

const serialize = (doc) => ({
  inAppEnabled: doc?.inAppEnabled ?? DEFAULT_PREFS.inAppEnabled,
  emailEnabled: doc?.emailEnabled ?? DEFAULT_PREFS.emailEnabled,
  digestEnabled: doc?.digestEnabled ?? DEFAULT_PREFS.digestEnabled,
  mutedTypes: Array.isArray(doc?.mutedTypes) ? doc.mutedTypes : DEFAULT_PREFS.mutedTypes,
});

router.get("/notifications", protect, async (req, res) => {
  try {
    let prefs = await NotificationPreference.findOne({ user: req.user._id });
    if (!prefs) {
      prefs = await NotificationPreference.create({ user: req.user._id, ...DEFAULT_PREFS });
    }
    res.json({ preferences: serialize(prefs) });
  } catch (error) {
    console.log("PREF GET ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/notifications", protect, async (req, res) => {
  try {
    const payload = {
      inAppEnabled: req.body.inAppEnabled !== undefined ? Boolean(req.body.inAppEnabled) : undefined,
      emailEnabled: req.body.emailEnabled !== undefined ? Boolean(req.body.emailEnabled) : undefined,
      digestEnabled: req.body.digestEnabled !== undefined ? Boolean(req.body.digestEnabled) : undefined,
      mutedTypes: req.body.mutedTypes !== undefined ? normalizeTypes(req.body.mutedTypes) : undefined,
    };

    const update = {};
    Object.keys(payload).forEach((key) => {
      if (payload[key] !== undefined) update[key] = payload[key];
    });

    const prefs = await NotificationPreference.findOneAndUpdate(
      { user: req.user._id },
      { $set: update, $setOnInsert: { user: req.user._id, ...DEFAULT_PREFS } },
      { new: true, upsert: true }
    );

    res.json({ message: "Notification preferences updated", preferences: serialize(prefs) });
  } catch (error) {
    console.log("PREF UPDATE ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
