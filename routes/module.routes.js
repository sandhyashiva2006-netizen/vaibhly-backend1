const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");


/* ================= GET MODULES BY COURSE ================= */
router.get("/course/:courseId", verifyToken, async (req, res) => {
  try {
    const { courseId } = req.params;

    const result = await pool.query(
      `
      SELECT id, title, sort_order
      FROM modules
      WHERE course_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [courseId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Get modules error:", err);
    res.status(500).json({ error: "Failed to load modules" });
  }
});

/* ================= CREATE MODULE ================= */
router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const { course_id, title } = req.body;

    if (!course_id || !title) {
      return res.status(400).json({ error: "course_id and title required" });
    }

    // Auto sort order
    const orderResult = await pool.query(
      "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM modules WHERE course_id = $1",
      [course_id]
    );

    const sort_order = orderResult.rows[0].next_order;

    const result = await pool.query(
      `
      INSERT INTO modules (course_id, title, sort_order)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [course_id, title, sort_order]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error("Create module error:", err);
    res.status(500).json({ error: "Failed to create module" });
  }
});

/* ================= DELETE MODULE ================= */
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM modules WHERE id = $1", [req.params.id]);
    res.json({ message: "Module deleted" });
  } catch (err) {
    console.error("Delete module error:", err);
    res.status(500).json({ error: "Failed to delete module" });
  }
});

module.exports = router;
