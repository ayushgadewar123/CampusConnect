const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    endDate: { type: Date, default: null },
    venue: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: "General" },
    subcategory: { type: String, trim: true, default: "" },
    mode: { type: String, enum: ["offline", "online", "hybrid"], default: "offline" },
    status: {
      type: String,
      enum: ["draft", "published", "upcoming", "live", "completed", "cancelled"],
      default: "upcoming",
    },
    featured: { type: Boolean, default: false },
    approvalRequired: { type: Boolean, default: false },
    capacity: { type: Number, min: 0, default: null },
    waitlistCapacity: { type: Number, min: 0, default: 0 },
    views: { type: Number, min: 0, default: 0 },
    organizerName: { type: String, trim: true, default: "" },
    speakerName: { type: String, trim: true, default: "" },
    speakerRole: { type: String, trim: true, default: "" },
    schedule: { type: String, trim: true, default: "" },
    rules: { type: String, trim: true, default: "" },
    certificateEnabled: { type: Boolean, default: true },
    certificateTemplateUrl: { type: String, trim: true, default: "" },
    tags: { type: [String], default: [] },
    attachments: { type: [String], default: [] },
    imageUrl: { type: String, trim: true, default: "" },
    posterUrl: { type: String, trim: true, default: "" },
    locationUrl: { type: String, trim: true, default: "" },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
