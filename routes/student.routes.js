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
      SELECT id, title FROM recruiter_jobs ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (err) {
  console.error("JOBS ERROR:", err);  // 🔥 ADD THIS
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
    console.error("JOBS ERROR:", err);
    res.status(500).json({ error: "Failed to load applied jobs" });
  }
});


// ================= APPLY JOB =================
router.post("/apply/:jobId", verifyToken, async (req, res) => {
  try {
    const jobId = req.params.jobId;

    await pool.query(`
      INSERT INTO job_applications (student_id, job_id)
      VALUES ($1, $2)
    `, [req.user.id, jobId]);

    res.json({ success: true });

  } catch (err) {
    console.error("JOBS ERROR:", err);
    res.status(500).json({ error: "Apply failed" });
  }
});


// ================= MY APPLICATIONS =================
router.get("/my-applications", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
  SELECT j.title
  FROM job_applications a
  JOIN recruiter_jobs j ON j.id = a.job_id
  WHERE a.student_id = $1
`, [req.user.id]);

    res.json(result.rows);

  } catch (err) {
    console.error("JOBS ERROR:", err);
    res.status(500).json({ error: "Failed to load applications" });
  }
});

module.exports = router;
