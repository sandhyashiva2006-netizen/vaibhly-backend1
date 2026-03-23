const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

/* ===== Storage Config ===== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/videos");
  },
  filename: (req, file, cb) => {
    const unique =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

/* ===== File Filter ===== */
function fileFilter(req, file, cb) {
  if (!file.mimetype.startsWith("video/")) {
    return cb(new Error("Only video files allowed"), false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1024 * 1024 * 500 } // 500MB
});

/* ===== Upload Route ===== */
router.post(
  "/video",
  verifyToken,
  isAdmin,
  upload.single("video"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const videoUrl = `/uploads/videos/${req.file.filename}`;
    res.json({ videoUrl });
  }
);

module.exports = router;
