const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth.middleware");
const { isInstructor, isAdminOnly } = require("../middleware/role.middleware");

const ctrl = require("../controllers/adminCourseController");

const pool = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const PDF_DIR = "uploads/pdfs";
const VIDEO_DIR = "uploads/videos";

if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

/* ================= UPLOAD CONFIG ================= */

const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PDF_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
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

/* ================= VIDEO UPLOAD CONFIG ================= */

const videoStorage = multer.diskStorage({
  destination: VIDEO_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `video_${Date.now()}${ext}`);
  }
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

/* ================= COURSES ================= */

router.get("/courses", verifyToken, isInstructor, ctrl.getCourses);
router.post("/courses", verifyToken, isInstructor, ctrl.createCourse);
router.put("/courses", verifyToken, isAdminOnly, ctrl.updateCourse);
router.delete("/courses/:id", verifyToken, isAdminOnly, ctrl.deleteCourse);
router.put("/courses/publish", verifyToken, isAdminOnly, ctrl.togglePublish);

/* ================= MODULES ================= */

router.get("/modules", verifyToken, isInstructor, ctrl.getModules);
router.post("/modules", verifyToken, isInstructor, ctrl.createModule);
router.put("/modules", verifyToken, isAdminOnly, ctrl.updateModule);
router.delete("/modules/:id", verifyToken, isAdminOnly, ctrl.deleteModule);
router.post("/modules/reorder", verifyToken, isInstructor, ctrl.reorderModules);

/* ================= LESSONS ================= */

router.get("/lessons", verifyToken, isInstructor, ctrl.getLessons);
router.post("/lessons", verifyToken, isInstructor, ctrl.createLesson);
router.put("/lessons", verifyToken, isAdminOnly, ctrl.updateLesson);
router.delete("/lessons/:id", verifyToken, isAdminOnly, ctrl.deleteLesson);
router.post("/lessons/reorder", verifyToken, isInstructor, ctrl.reorderLessons);

/* ================= VIDEO UPLOAD ================= */

router.post(
  "/lessons/:id/video",
  verifyToken,
  isAdminOnly,
  uploadVideo.single("video"),
  async (req, res) => {
    try {
      const lessonId = req.params.id;

      if (!req.file) {
        return res.status(400).json({ error: "No video uploaded" });
      }

      const videoUrl = "/uploads/videos/" + req.file.filename;

      await pool.query(
        `UPDATE lessons SET video_url = $1 WHERE id = $2`,
        [videoUrl, lessonId]
      );

      res.json({ success: true, video_url: videoUrl });

    } catch (err) {
      console.error("Video upload error:", err);
      res.status(500).json({ error: "Video upload failed" });
    }
  }
);

/* ================= PDF UPLOAD ================= */

router.post(
  "/lessons/:id/pdf",
  verifyToken,
  isAdminOnly,
  uploadPdf.single("pdf"),
  async (req, res) => {
    try {
      const lessonId = req.params.id;

      if (!req.file) {
        return res.status(400).json({ error: "No PDF uploaded" });
      }

      const pdfUrl = "/uploads/pdfs/" + req.file.filename;

      await pool.query(
        `UPDATE lessons SET pdf_url = $1 WHERE id = $2`,
        [pdfUrl, lessonId]
      );

      res.json({ success: true, pdf_url: pdfUrl });

    } catch (err) {
      console.error("PDF upload error:", err);
      res.status(500).json({ error: "PDF upload failed" });
    }
  }
);

/* ================= DELETE VIDEO ================= */

router.delete("/lessons/:id/video", verifyToken, isAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT video_url FROM lessons WHERE id = $1",
      [id]
    );

    const videoUrl = result.rows[0]?.video_url;
    if (videoUrl) {
      const filePath = path.join("server", videoUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query(
      "UPDATE lessons SET video_url = NULL WHERE id = $1",
      [id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Delete video error:", err);
    res.status(500).json({ error: "Failed to delete video" });
  }
});

/* ================= DELETE PDF ================= */

router.delete("/lessons/:id/pdf", verifyToken, isAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT pdf_url FROM lessons WHERE id = $1",
      [id]
    );

    const pdfUrl = result.rows[0]?.pdf_url;
    if (pdfUrl) {
      const filePath = path.join("server", pdfUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query(
      "UPDATE lessons SET pdf_url = NULL WHERE id = $1",
      [id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Delete PDF error:", err);
    res.status(500).json({ error: "Failed to delete PDF" });
  }
});

/* ================= CLONE COURSE ================= */

router.post(
  "/courses/:id/clone",
  verifyToken,
  isInstructor,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const sourceCourseId = Number(req.params.id);
      const requestedTitle = req.body?.title;

      await client.query("BEGIN");

      /* ✅ Load source course */
      const courseRes = await client.query(
        `SELECT * FROM courses WHERE id = $1`,
        [sourceCourseId]
      );

      if (!courseRes.rows.length) {
        throw new Error("Source course not found");
      }

      const source = courseRes.rows[0];

      /* ✅ Create cloned course */
      const newCourseRes = await client.query(
        `
        INSERT INTO courses (title, description, price, status)
        VALUES ($1, $2, $3, 'draft')
        RETURNING id
        `,
        [
          requestedTitle || `${source.title} (Copy)`,
          source.description,
          source.price
        ]
      );

      const newCourseId = newCourseRes.rows[0].id;

      /* ✅ Clone modules */
      const modulesRes = await client.query(
        `
        SELECT *
        FROM course_modules
        WHERE course_id = $1
        ORDER BY id
        `,
        [sourceCourseId]
      );

      const moduleMap = new Map();   // oldModuleId → newModuleId

      for (const m of modulesRes.rows) {
        const newModuleRes = await client.query(
          `
          INSERT INTO course_modules (course_id, title)
          VALUES ($1, $2)
          RETURNING id
          `,
          [newCourseId, m.title]
        );

        moduleMap.set(m.id, newModuleRes.rows[0].id);
      }

      /* ✅ Clone lessons (ONLY existing columns) */
      const lessonsRes = await client.query(
        `
        SELECT *
        FROM course_lessons
        WHERE module_id = ANY($1)
        ORDER BY id
        `,
        [[...moduleMap.keys()]]
      );

      for (const l of lessonsRes.rows) {
        const newModuleId = moduleMap.get(l.module_id);

        await client.query(
          `
          INSERT INTO course_lessons
            (module_id, title, content_type, content)
          VALUES ($1, $2, $3, $4)
          `,
          [
            newModuleId,
            l.title,
            l.content_type,
            l.content
          ]
        );
      }

      await client.query("COMMIT");

      res.json({
        success: true,
        newCourseId
      });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ Clone course error:", err.message);
      res.status(500).json({ error: "Failed to clone course" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
