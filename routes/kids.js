const express = require("express");
const router = express.Router();
const pool = require("../config/db");

/* PUBLIC: GET KIDS COURSES */
router.get("/courses", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        description,
        price,
        class_level,
        subject,
        learning_path,
        kids_style,
        thumbnail_icon
      FROM courses
      WHERE (is_kids = true OR audience = 'kids')
      AND COALESCE(status, 'active') = 'active'
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Public kids courses error:", err);
    res.status(500).json({ error: "Failed to load kids courses" });
  }
});

/* PUBLIC: GET SINGLE KIDS COURSE */
router.get("/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const courseRes = await pool.query(`
      SELECT *
      FROM courses
      WHERE id = $1
      AND (is_kids = true OR audience = 'kids')
    `, [id]);

    if (!courseRes.rows.length) {
      return res.status(404).json({ error: "Kids course not found" });
    }

    const modulesRes = await pool.query(`
      SELECT *
      FROM course_modules
      WHERE course_id = $1
      ORDER BY id ASC
    `, [id]);

    const moduleIds = modulesRes.rows.map(m => m.id);

    let lessons = [];

    if (moduleIds.length) {
      const lessonsRes = await pool.query(`
        SELECT *
        FROM course_lessons
        WHERE module_id = ANY($1)
        ORDER BY id ASC
      `, [moduleIds]);

      lessons = lessonsRes.rows;
    }

    res.json({
      course: courseRes.rows[0],
      modules: modulesRes.rows,
      lessons
    });
  } catch (err) {
    console.error("Public kids course detail error:", err);
    res.status(500).json({ error: "Failed to load kids course" });
  }
});

module.exports = router;