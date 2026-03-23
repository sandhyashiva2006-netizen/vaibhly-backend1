const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

/* ================= MULTER CONFIG ================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, "uploads/pdfs");
    } else {
      cb(null, "uploads/videos");
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

/* ================= UPLOAD CONTENT (ADMIN) ================= */
router.post(
  "/admin/upload",
  verifyToken,
  isAdmin,
  upload.single("file"),
  async (req, res) => {
    try {
      const { course_id, title, content_type } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "File required" });
      }

      const result = await pool.query(
        `INSERT INTO course_content (course_id, title, content_type, file_path)
         VALUES ($1,$2,$3,$4)
         RETURNING *`,
        [course_id, title, content_type, req.file.path]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

/* ================= GET CONTENT (STUDENT) ================= */
router.get("/:courseId", verifyToken, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM course_content WHERE course_id=$1 ORDER BY created_at DESC",
    [req.params.courseId]
  );
  res.json(result.rows);
});

module.exports = router;
