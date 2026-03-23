const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

/* ================= ENSURE UPLOAD FOLDERS EXIST ================= */
const PDF_DIR = "uploads/pdfs";
const VIDEO_DIR = "uploads/videos";

if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

/* ================= GET LESSONS BY MODULE ================= */
router.get("/module/:moduleId", verifyToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const userId = req.user.id;

    /* ================= GET COURSE ACCESS TYPE ================= */
    const courseResult = await pool.query(
      `
      SELECT c.id, c.access_type
      FROM modules m
      JOIN courses c ON m.course_id = c.id
      WHERE m.id = $1
      `,
      [moduleId]
    );

    if (!courseResult.rows.length) {
      return res.status(404).json({ error: "Module not found" });
    }

    const { id: courseId, access_type } = courseResult.rows[0];

    /* ================= ACCESS CONTROL ================= */

    if (access_type === "paid") {
      const purchaseCheck = await pool.query(
        `
        SELECT 1 FROM user_courses
        WHERE user_id = $1 AND course_id = $2
        `,
        [userId, courseId]
      );

      if (!purchaseCheck.rows.length) {
        return res.status(403).json({ error: "Course purchase required" });
      }
    }

    if (access_type === "pro") {
      const subCheck = await pool.query(
        `
        SELECT 1 FROM user_subscriptions
        WHERE user_id = $1
        AND status = 'active'
        AND end_date > NOW()
        `,
        [userId]
      );

      if (!subCheck.rows.length) {
        return res.status(403).json({ error: "Pro subscription required" });
      }
    }

    /* ================= GET LESSONS ================= */

    const result = await pool.query(
      `
      SELECT id, title, content_type, content_url, pdf_url, video_url, sort_order
      FROM lessons
      WHERE module_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [moduleId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("Get lessons error:", err);
    res.status(500).json({ error: "Failed to load lessons" });
  }
});


/* ================= CREATE LESSON ================= */
router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const { module_id, title, content_type, content_url } = req.body;

    if (!module_id || !title || !content_type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const orderResult = await pool.query(
      "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM lessons WHERE module_id = $1",
      [module_id]
    );

    const sort_order = orderResult.rows[0].next_order;

    const result = await pool.query(
      `
      INSERT INTO lessons
        (module_id, title, content_type, content_url, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [module_id, title, content_type, content_url || null, sort_order]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error("Create lesson error:", err);
    res.status(500).json({ error: "Failed to create lesson" });
  }
});

/* ================= DELETE LESSON ================= */
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM lessons WHERE id = $1", [req.params.id]);
    res.json({ message: "Lesson deleted" });
  } catch (err) {
    console.error("Delete lesson error:", err);
    res.status(500).json({ error: "Failed to delete lesson" });
  }
});



/* ============================================================= */
/* ========================= PDF UPLOAD ======================== */
/* ============================================================= */

const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PDF_DIR),
  filename: (req, file, cb) => {
    const unique =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const uploadPdf = multer({
  storage: pdfStorage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.includes("pdf")) {
      return cb(new Error("Only PDF files allowed"));
    }
    cb(null, true);
  }
});

/* ================= UPLOAD LESSON PDF ================= */
router.post(
  "/:id/pdf",
  verifyToken,
  isAdmin,
  uploadPdf.single("pdf"),
  async (req, res) => {
    try {
      const lessonId = req.params.id;

      if (!req.file) {
        return res.status(400).json({ error: "No PDF uploaded" });
      }

      const pdfUrl = "/uploads/pdfs/" + req.file.filename;

      await pool.query(
        `
        UPDATE lessons
        SET pdf_url = $1
        WHERE id = $2
        `,
        [pdfUrl, lessonId]
      );

      res.json({
        success: true,
        pdf_url: pdfUrl
      });

    } catch (err) {
      console.error("PDF upload error:", err);
      res.status(500).json({ error: "PDF upload failed" });
    }
  }
);



/* ============================================================= */
/* ======================== VIDEO UPLOAD ======================= */
/* ============================================================= */

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEO_DIR),
  filename: (req, file, cb) => {
    const unique =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

/* ================= UPLOAD LESSON VIDEO ================= */
router.post(
  "/:id/video",
  verifyToken,
  isAdmin,
  uploadVideo.single("video"),
  async (req, res) => {
    try {
      const lessonId = req.params.id;

      if (!req.file) {
        return res.status(400).json({ error: "No video uploaded" });
      }

      const videoUrl = "/uploads/videos/" + req.file.filename;

      await pool.query(
        `
        UPDATE lessons
        SET video_url = $1
        WHERE id = $2
        `,
        [videoUrl, lessonId]
      );

      res.json({
        success: true,
        video_url: videoUrl
      });

    } catch (err) {
      console.error("Video upload error:", err);
      res.status(500).json({ error: "Video upload failed" });
    }
  }
);

module.exports = router;
