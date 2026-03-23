const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");


/* ================= GET MY COURSES ================= */
router.get("/my-courses", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT
        c.id,
        c.title,
        c.description,
        uc.purchased_at
      FROM user_courses uc
      JOIN courses c ON c.id = uc.course_id
      WHERE uc.user_id = $1
      ORDER BY uc.purchased_at DESC
    `, [userId]);

    res.json({ courses: result.rows });

  } catch (err) {
    console.error("Load my courses error:", err);
    res.status(500).json({ error: "Failed to load courses" });
  }
});


/* ================= GET SINGLE COURSE TREE (PROTECTED) ================= */
router.get(
  "/course/:courseId",
  verifyToken,
  async (req, res) => {

    try {
      const { courseId } = req.params;

      const course = await pool.query(
        "SELECT * FROM courses WHERE id = $1",
        [courseId]
      );

      if (!course.rows.length) {
        return res.status(404).json({ error: "Course not found" });
      }

      const modules = await pool.query(`
        SELECT * FROM modules
        WHERE course_id = $1
        ORDER BY sort_order
      `, [courseId]);

      for (let module of modules.rows) {
        const lessons = await pool.query(`
          SELECT * FROM lessons
          WHERE module_id = $1
          ORDER BY sort_order
        `, [module.id]);

        module.lessons = lessons.rows;
      }

      res.json({
        course: course.rows[0],
        modules: modules.rows
      });

    } catch (err) {
      console.error("Load course tree error:", err);
      res.status(500).json({ error: "Failed to load course" });
    }
  }
);


/* ================= MY PURCHASED COURSE PLAYER (PROTECTED) ================= */
router.get(
  "/my-course",
  verifyToken,
  async (req, res) => {

    try {
      const userId = req.user.id;
      const courseId =
        req.query.courseId ||
        req.headers["x-course-id"] ||
        null;

      let selectedCourseId = courseId;

      // If no course selected → load last purchased
      if (!selectedCourseId) {
        const latest = await pool.query(
          `SELECT course_id
           FROM user_courses
           WHERE user_id = $1
           ORDER BY purchased_at DESC
           LIMIT 1`,
          [userId]
        );

        if (!latest.rows.length) {
          return res.json({ course: null, modules: [] });
        }

        selectedCourseId = latest.rows[0].course_id;
      }

      // Verify user owns this course
      const owns = await pool.query(
        `SELECT 1 FROM user_courses
         WHERE user_id = $1 AND course_id = $2`,
        [userId, selectedCourseId]
      );

      if (!owns.rows.length) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Load course
      const courseRes = await pool.query(
        "SELECT id, title, description FROM courses WHERE id = $1",
        [selectedCourseId]
      );

      const modulesRes = await pool.query(`
        SELECT
          m.id AS module_id,
          m.title AS module_title,
          l.id AS lesson_id,
          l.title AS lesson_title,
          l.content_url,
          l.content_type
        FROM modules m
        LEFT JOIN lessons l ON l.module_id = m.id
        WHERE m.course_id = $1
        ORDER BY m.sort_order, l.sort_order
      `, [selectedCourseId]);

      // Build tree
      const modules = [];
      const map = {};

      modulesRes.rows.forEach(row => {
        if (!map[row.module_id]) {
          map[row.module_id] = {
            id: row.module_id,
            title: row.module_title,
            lessons: []
          };
          modules.push(map[row.module_id]);
        }

        if (row.lesson_id) {
          map[row.module_id].lessons.push({
            id: row.lesson_id,
            title: row.lesson_title,
            content_url: row.content_url,
            content_type: row.content_type
          });
        }
      });

      res.json({
        course: courseRes.rows[0],
        modules
      });

    } catch (err) {
      console.error("Player load error:", err);
      res.status(500).json({ error: "Failed to load course" });
    }
  }
);

module.exports = router;
