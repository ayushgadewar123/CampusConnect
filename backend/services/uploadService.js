const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image uploads are allowed"));
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 6 * 1024 * 1024 } });

const toPublicUrl = (req, file) => {
  const base = `${req.protocol}://${req.get("host")}`;
  return `${base}/uploads/${file.filename}`;
};

module.exports = { upload, toPublicUrl, uploadDir };
