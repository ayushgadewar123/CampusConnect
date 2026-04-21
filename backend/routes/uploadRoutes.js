const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { upload, toPublicUrl } = require("../services/uploadService");

router.post("/image", protect, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const url = toPublicUrl(req, req.file);
    res.status(201).json({ message: "Upload successful", url, filename: req.file.filename });
  } catch (error) {
    console.log("UPLOAD ERROR:", error.message);
    res.status(500).json({ message: error.message || "Upload failed" });
  }
});

module.exports = router;
