const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, default: "student", enum: ["student", "admin", "coordinator", "super_admin", "volunteer"] },
    department: { type: String, trim: true, default: "" },
    year: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    interests: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    badges: { type: [String], default: [] },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
    bio: { type: String, trim: true, default: "" },
    profileImage: { type: String, trim: true, default: "" },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: "" },
    emailVerificationExpires: { type: Date, default: null },
    passwordResetToken: { type: String, default: "" },
    passwordResetExpires: { type: Date, default: null },
    refreshTokenHash: { type: String, default: "" },
    refreshTokenIssuedAt: { type: Date, default: null },
    refreshTokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
