const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["system", "announcement", "registration", "waitlist", "promotion", "volunteer", "certificate", "reminder", "event", "security"],
      default: "system",
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    link: { type: String, trim: true, default: "" },
    sourceType: { type: String, trim: true, default: "" },
    sourceId: { type: String, trim: true, default: "" },
    metadata: { type: Object, default: {} },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
