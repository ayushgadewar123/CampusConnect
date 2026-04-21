const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Event = require("../models/Event");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({ path: "wishlist", populate: { path: "createdBy", select: "name role" } })
      .select("wishlist");
    res.json({ wishlist: user?.wishlist || [] });
  } catch (error) {
    console.log("WISHLIST GET ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:eventId", protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).select("_id title isArchived status");
    if (!event || event.isArchived) return res.status(404).json({ message: "Event not found" });

    const user = await User.findById(req.user._id);
    const alreadySaved = (user.wishlist || []).some((item) => String(item) === String(event._id));
    if (alreadySaved) {
      user.wishlist = (user.wishlist || []).filter((item) => String(item) !== String(event._id));
      await user.save();
      return res.json({ message: "Removed from wishlist", saved: false, wishlist: user.wishlist });
    }

    user.wishlist = Array.from(new Set([...(user.wishlist || []).map(String), String(event._id)])).slice(0, 100);
    await user.save();
    res.status(201).json({ message: "Added to wishlist", saved: true, wishlist: user.wishlist });
  } catch (error) {
    console.log("WISHLIST POST ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:eventId", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.wishlist = (user.wishlist || []).filter((item) => String(item) !== String(req.params.eventId));
    await user.save();
    res.json({ message: "Removed from wishlist", wishlist: user.wishlist });
  } catch (error) {
    console.log("WISHLIST DELETE ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
