const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

feedbackSchema.index({ event: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("EventFeedback", feedbackSchema);
