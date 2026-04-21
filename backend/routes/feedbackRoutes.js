const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const EventFeedback = require("../models/EventFeedback");
const Event = require("../models/Event");
const { protect } = require("../middleware/authMiddleware");

router.get("/me/all", protect, async (req, res) => {
  try {
    const items = await EventFeedback.find({ user: req.user._id })
      .populate("event", "title date venue category status")
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    console.log("FEEDBACK ME ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:eventId", async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).select("title status category venue");
    if (!event) return res.status(404).json({ message: "Event not found" });

    const objectId = new mongoose.Types.ObjectId(req.params.eventId);
    const [feedbacks, aggregate] = await Promise.all([
      EventFeedback.find({ event: req.params.eventId })
        .populate("user", "name role department year")
        .sort({ createdAt: -1 })
        .limit(30),
      EventFeedback.aggregate([
        { $match: { event: objectId } },
        { $group: { _id: "$event", averageRating: { $avg: "$rating" }, total: { $sum: 1 } } },
      ]),
    ]);

    const summary = aggregate[0] || { averageRating: 0, total: 0 };
    res.json({
      event,
      averageRating: Number(summary.averageRating || 0).toFixed(1),
      total: summary.total || 0,
      feedbacks,
    });
  } catch (error) {
    console.log("FEEDBACK GET ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:eventId", protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const cleanRating = Number(rating);
    if (!Number.isFinite(cleanRating) || cleanRating < 1 || cleanRating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const event = await Event.findById(req.params.eventId);
    if (!event || event.isArchived) return res.status(404).json({ message: "Event not found" });

    const payload = {
      rating: cleanRating,
      comment: String(comment || "").trim().slice(0, 500),
    };

    const existing = await EventFeedback.findOne({ event: req.params.eventId, user: req.user._id });
    if (existing) {
      existing.rating = payload.rating;
      existing.comment = payload.comment;
      await existing.save();
      return res.json({ message: "Feedback updated", feedback: existing });
    }

    const feedback = await EventFeedback.create({
      event: req.params.eventId,
      user: req.user._id,
      rating: payload.rating,
      comment: payload.comment,
    });

    res.status(201).json({ message: "Feedback saved", feedback });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: "Feedback already exists" });
    console.log("FEEDBACK POST ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
