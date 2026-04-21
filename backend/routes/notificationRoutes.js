const express = require("express");
const router = express.Router();

const Notification = require("../models/Notification");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, async (req, res) => {
  try {
    const unreadOnly = String(req.query.unreadOnly || "false") === "true";
    const query = { user: req.user._id };
    if (unreadOnly) query.isRead = false;

    const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(80);
    const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });
    res.json({ notifications, unreadCount });
  } catch (error) {
    console.log("NOTIFICATION LIST ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/read", protect, async (req, res) => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
    res.json({ message: "Notification marked as read", notification });
  } catch (error) {
    console.log("NOTIFICATION READ ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/read-all", protect, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.log("NOTIFICATION READ ALL ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json({ message: "Notification removed" });
  } catch (error) {
    console.log("NOTIFICATION DELETE ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
