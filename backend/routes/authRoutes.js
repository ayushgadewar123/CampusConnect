const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");
const { authLimiter, sensitiveActionLimiter } = require("../middleware/rateLimiters");

const signAccessToken = (userId, tokenVersion = 0) =>
  jwt.sign({ id: userId, tv: tokenVersion, kind: "access" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });

const signRefreshToken = (userId, tokenVersion = 0) =>
  jwt.sign({ id: userId, tv: tokenVersion, kind: "refresh" }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });

const hashToken = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

const cleanList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const generateDemoEmail = (fullName = "demo") => {
  const base = String(fullName || "demo")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24) || "demo";
  const stamp = Date.now().toString(36);
  const salt = crypto.randomBytes(3).toString("hex");
  return `${base}.${stamp}.${salt}@campusconnect.local`;
};

const buildUserPayload = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department || "",
  year: user.year || "",
  phone: user.phone || "",
  interests: Array.isArray(user.interests) ? user.interests : [],
  skills: Array.isArray(user.skills) ? user.skills : [],
  bio: user.bio || "",
  profileImage: user.profileImage || "",
  emailVerified: Boolean(user.emailVerified),
});

const issueTokens = async (user) => {
  const accessToken = signAccessToken(user._id, user.refreshTokenVersion || 0);
  const refreshToken = signRefreshToken(user._id, user.refreshTokenVersion || 0);
  user.refreshTokenHash = hashToken(refreshToken);
  user.refreshTokenIssuedAt = new Date();
  await user.save();
  return { accessToken, refreshToken };
};

router.post("/register", authLimiter, async (req, res) => {
  try {
    const { name, email, password, department, year, phone, interests, skills } = req.body;
    if (!name || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const cleanName = String(name).trim();
    const cleanPassword = String(password);
    const rawEmail = String(email || "").trim().toLowerCase();
    const shouldGenerateDemoEmail = !rawEmail || !rawEmail.includes("@") || !rawEmail.includes(".");
    let cleanEmail = shouldGenerateDemoEmail ? generateDemoEmail(cleanName) : rawEmail;

    if (!cleanName || !cleanPassword) {
      return res.status(400).json({ message: "Fields cannot be empty" });
    }
    if (cleanPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    let existingUser = await User.findOne({ email: cleanEmail });
    if (shouldGenerateDemoEmail) {
      let attempts = 0;
      while (existingUser && attempts < 5) {
        cleanEmail = generateDemoEmail(cleanName);
        existingUser = await User.findOne({ email: cleanEmail });
        attempts += 1;
      }
    }

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);
    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      role: "student",
      department: String(department || "").trim(),
      year: String(year || "").trim(),
      phone: String(phone || "").trim(),
      interests: cleanList(interests),
      skills: cleanList(skills),
      emailVerified: true,
      emailVerificationToken: "",
      emailVerificationExpires: null,
      passwordResetToken: "",
      passwordResetExpires: null,
    });

    const { accessToken, refreshToken } = await issueTokens(user);

    res.status(201).json({
      message: shouldGenerateDemoEmail ? "Account created successfully. A demo email was generated." : "Account created successfully.",
      demoEmailGenerated: shouldGenerateDemoEmail,
      token: accessToken,
      refreshToken,
      user: buildUserPayload(user),
    });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: "User already exists" });
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "All fields are required" });

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password);
    if (!cleanEmail || !cleanPassword) return res.status(400).json({ message: "Fields cannot be empty" });

    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(cleanPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const { accessToken, refreshToken } = await issueTokens(user);
    res.json({ message: "Login successful", token: accessToken, refreshToken, user: buildUserPayload(user) });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/refresh", authLimiter, async (req, res) => {
  try {
    const token = req.body.refreshToken || req.headers["x-refresh-token"];
    if (!token) return res.status(401).json({ message: "Refresh token required" });

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    if (decoded.kind !== "refresh") return res.status(401).json({ message: "Invalid refresh token" });

    const user = await User.findById(decoded.id);
    if (!user || !user.refreshTokenHash || user.refreshTokenHash !== hashToken(token)) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const accessToken = signAccessToken(user._id, user.refreshTokenVersion || 0);
    res.json({ token: accessToken, user: buildUserPayload(user) });
  } catch (error) {
    console.log("REFRESH ERROR:", error.message);
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

const demoEmailDisabled = (message) => (req, res) => res.status(410).json({ message });
router.post("/resend-verification", authLimiter, demoEmailDisabled("Email verification is disabled in demo mode. Accounts are auto-verified."));
router.post("/verify-email", authLimiter, demoEmailDisabled("Email verification is disabled in demo mode. Accounts are auto-verified."));
router.post("/forgot-password", sensitiveActionLimiter, demoEmailDisabled("Password reset by email is disabled in demo mode."));
router.post("/reset-password", sensitiveActionLimiter, demoEmailDisabled("Password reset by email is disabled in demo mode."));

router.get("/me", protect, async (req, res) => {
  res.json({ user: buildUserPayload(req.user) });
});

router.patch("/me", protect, async (req, res) => {
  try {
    const payload = {
      name: String(req.body.name || req.user.name).trim(),
      department: String(req.body.department ?? req.user.department ?? "").trim(),
      year: String(req.body.year ?? req.user.year ?? "").trim(),
      phone: String(req.body.phone ?? req.user.phone ?? "").trim(),
      bio: String(req.body.bio ?? req.user.bio ?? "").trim(),
      profileImage: String(req.body.profileImage ?? req.user.profileImage ?? "").trim(),
      interests: cleanList(req.body.interests ?? req.user.interests),
      skills: cleanList(req.body.skills ?? req.user.skills),
    };

    req.user.name = payload.name || req.user.name;
    req.user.department = payload.department;
    req.user.year = payload.year;
    req.user.phone = payload.phone;
    req.user.bio = payload.bio;
    req.user.profileImage = payload.profileImage;
    req.user.interests = payload.interests;
    req.user.skills = payload.skills;

    await req.user.save();
    res.json({ message: "Profile updated successfully", user: buildUserPayload(req.user) });
  } catch (error) {
    console.log("PROFILE UPDATE ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/logout", protect, async (req, res) => {
  req.user.refreshTokenHash = "";
  req.user.refreshTokenIssuedAt = null;
  await req.user.save();
  res.json({ message: "Logged out successfully" });
});

router.post("/logout-all", protect, async (req, res) => {
  req.user.refreshTokenHash = "";
  req.user.refreshTokenIssuedAt = null;
  req.user.refreshTokenVersion = (req.user.refreshTokenVersion || 0) + 1;
  await req.user.save();
  res.json({ message: "Signed out from all devices" });
});

module.exports = router;
