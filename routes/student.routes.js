const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth.middleware");
const pool = require("../config/db");

// ================= STUDENT PROFILE =================
router.get("/profile", verifyToken, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("req.user missing:", req.user);
      return res.status(401).json({ error: "Invalid token payload" });
    }

    const result = await pool.query(
  `
  SELECT
    u.id,
    u.name,
u.username,
u.role,
    c.course_name AS course
  FROM users u
  LEFT JOIN courses c ON c.id = u.course_id
  WHERE u.id = $1
  `,
  [req.user.id]
);

    res.json(result.rows);

  } catch (err) {
    console.error("Profile SQL error:", err.message);
    res.status(500).json({ error: "Profile failed" });
  }
});

// ================= GET JOBS =================
router.get("/jobs", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
  SELECT id, title FROM jobs ORDER BY id DESC
`);

    console.log("JOBS DATA:", result.rows); // 🔥 ADD THIS

    res.json(result.rows);
  } catch (err) {
    console.error("FINAL JOBS ERROR:", err); // 🔥 IMPORTANT
    res.status(500).json({ error: "Failed to load jobs" });
  }
});


// ================= APPLIED JOBS =================
router.get("/applied", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT job_id FROM job_applications
      WHERE student_id = $1
    `, [req.user.id]);

    res.json(result.rows);
  } catch (err) {
    console.error("APPLIED ERROR:", err);
    res.status(500).json({ error: "Failed to load applied jobs" });
  }
});


// ================= APPLY JOB =================
router.post("/apply/:jobId", verifyToken, async (req, res) => {
  try {
    const jobId = req.params.jobId;

    // 🔥 CHECK EXISTING
    const existing = await pool.query(`
      SELECT * FROM job_applications
      WHERE student_id = $1 AND job_id = $2
    `, [req.user.id, jobId]);

    if (existing.rows.length > 0) {
      return res.json({ message: "Already applied" });
    }

    // ✅ INSERT
    await pool.query(`
      INSERT INTO job_applications (student_id, job_id)
      VALUES ($1, $2)
    `, [req.user.id, jobId]);

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Apply failed" });
  }
});


// ================= MY APPLICATIONS =================
router.get("/my-applications", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT j.title, a.status, a.applied_at
      FROM job_applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE a.student_id = $1
    `, [req.user.id]);

    res.json(result.rows);

  } catch (err) {
    console.error("APPS ERROR:", err);
    res.status(500).json({ error: "Failed to load applications" });
  }
});

module.exports = router;
