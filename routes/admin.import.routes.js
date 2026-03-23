const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

const upload = multer({ storage: multer.memoryStorage() });

/* ================= EXCEL COURSE IMPORT ================= */
router.post(
  "/import-courses",
  verifyToken,
  isAdmin,
  upload.single("file"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!req.file) {
        return res.status(400).json({ error: "Excel file required" });
      }

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!rows.length) {
        return res.status(400).json({ error: "Excel file is empty" });
      }

      await client.query("BEGIN");

      const cache = {
        courses: new Map(),
        modules: new Map()
      };

      for (const row of rows) {
        const {
          "Course Title": courseTitle,
          "Description": description,
          "Price": price,
          "Module Title": moduleTitle,
          "Lesson Title": lessonTitle,
          "Content Type": contentType,
          "Content URL": contentUrl
        } = row;

        if (!courseTitle || !moduleTitle || !lessonTitle || !contentType) {
          throw new Error("Missing required columns in Excel row");
        }

        /* ================= COURSE ================= */
        let courseId = cache.courses.get(courseTitle);

        if (!courseId) {
          const existing = await client.query(
            `SELECT id FROM courses WHERE title = $1 LIMIT 1`,
            [courseTitle]
          );

          if (existing.rows.length) {
            courseId = existing.rows[0].id;
          } else {
            const created = await client.query(
              `
              INSERT INTO courses (title, description, price, status)
              VALUES ($1, $2, $3, 'active')
              RETURNING id
              `,
              [courseTitle, description || "", Number(price) || 0]
            );

            courseId = created.rows[0].id;
          }

          cache.courses.set(courseTitle, courseId);
        }

        /* ================= MODULE ================= */
        const moduleKey = `${courseId}:${moduleTitle}`;
        let moduleId = cache.modules.get(moduleKey);

        if (!moduleId) {
          const existingModule = await client.query(
            `
            SELECT id 
            FROM course_modules
            WHERE course_id = $1 AND title = $2
            LIMIT 1
            `,
            [courseId, moduleTitle]
          );

          if (existingModule.rows.length) {
            moduleId = existingModule.rows[0].id;
          } else {
            const createdModule = await client.query(
              `
              INSERT INTO course_modules (course_id, title)
              VALUES ($1, $2)
              RETURNING id
              `,
              [courseId, moduleTitle]
            );

            moduleId = createdModule.rows[0].id;
          }

          cache.modules.set(moduleKey, moduleId);
        }

        /* ================= LESSON ================= */
        const existingLesson = await client.query(
          `
          SELECT id
          FROM course_lessons
          WHERE module_id = $1 AND title = $2
          LIMIT 1
          `,
          [moduleId, lessonTitle]
        );

        if (!existingLesson.rows.length) {
          const normalizedType = String(contentType).toLowerCase().trim();

          await client.query(
            `
            INSERT INTO course_lessons
  (module_id, title, content_type, content)
VALUES ($1, $2, $3, $4)

            `,
            [
              moduleId,
              lessonTitle,
              normalizedType,
              contentUrl || null
            ]
          );
        }
      }

      await client.query("COMMIT");

      res.json({
        success: true,
        importedRows: rows.length
      });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ Excel import failed:", err.message);

      res.status(500).json({
        error: "Excel import failed",
        message: err.message
      });

    } finally {
      client.release();
    }
  }
);

module.exports = router;
