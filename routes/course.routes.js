const express = require("express");
const router = express.Router();
const pool = require("../config/db");


// ✅ CORRECT & ONLY middleware import
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

console.log("verifyToken =", verifyToken);
console.log("isAdmin =", isAdmin);

/**
 * GET all courses (student + admin)
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, description FROM courses ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get courses error:", err);
    res.status(500).json({ error: "Failed to load courses" });
  }
});

/**
 * ADMIN: Create course
 */
router.post("/admin", verifyToken, isAdmin, async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title required" });
    }

    const result = await pool.query(
      "INSERT INTO courses (title, description) VALUES ($1,$2) RETURNING *",
      [title, description || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create course error:", err);
    res.status(500).json({ error: "Failed to create course" });
  }
});

/**
 * ADMIN: Delete course
 */
router.delete("/admin/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM courses WHERE id=$1", [req.params.id]);
    res.json({ message: "Course deleted" });
  } catch (err) {
    console.error("Delete course error:", err);
    res.status(500).json({ error: "Failed to delete course" });
  }
});


/* ================= CREATE COURSE ================= */
router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Course title required" });
    }

    const result = await pool.query(
      `
      INSERT INTO courses (title, description)
      VALUES ($1, $2)
      RETURNING *
      `,
      [title.trim(), description || ""]
    );

    res.json({
      success: true,
      course: result.rows[0]
    });

  } catch (err) {
    console.error("Create course error:", err);
    res.status(500).json({ error: "Failed to create course" });
  }
});

/* ================= DELETE COURSE ================= */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const courseId = req.params.id;

    // Optional safety: prevent deleting if enrolled users exist
    const enrollCheck = await pool.query(
      "SELECT COUNT(*) FROM user_courses WHERE course_id = $1",
      [courseId]
    );

    if (Number(enrollCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: "Cannot delete course with active enrollments"
      });
    }

    await pool.query("DELETE FROM courses WHERE id = $1", [courseId]);

    res.json({ success: true });

  } catch (err) {
    console.error("Delete course error:", err);
    res.status(500).json({ error: "Failed to delete course" });
  }
});

/* ================= UPDATE COURSE VISIBILITY ================= */
router.patch("/:id/visibility", verifyToken, async (req, res) => {
  try {
    const courseId = req.params.id;
    const { is_published, is_featured } = req.body;

    await pool.query(
      `
      UPDATE courses
      SET 
        is_published = COALESCE($1, is_published),
        is_featured  = COALESCE($2, is_featured),
        published_at = CASE 
          WHEN $1 = true THEN NOW()
          ELSE published_at
        END
      WHERE id = $3
      `,
      [is_published, is_featured, courseId]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Visibility update error:", err);
    res.status(500).json({ error: "Failed to update visibility" });
  }
});

module.exports = router;
