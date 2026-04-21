const mongoose = require("mongoose");

const volunteerAssignmentSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    volunteer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    taskTitle: { type: String, required: true, trim: true },
    details: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["assigned", "in_progress", "completed"], default: "assigned" },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    dueAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VolunteerAssignment", volunteerAssignmentSchema);
