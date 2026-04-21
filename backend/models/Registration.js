const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    status: { type: String, enum: ["confirmed", "waitlisted", "cancelled"], default: "confirmed" },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },
    ticketCode: { type: String, trim: true, default: "" },
    certificateCode: { type: String, trim: true, default: "" },
    waitlistPosition: { type: Number, min: 0, default: 0 },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

registrationSchema.index({ user: 1, event: 1 }, { unique: true });

module.exports = mongoose.model("Registration", registrationSchema);
