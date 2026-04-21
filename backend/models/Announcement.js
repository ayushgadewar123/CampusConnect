const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    audience: { type: String, enum: ["all", "students", "admins", "coordinators", "volunteers", "event_participants"], default: "all" },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null },
    isPinned: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
    sendEmail: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Announcement", announcementSchema);
