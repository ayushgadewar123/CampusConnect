const express = require("express");
const router = express.Router();

const VolunteerAssignment = require("../models/VolunteerAssignment");
const Event = require("../models/Event");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { canManageEvent } = require("../middleware/roleMiddleware");
const { createNotification } = require("../services/notificationService");

router.get("/me", protect, async (req, res) => {
  try {
    const assignments = await VolunteerAssignment.find({ volunteer: req.user._id })
      .populate("event", "title date venue status category posterUrl imageUrl")
      .populate("assignedBy", "name role")
      .sort({ createdAt: -1 });
    res.json({ assignments });
  } catch (error) {
    console.log("VOLUNTEER ME ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/event/:eventId", protect, canManageEvent, async (req, res) => {
  try {
    const assignments = await VolunteerAssignment.find({ event: req.params.eventId })
      .populate("volunteer", "name email role department year")
      .populate("assignedBy", "name role")
      .sort({ createdAt: -1 });
    res.json({ assignments });
  } catch (error) {
    console.log("VOLUNTEER EVENT ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/event/:eventId", protect, canManageEvent, async (req, res) => {
  try {
    const { volunteerId, taskTitle, details, dueAt } = req.body;
    if (!volunteerId || !taskTitle) return res.status(400).json({ message: "Volunteer and task title are required" });

    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const assignment = await VolunteerAssignment.create({
      event: event._id,
      volunteer: volunteerId,
      taskTitle: String(taskTitle).trim(),
      details: String(details || "").trim(),
      dueAt: dueAt ? new Date(dueAt) : null,
      assignedBy: req.user._id,
    });

    await createNotification({
      users: [volunteerId],
      type: "volunteer",
      title: `Assigned: ${taskTitle}`,
      message: `You have a volunteer task for ${event.title}.`,
      link: `/volunteer`,
      sourceType: "VolunteerAssignment",
      sourceId: assignment._id,
      metadata: { eventId: String(event._id), dueAt: assignment.dueAt },
    }).catch(() => {});

    res.status(201).json({ message: "Volunteer assigned", assignment });
  } catch (error) {
    console.log("VOLUNTEER ASSIGN ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:assignmentId", protect, async (req, res) => {
  try {
    const assignment = await VolunteerAssignment.findById(req.params.assignmentId);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });

    if (String(assignment.volunteer) !== String(req.user._id) && !["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (req.body.status) assignment.status = req.body.status;
    if (req.body.completedAt) assignment.completedAt = new Date(req.body.completedAt);
    if (req.body.details !== undefined) assignment.details = String(req.body.details || "").trim();
    if (assignment.status === "completed" && !assignment.completedAt) assignment.completedAt = new Date();
    await assignment.save();

    await createNotification({
      users: [assignment.assignedBy],
      type: "volunteer",
      title: `Volunteer update: ${assignment.taskTitle}`,
      message: `${req.user.name || "A volunteer"} updated task status to ${assignment.status}.`,
      link: `/volunteer`,
      sourceType: "VolunteerAssignment",
      sourceId: assignment._id,
      metadata: { status: assignment.status, eventId: String(assignment.event) },
    }).catch(() => {});

    res.json({ message: "Assignment updated", assignment });
  } catch (error) {
    console.log("VOLUNTEER UPDATE ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:assignmentId", protect, adminOnly, async (req, res) => {
  try {
    const assignment = await VolunteerAssignment.findByIdAndDelete(req.params.assignmentId);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    res.json({ message: "Assignment removed" });
  } catch (error) {
    console.log("VOLUNTEER DELETE ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
