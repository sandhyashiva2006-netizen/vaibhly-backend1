const express = require("express");
const router = express.Router();
const pool = require("../db");
const verifyToken = require("../middleware/verifyToken");



/* =====================================================
   ✅ RECRUITER - CREATE JOB
===================================================== */

router.post("/recruiter/create-job", verifyToken, async (req, res) => {

  try {

    const recruiterId = req.user.id;

    const {
      title,
      company,
      description,
      skills,
      location,
      salary
    } = req.body;

    const result = await pool.query(
      `INSERT INTO jobs
      (title, company, description, skills, location, salary, recruiter_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [
        title,
        company,
        description,
        skills,
        location,
        salary,
        recruiterId
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Job creation failed" });
  }

});



/* =====================================================
   ✅ STUDENT - VIEW ALL JOBS
===================================================== */

router.get("/student/jobs", verifyToken, async (req, res) => {

  try {

    const studentId = req.user.id;

    const jobs = await pool.query(`
      SELECT j.*,
      EXISTS (
        SELECT 1 FROM applications a
        WHERE a.job_id = j.id
        AND a.student_id = $1
      ) AS applied
      FROM jobs j
      ORDER BY j.created_at DESC
    `, [studentId]);

    res.json(jobs.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }

});



/* =====================================================
   ✅ STUDENT - APPLY JOB
===================================================== */

router.post("/student/apply/:jobId", verifyToken, async (req, res) => {

  try {

    const studentId = req.user.id;
    const jobId = req.params.jobId;

    await pool.query(
      `INSERT INTO applications (job_id, student_id)
       VALUES ($1,$2)
       ON CONFLICT (job_id, student_id)
       DO NOTHING`,
      [jobId, studentId]
    );

    res.json({ message: "Applied successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Application failed" });
  }

});



/* =====================================================
   ✅ STUDENT - MY APPLICATIONS
===================================================== */

router.get("/student/my-applications", verifyToken, async (req, res) => {

  try {

    const studentId = req.user.id;

    const result = await pool.query(`
      SELECT
        a.id,
        j.title,
        j.company,
        j.location,
        a.stage,
        a.ai_score,
        a.applied_at
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE a.student_id = $1
      ORDER BY a.applied_at DESC
    `, [studentId]);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load applications" });
  }

});



/* =====================================================
   ✅ RECRUITER - VIEW JOB APPLICANTS
===================================================== */

router.get("/recruiter/job/:jobId/applicants",
verifyToken,
async (req, res) => {

  try {

    const jobId = req.params.jobId;

    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.username,
        a.id AS application_id,
        a.stage,
        a.ai_score
      FROM applications a
      JOIN users u ON u.id = a.student_id
      WHERE a.job_id = $1
      ORDER BY a.ai_score DESC
    `, [jobId]);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch applicants" });
  }

});



/* =====================================================
   ✅ RECRUITER - UPDATE STAGE / AI SCORE
===================================================== */

router.put("/recruiter/application/:appId",
verifyToken,
async (req, res) => {

  try {

    const { stage, ai_score } = req.body;
    const appId = req.params.appId;

    const result = await pool.query(`
      UPDATE applications
      SET
        stage = COALESCE($1, stage),
        ai_score = COALESCE($2, ai_score)
      WHERE id = $3
      RETURNING *
    `,
    [stage, ai_score, appId]);

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }

});

router.get("/student/applied", verifyToken, async (req, res) => {

const studentId = req.user.id;

const result = await pool.query(
"SELECT job_id FROM applications WHERE student_id=$1",
[studentId]
);

res.json(result.rows);

});

router.get("/student/applications", verifyToken, async (req, res) => {

const studentId = req.user.id;

const result = await pool.query(
`
SELECT j.title, j.company
FROM applications a
JOIN jobs j ON a.job_id = j.id
WHERE a.student_id = $1
`,
[studentId]
);

res.json(result.rows);

});


module.exports = router;