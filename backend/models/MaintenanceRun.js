const mongoose = require("mongoose");

const maintenanceRunSchema = new mongoose.Schema(
  {
    reason: { type: String, trim: true, default: "scheduled" },
    status: { type: String, enum: ["running", "success", "error"], default: "running" },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
    summary: {
      updatedEvents: { type: Number, default: 0 },
      reminderNotifications: { type: Number, default: 0 },
      reminderEmails: { type: Number, default: 0 },
      digestNotifications: { type: Number, default: 0 },
      digestEmails: { type: Number, default: 0 },
      cleanedNotifications: { type: Number, default: 0 },
    },
    error: { type: String, trim: true, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

maintenanceRunSchema.index({ createdAt: -1 });

module.exports = mongoose.model("MaintenanceRun", maintenanceRunSchema);
