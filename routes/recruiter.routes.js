const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");
const crypto = require("crypto");
const razorpay = require("../config/razorpay");



/* ================= APPLY TO JOB ================= */

router.post("/jobs/:id/apply", verifyToken, async (req, res) => {

  if (req.user.role !== "student") {
    return res.status(403).json({ error: "Student access only" });
  }

  try {

    const jobId = req.params.id;



    // 🔹 1️⃣ Check if resume exists
    const resumeCheck = await pool.query(
      `SELECT resume_data FROM resumes WHERE user_id = $1`,
      [req.user.id]
    );

    if (!resumeCheck.rows.length || !resumeCheck.rows[0].resume_data) {
      return res.status(400).json({
        error: "Please complete your resume before applying."
      });
    }

    // 🔹 2️⃣ Check already applied
    const existing = await pool.query(
      `SELECT id FROM job_applications
       WHERE job_id=$1 AND student_id=$2`,
      [jobId, req.user.id]
    );

    if (existing.rows.length) {
      return res.status(400).json({ error: "Already applied" });
    }

    // 🔹 3️⃣ Insert application
    await pool.query(
      `INSERT INTO job_applications (job_id, student_id)
       VALUES ($1,$2)`,
      [jobId, req.user.id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Application failed" });
  }

});

/* ================= VIEW APPLICATIONS ================= */

router.get("/jobs/:id/applications", verifyToken, async (req, res) => {

  if (req.user.role !== "recruiter") {
    return res.status(403).json({ error: "Only recruiters allowed" });
  }

  try {

    const jobId = req.params.id;

    const result = await pool.query(
  `
  SELECT 
    users.id,
    users.name,
    users.username,
    users.bio,
    job_applications.id as application_id,
    job_applications.status as stage,

    CASE
      WHEN users.bio ILIKE '%' || jobs.skills || '%' THEN 90
      ELSE 50
    END AS ai_score

  FROM job_applications
  JOIN users ON users.id = job_applications.student_id
  JOIN jobs ON jobs.id = job_applications.job_id
  WHERE job_applications.job_id = $1
  ORDER BY ai_score DESC
  `,
  [jobId]
);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load applications" });
  }

});

/* ================= SAVE JOB ================= */

router.post("/jobs/:id/save", verifyToken, async (req, res) => {

  if (req.user.role !== "student") {
    return res.status(403).json({ error: "Only students allowed" });
  }

  try {

    const jobId = req.params.id;

    await pool.query(
      `INSERT INTO saved_jobs (job_id, student_id)
       VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [jobId, req.user.id]
    );

    res.json({ saved: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Save failed" });
  }

});

router.post("/jobs/:id/boost", verifyToken, async (req, res) => {

  if (req.user.role !== "recruiter") {
    return res.status(403).json({ error: "Recruiter only" });
  }

  const jobId = req.params.id;

  /* CHECK WALLET */
  const wallet = await pool.query(
    `SELECT balance FROM recruiter_wallets
     WHERE recruiter_id=$1`,
    [req.user.id]
  );

  await pool.query(`
 INSERT INTO wallet_transactions
 (recruiter_id,amount,type,purpose)
 VALUES ($1,100,'debit','job boost')
`,[req.user.id]);

  /* BOOST JOB */
  await pool.query(
    `UPDATE jobs
     SET boost_until = NOW() + INTERVAL '7 days'
     WHERE id=$1 AND recruiter_id=$2`,
    [jobId, req.user.id]
  );

  /* DEDUCT WALLET */
  await pool.query(
    `UPDATE recruiter_wallets
     SET balance = balance - 100
     WHERE recruiter_id=$1`,
    [req.user.id]
  );

  /* TRANSACTION LOG */
  await pool.query(
    `INSERT INTO wallet_transactions
     (recruiter_id,amount,type,purpose)
     VALUES ($1,$2,'debit','job boost')`,
    [req.user.id, 100]
  );

  res.json({ boosted: true });
});

router.get("/wallet/analytics", verifyToken, async (req,res)=>{

 const result = await pool.query(`
   SELECT
     SUM(CASE WHEN type='credit' THEN amount ELSE 0 END) as total_added,
     SUM(CASE WHEN type='debit' THEN amount ELSE 0 END) as total_spent
   FROM wallet_transactions
   WHERE recruiter_id=$1
 `,[req.user.id]);

 res.json(result.rows[0]);
});

/* ================= SHORTLIST ================= */

router.post("/applications/:id/decision", verifyToken, async (req, res) => {

  if (req.user.role !== "recruiter") {
    return res.status(403).json({ error: "Only recruiters allowed" });
  }

  try {

    const { decision } = req.body; // accepted or rejected
    const applicationId = req.params.id;

    // Get student ID first
    const app = await pool.query(
      `SELECT student_id 
       FROM job_applications 
       WHERE id = $1`,
      [applicationId]
    );

    if (!app.rows.length) {
      return res.status(404).json({ error: "Application not found" });
    }

    const studentId = app.rows[0].student_id;

    // Update decision
    await pool.query(
      `UPDATE job_applications
       SET decision = $1
       WHERE id = $2`,
      [decision, applicationId]
    );

    // Create notification
    await pool.query(
      `INSERT INTO notifications (user_id, message)
       VALUES ($1,$2)`,
      [
        studentId,
        `Your job application has been ${decision}`
      ]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Decision update failed" });
  }

});

router.put("/applications/:id/status", verifyToken, async (req, res) => {

  if (req.user.role !== "recruiter") {
    return res.status(403).json({ error: "Recruiter only" });
  }

  const { status } = req.body;

  const allowedStatuses = [
    "applied",
    "screening",
    "interview",
    "offer",
    "hired",
    "rejected"
  ];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  await pool.query(
    `UPDATE job_applications
     SET status = $1
     WHERE id = $2`,
    [status, req.params.id]
  );

  res.json({ success: true });
});

router.post("/applications/:id/schedule", verifyToken, async (req, res) => {

  const { interview_date, meeting_link } = req.body;
  const applicationId = req.params.id;

  const app = await pool.query(
    `SELECT student_id, job_id FROM job_applications WHERE id=$1`,
    [applicationId]
  );

  const studentId = app.rows[0].student_id;
  const jobId = app.rows[0].job_id;

  await pool.query(
    `INSERT INTO interviews
     (job_id, recruiter_id, student_id, interview_date, meeting_link)
     VALUES ($1,$2,$3,$4,$5)`,
    [jobId, req.user.id, studentId, interview_date, meeting_link]
  );

  res.json({ scheduled: true });
});

router.post("/messages", verifyToken, async (req, res) => {

  const { jobId, receiverId, message } = req.body;

  await pool.query(
    `INSERT INTO job_messages (job_id, sender_id, receiver_id, message)
     VALUES ($1,$2,$3,$4)`,
    [jobId, req.user.id, receiverId, message]
  );

  res.json({ sent: true });

});

router.post("/applications/:id/schedule", verifyToken, async (req, res) => {

  const { interview_date, meeting_link } = req.body;

  await pool.query(`
    INSERT INTO interview_schedules
    (application_id, interview_date, meeting_link)
    VALUES ($1,$2,$3)
  `, [req.params.id, interview_date, meeting_link]);

  await pool.query(`
    UPDATE job_applications
    SET status = 'interview'
    WHERE id = $1
  `, [req.params.id]);

  res.json({ success: true });
});

router.get("/messages/:jobId/:userId", verifyToken, async (req, res) => {

  const { jobId, userId } = req.params;

  const result = await pool.query(
    `SELECT *
     FROM job_messages
     WHERE job_id = $1
     AND (sender_id = $2 OR receiver_id = $2)
     ORDER BY created_at ASC`,
    [jobId, userId]
  );

  res.json(result.rows);

});

router.get("/candidate/:id/resume", verifyToken, async (req, res) => {

  if (req.user.role !== "recruiter") {
    return res.status(403).json({ error: "Only recruiters allowed" });
  }

  const candidateId = req.params.id;

  const result = await pool.query(
    `SELECT resume_data FROM resumes WHERE user_id = $1`,
    [candidateId]
  );

  const certResult = await pool.query(
    `
    SELECT 
      courses.title AS course_name,
      certificates.issued_on
    FROM certificates
    JOIN courses ON courses.id = certificates.course_id
    WHERE certificates.user_id = $1
    ORDER BY certificates.issued_on DESC
    `,
    [candidateId]
  );

  res.json({
    resume_data: result.rows[0]?.resume_data || {},
    certificates: certResult.rows
  });
});


function generateResumeHTML(r) {
  return `
  <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          color: #111;
        }

        .header {
          text-align: center;
          margin-bottom: 30px;
        }

        .title {
          color: #666;
        }

        .section {
          margin-bottom: 20px;
        }

        .section h3 {
          border-bottom: 2px solid #ddd;
          padding-bottom: 5px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${r.name || ""}</h1>
        <div class="title">${r.title || ""}</div>
        <div>${r.email || ""} | ${r.phone || ""}</div>
      </div>

      <div class="section">
        <h3>Summary</h3>
        <p>${r.summary || ""}</p>
      </div>

      <div class="section">
        <h3>Skills</h3>
        <p>${r.skills || ""}</p>
      </div>

      <div class="section">
        <h3>Projects</h3>
        <p>${r.projects || ""}</p>
      </div>

      <div class="section">
        <h3>Education</h3>
        <p>${r.education || ""}</p>
      </div>
    </body>
  </html>
  `;
}

const puppeteer = require("puppeteer");

const fs = require("fs");


router.get("/resume/public/:id", async (req, res) => {

  const candidateId = req.params.id;

  const result = await pool.query(
    `SELECT resume_data, template FROM resumes WHERE user_id=$1`,
    [candidateId]
  );

  if (!result.rows.length) {
    return res.status(404).send("Resume not found");
  }

  const resume = result.rows[0].resume_data || {};
  const template = result.rows[0].template || "modern";

  const certResult = await pool.query(
    `
    SELECT courses.title AS course_name,
           certificates.issued_on
    FROM certificates
    JOIN courses ON courses.id = certificates.course_id
    WHERE certificates.user_id = $1
    ORDER BY certificates.issued_on DESC
    `,
    [candidateId]
  );

  const certificates = certResult.rows;

  // 🔥 READ CSS FILE DIRECTLY
  const cssPath = path.join(__dirname, "../../client/css/resume.css");
  const css = fs.readFileSync(cssPath, "utf8");

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        ${css}
      </style>
    </head>
    <body>
      <div class="resume-sheet template-${template}">
        <h1>${resume.name || ""}</h1>
        <h3>${resume.title || ""}</h3>
        <p>${resume.email || ""} | ${resume.phone || ""}</p>

        <hr>

        <h3>Summary</h3>
        <p>${resume.summary || ""}</p>

        <h3>Skills</h3>
        <p>${resume.skills || ""}</p>

        <h3>Projects</h3>
        <p>${resume.projects || ""}</p>

        <h3>Education</h3>
        <p>${resume.education || ""}</p>

        <h3>Certificates</h3>
        <ul>
          ${
            certificates.length
              ? certificates.map(c => `
                  <li>
                    ${c.course_name}
                    (${new Date(c.issued_on).toLocaleDateString()})
                  </li>
                `).join("")
              : "<li>No certificates</li>"
          }
        </ul>

        <h3>Links</h3>
        <p>${resume.linkedin || ""}<br>${resume.github || ""}</p>
      </div>
    </body>
    </html>
  `);
});

router.get("/candidate/:id/resume-pdf", async (req, res) => {
  try {

    const token = req.query.token;
    if (!token) return res.status(401).json({ error: "No token" });

    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "recruiter") {
      return res.status(403).json({ error: "Recruiter only" });
    }

    const candidateId = req.params.id;

    const result = await pool.query(
      `SELECT resume_data, template FROM resumes WHERE user_id=$1`,
      [candidateId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const certResult = await pool.query(
      `
      SELECT courses.title AS course_name, certificates.issued_on
      FROM certificates
      JOIN courses ON courses.id = certificates.course_id
      WHERE certificates.user_id = $1
      ORDER BY certificates.issued_on DESC
      `,
      [candidateId]
    );

    const certificates = certResult.rows;

    const r = result.rows[0].resume_data || {};
    const template = result.rows[0].template || "modern";

    // 🔥 Load real CSS safely
    const fs = require("fs");
    const path = require("path");

    const cssPath = path.join(__dirname, "../../client/css/resume.css");
    let css = fs.readFileSync(cssPath, "utf8");

    // 🚫 REMOVE PRINT HIDING RULES THAT BREAK PDF
    css = css.replace(/@media print[\s\S]*?\}\s*\}/g, "");

    const html = `
    <html>
    <head>
      <style>
        ${css}
      </style>
    </head>
    <body>
      <div class="resume-sheet template-${template}">
        <h1>${r.name || ""}</h1>
        <p><strong>${r.title || ""}</strong></p>
        <p>${r.email || ""} | ${r.phone || ""}</p>

        <h3>Summary</h3>
        <p>${r.summary || ""}</p>

        <h3>Skills</h3>
        <p>${r.skills || ""}</p>

        <h3>Projects</h3>
        <p>${r.projects || ""}</p>

        <h3>Education</h3>
        <p>${r.education || ""}</p>

        <h3>Certificates</h3>
        <ul>
          ${certificates.map(c => `
            <li>${c.course_name} (${new Date(c.issued_on).toLocaleDateString()})</li>
          `).join("")}
        </ul>

        <h3>Links</h3>
        <p>${r.linkedin || ""}<br>${r.github || ""}</p>
      </div>
    </body>
    </html>
    `;

    const puppeteer = require("puppeteer");

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=resume.pdf"
    });

    res.send(pdf);

  } catch (err) {
    console.error("PDF ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/resume/preview/:id", async (req, res) => {

  const candidateId = req.params.id;

  const result = await pool.query(
    `SELECT resume_data FROM resumes WHERE user_id=$1`,
    [candidateId]
  );

  if (!result.rows.length) {
    return res.status(404).send("Resume not found");
  }

  const r = result.rows[0].resume_data;

  // 🔥 IMPORTANT:
  // Here you must use SAME THEME HTML used in student dashboard

  res.send(`
    <html>
      <head>
        <link rel="stylesheet" href="/css/resume-theme.css">
      </head>
      <body>
        <div class="resume-container">
          <h1>${r.name}</h1>
          <p>${r.title || ""}</p>
          <p>${r.email} | ${r.phone}</p>

          <h3>Summary</h3>
          <p>${r.summary}</p>

          <h3>Skills</h3>
          <p>${r.skills}</p>

          <h3>Projects</h3>
          <p>${r.projects}</p>

          <h3>Education</h3>
          <p>${r.education}</p>
        </div>
      </body>
    </html>
  `);
});

router.get("/my-interviews", verifyToken, async (req, res) => {

  const result = await pool.query(`
    SELECT jobs.title,
           interview_schedules.interview_date,
           interview_schedules.meeting_link
    FROM job_applications
    JOIN interview_schedules
      ON interview_schedules.application_id = job_applications.id
    JOIN jobs ON jobs.id = job_applications.job_id
    WHERE job_applications.student_id = $1
  `, [req.user.id]);

  res.json(result.rows);
});

router.get("/notifications", verifyToken, async (req, res) => {

  try {

    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load notifications" });
  }

});


router.get("/analytics", verifyToken, async (req, res) => {

  if (req.user.role !== "recruiter") {
    return res.status(403).json({ error: "Only recruiters allowed" });
  }

  try {

    const recruiterId = req.user.id;

    const jobs = await pool.query(
      `SELECT COUNT(*) FROM jobs WHERE recruiter_id = $1`,
      [recruiterId]
    );

    const applications = await pool.query(
      `SELECT COUNT(*) 
       FROM job_applications
       JOIN jobs ON jobs.id = job_applications.job_id
       WHERE jobs.recruiter_id = $1`,
      [recruiterId]
    );

    const shortlisted = await pool.query(
      `SELECT COUNT(*) 
       FROM job_applications
       JOIN jobs ON jobs.id = job_applications.job_id
       WHERE jobs.recruiter_id = $1
       AND job_applications.decision = 'accepted'`,
      [recruiterId]
    );

    res.json({
      totalJobs: jobs.rows[0].count,
      totalApplications: applications.rows[0].count,
      totalShortlisted: shortlisted.rows[0].count
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analytics failed" });
  }

});


router.get("/company/:username", async (req, res) => {

  const result = await pool.query(
    `SELECT users.name, recruiter_profiles.company_name,
            recruiter_profiles.about_company
     FROM users
     JOIN recruiter_profiles
     ON users.id = recruiter_profiles.user_id
     WHERE users.username = $1`,
    [req.params.username]
  );

  res.json(result.rows[0]);

});

router.get("/admin/jobs", verifyToken, async (req, res) => {

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admins only" });
  }

  const jobs = await pool.query(
    `SELECT jobs.*, users.name
     FROM jobs
     JOIN users ON users.id = jobs.recruiter_id
     ORDER BY created_at DESC`
  );

  res.json(jobs.rows);
});

router.post("/jobs", verifyToken, async (req, res) => {

  if (req.user.role !== "recruiter") {
    return res.status(403).json({ error: "Recruiter access only" });
  }

  try {

    const {
      title,
      company_name,
      location,
      job_type,
      experience_level,
      salary_min,
      salary_max,
      remote,
      description,
      skills
    } = req.body;

    /* ==============================
       1️⃣ CHECK PLAN + EXPIRY
    =============================== */

    const profileResult = await pool.query(
      `
      SELECT plan_id, plan_expires_at
      FROM recruiter_profiles
      WHERE user_id = $1
      `,
      [req.user.id]
    );

    if (!profileResult.rows.length) {
      return res.status(400).json({ error: "Recruiter profile not found" });
    }

    let { plan_id, plan_expires_at } = profileResult.rows[0];

    // 🔹 Auto downgrade if expired
    if (
      plan_expires_at &&
      new Date(plan_expires_at) < new Date()
    ) {
      await pool.query(
        `
        UPDATE recruiter_profiles
        SET plan_id = 1,
            plan_expires_at = NULL
        WHERE user_id = $1
        `,
        [req.user.id]
      );

      plan_id = 1; // fallback to Free
    }

    /* ==============================
       2️⃣ GET JOB LIMIT FROM PLANS
    =============================== */

    const planResult = await pool.query(
      `
      SELECT job_limit
      FROM plans
      WHERE id = $1
      `,
      [plan_id]
    );

    if (!planResult.rows.length) {
      return res.status(400).json({ error: "Plan not found" });
    }

    const jobLimit = planResult.rows[0].job_limit;

    /* ==============================
       3️⃣ CHECK CURRENT JOB COUNT
    =============================== */

    const countResult = await pool.query(
      `
      SELECT COUNT(*)
      FROM jobs
      WHERE recruiter_id = $1
      `,
      [req.user.id]
    );

    const currentCount = parseInt(countResult.rows[0].count);

    if (jobLimit !== -1 && currentCount >= jobLimit) {
      return res.status(403).json({
        error: "Job limit reached. Upgrade your plan."
      });
    }

    /* ==============================
       4️⃣ INSERT JOB
    =============================== */

    const insertResult = await pool.query(
`
INSERT INTO jobs
(
 recruiter_id,
 title,
 company_name,
 location,
 job_type,
 experience_level,
 salary_min,
 salary_max,
 remote,
 description,
 skills,
 is_featured,
 status
)
VALUES
(
 $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
)
RETURNING *
`,
[
 req.user.id,
 title,
 company_name,
 location,
 job_type,
 experience_level,
 salary_min || 0,
 salary_max || 0,
 remote || false,
 description || "",
 skills?.length ? skills : [],
 plan_id !== 1,
 "active"
]
);

    res.json(insertResult.rows[0]);

  } catch (err) {
 console.error(err);
 res.status(500).json({
   error: err.message
 });
}

});

router.get("/jobs", async (req, res) => {

  try {

    const {
      location,
      job_type,
      experience_level,
      skill,
      search
    } = req.query;

    let query = `
      SELECT *
      FROM jobs
      WHERE status = 'active'
    `;

    const values = [];
    let count = 1;

    if (location) {
      query += ` AND location ILIKE $${count++}`;
      values.push(`%${location}%`);
    }

    if (job_type) {
      query += ` AND job_type = $${count++}`;
      values.push(job_type);
    }

    if (experience_level) {
      query += ` AND experience_level = $${count++}`;
      values.push(experience_level);
    }

    if (skill) {
      query += ` AND $${count++} = ANY(skills)`;
      values.push(skill);
    }

    if (search) {
      query += ` AND title ILIKE $${count++}`;
      values.push(`%${search}%`);
    }

    // ORDER BY must come at the END
    query += `
      ORDER BY
        boost_until DESC NULLS LAST,
        is_featured DESC,
        created_at DESC
    `;

    const result = await pool.query(query, values);

    res.json(result.rows);

  } catch (err) {
    console.error("JOB SEARCH ERROR:", err);
    res.status(500).json({ error: "Job search failed" });
  }

});

router.get("/my-jobs", verifyToken, async (req, res) => {

  if (req.user.role !== "recruiter") {
    return res.status(403).json({ error: "Recruiter only" });
  }

  const result = await pool.query(
    `
    SELECT 
      jobs.*,
      COUNT(job_applications.id) AS applications_count
    FROM jobs
    LEFT JOIN job_applications
      ON job_applications.job_id = jobs.id
    WHERE jobs.recruiter_id = $1
    GROUP BY jobs.id
    ORDER BY jobs.created_at DESC
    `,
    [req.user.id]
  );

  res.json(result.rows);
});


router.get("/my-applications", verifyToken, async (req, res) => {

  if (req.user.role !== "student") {
    return res.status(403).json({ error: "Students only" });
  }

  const result = await pool.query(
    `SELECT jobs.title, jobs.company_name,
            job_applications.decision
     FROM job_applications
     JOIN jobs ON jobs.id = job_applications.job_id
     WHERE job_applications.student_id = $1`,
    [req.user.id]
  );

  res.json(result.rows);
});

router.put("/jobs/:id/status", verifyToken, async (req, res) => {

  if (req.user.role !== "recruiter") {
    return res.status(403).json({ error: "Recruiter only" });
  }

  const { status } = req.body;
  const jobId = req.params.id;

  await pool.query(
    `UPDATE jobs
     SET status = $1
     WHERE id = $2 AND recruiter_id = $3`,
    [status, jobId, req.user.id]
  );

  res.json({ success: true });

});

router.put("/jobs/:id", verifyToken, async (req, res) => {

  if (req.user.role !== "recruiter") {
    return res.status(403).json({ error: "Recruiter only" });
  }

  const {
    title,
    location,
    description,
    salary_min,
    salary_max
  } = req.body;

  await pool.query(
    `UPDATE jobs
     SET title=$1, location=$2,
         description=$3, salary_min=$4,
         salary_max=$5
     WHERE id=$6 AND recruiter_id=$7`,
    [
      title,
      location,
      description,
      salary_min,
      salary_max,
      req.params.id,
      req.user.id
    ]
  );

  res.json({ success: true });

});

router.get("/profile", verifyToken, async (req, res) => {

  const result = await pool.query(`
    SELECT
      recruiter_profiles.*,
      plans.name AS plan_name
    FROM recruiter_profiles
    LEFT JOIN plans
      ON plans.id = recruiter_profiles.plan_id
    WHERE recruiter_profiles.user_id = $1
  `,[req.user.id]);

  res.json(result.rows[0]);
});

router.put("/profile", verifyToken, async (req, res) => {

  const { company_name, about_company, website } = req.body;

  await pool.query(
    `UPDATE recruiter_profiles
     SET company_name=$1,
         about_company=$2,
         website=$3
     WHERE user_id=$4`,
    [company_name, about_company, website, req.user.id]
  );

  res.json({ success: true });
});

router.post("/create-order", verifyToken, async (req, res) => {
  try {

    const { planId } = req.body;

    const planResult = await pool.query(
      `SELECT * FROM plans WHERE id = $1`,
      [planId]
    );

    if (!planResult.rows.length) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const plan = planResult.rows[0];

    const order = await razorpay.orders.create({
      amount: plan.price * 100,
      currency: "INR",
      receipt: "plan_" + Date.now(),
      notes: {
        recruiter_id: req.user.id,
        plan_id: planId
      }
    });

    res.json({
      ...order,
      planName: plan.name
    });

  } catch (err) {
    console.error("ORDER ERROR:", err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

router.post("/downgrade-plan", verifyToken, async (req, res) => {
  try {

    await pool.query(
      `
      UPDATE recruiter_profiles
      SET plan_id = 1,
          plan_expires_at = NULL
      WHERE user_id = $1
      `,
      [req.user.id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("DOWNGRADE ERROR:", err);
    res.status(500).json({ error: "Downgrade failed" });
  }
});

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {

    try {

      const signature =
        req.headers["x-razorpay-signature"];

      const expected = crypto
        .createHmac(
          "sha256",
          process.env.RAZORPAY_WEBHOOK_SECRET
        )
        .update(req.body)
        .digest("hex");

      if (expected !== signature) {
        console.log("Invalid webhook signature");
        return res.status(400).send("Invalid");
      }

      const event = JSON.parse(req.body.toString());

      /* ================= PAYMENT SUCCESS ================= */

      if (event.event === "payment.captured") {

        const payment =
          event.payload.payment.entity;

        const recruiterId =
          payment.notes.recruiter_id;

        const type =
          payment.notes.type;

        /* WALLET RECHARGE */
        if (type === "wallet") {

          const amount = payment.amount / 100;

          await pool.query(`
            UPDATE recruiter_wallets
            SET balance = balance + $1
            WHERE recruiter_id=$2
          `,[amount,recruiterId]);

          await pool.query(`
            INSERT INTO wallet_transactions
            (recruiter_id,amount,type,purpose)
            VALUES ($1,$2,'credit','wallet recharge')
          `,[recruiterId,amount]);
        }

        console.log("Webhook processed");
      }

      res.json({ status: "ok" });

    } catch (err) {
      console.error("WEBHOOK ERROR:", err);
      res.status(500).send("Webhook failed");
    }
});

router.get("/payments", verifyToken, async (req, res) => {

  if (req.user.role !== "recruiter") {
    return res.status(403).json({ error: "Recruiter only" });
  }

  const result = await pool.query(
    `SELECT razorpay_payment_id,
            amount,
            status,
            created_at
     FROM recruiter_payments
     WHERE recruiter_id = $1
     ORDER BY created_at DESC`,
    [req.user.id]
  );

  res.json(result.rows);
});


router.post("/buy-credits", verifyToken, async (req, res) => {

console.log("KEY:", process.env.RAZORPAY_KEY_ID);
console.log("SECRET:", process.env.RAZORPAY_KEY_SECRET);

  if (req.user.role !== "recruiter") {
    return res.status(403).json({ error: "Recruiter only" });
  }

  const { type } = req.body;

  let amount = 0;

  if (type === "boost") amount = 499;
  if (type === "resume") amount = 999;

  if (!amount) {
    return res.status(400).json({ error: "Invalid type" });
  }

  try {

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "credit_" + Date.now()
    });

    res.json({ order, type });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Order failed" });
  }

});

router.post("/verify-credit-payment", verifyToken, async (req, res) => {
  try {

    const crypto = require("crypto");

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      type
    } = req.body;

    const text = razorpay_order_id + "|" + razorpay_payment_id;

    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ error: "Verification failed" });
    }

    let amount = 0;

    if (type === "boost") {
      amount = 499;

      await pool.query(
        `UPDATE recruiter_profiles
         SET boost_credits = boost_credits + 5
         WHERE user_id = $1`,
        [req.user.id]
      );
    }

    if (type === "resume") {
      amount = 999;

      await pool.query(
        `UPDATE recruiter_profiles
         SET resume_credits = resume_credits + 10
         WHERE user_id = $1`,
        [req.user.id]
      );
    }

    await pool.query(
  `INSERT INTO recruiter_payments
   (recruiter_id, amount, type, status, razorpay_order_id, razorpay_payment_id)
   VALUES ($1,$2,$3,$4,$5,$6)`,
  [
    req.user.id,
    amount,
    type,
    "paid",
    razorpay_order_id,
    razorpay_payment_id
  ]
);


    res.json({ success: true });

  } catch (err) {
    console.error("CREDIT VERIFY ERROR:", err);
    res.status(500).json({ error: "Verification crashed" });
  }
});

router.post("/verify-payment", verifyToken, async (req, res) => {
  try {

    const crypto = require("crypto");

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId
    } = req.body;

    const text = razorpay_order_id + "|" + razorpay_payment_id;

    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ error: "Verification failed" });
    }

    /* ==============================
       1️⃣ Validate Plan
    =============================== */

    const planResult = await pool.query(
      `SELECT * FROM plans WHERE id = $1`,
      [planId]
    );

    if (!planResult.rows.length) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const plan = planResult.rows[0];

    /* ==============================
       2️⃣ Update Recruiter Plan
    =============================== */

    await pool.query(
      `
      UPDATE recruiter_profiles
      SET plan_id = $1,
          plan_expires_at = NOW() + INTERVAL '30 days'
      WHERE user_id = $2
      `,
      [planId, req.user.id]
    );

    /* ==============================
       3️⃣ Insert Payment Record
    =============================== */

    await pool.query(
      `
      INSERT INTO recruiter_payments
      (recruiter_id, amount, type, status,
       razorpay_order_id, razorpay_payment_id)
      VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [
        req.user.id,
        plan.price,
        plan.name.toLowerCase(),
        "paid",
        razorpay_order_id,
        razorpay_payment_id
      ]
    );

// GST calculation
const gst = Math.round(plan.price * 0.18);
const total = plan.price + gst;

const invoiceNo =
  "EDN-" + Date.now();

await pool.query(
  `
  INSERT INTO recruiter_invoices
  (recruiter_id, invoice_no, plan_name,
   amount, gst_amount, total_amount)
  VALUES ($1,$2,$3,$4,$5,$6)
  `,
  [
    req.user.id,
    invoiceNo,
    plan.name,
    plan.price,
    gst,
    total
  ]
);

    res.json({ success: true });

  } catch (err) {
    console.error("PAYMENT VERIFY ERROR:", err);
    res.status(500).json({ error: "Verification crashed" });
  }
});

router.get("/invoice/:id", verifyToken, async (req,res)=>{

 const invoice = await pool.query(
   `SELECT * FROM recruiter_invoices
    WHERE id=$1 AND recruiter_id=$2`,
   [req.params.id, req.user.id]
 );

 const data = invoice.rows[0];

 const browser = await require("puppeteer").launch({
   headless:true,
   args:["--no-sandbox"]
 });

 const page = await browser.newPage();

 await page.setContent(`
   <h2>EduNexa Invoice</h2>
   <p>Invoice: ${data.invoice_no}</p>
   <p>Plan: ${data.plan_name}</p>
   <p>Total: ₹${data.total_amount}</p>
 `);

 const pdf = await page.pdf({format:"A4"});

 await browser.close();

 res.set({
   "Content-Type":"application/pdf",
   "Content-Disposition":"attachment; filename=invoice.pdf"
 });

 res.send(pdf);
});

router.get("/admin/revenue", verifyToken, async (req,res)=>{

 if(req.user.role !== "admin")
   return res.status(403).json({error:"Admin only"});

 const revenue = await pool.query(`
   SELECT
     SUM(amount) as total_revenue,
     COUNT(*) as total_sales
   FROM recruiter_payments
   WHERE status='paid'
 `);

 res.json(revenue.rows[0]);
});

router.post("/wallet/create-order", verifyToken, async (req,res)=>{

 const { amount } = req.body;

 const order = await razorpay.orders.create({
   amount: amount * 100,
   currency: "INR",
   receipt: "wallet_" + Date.now(),
   notes:{
     recruiter_id:req.user.id,
     type:"wallet"
   }
 });

 res.json(order);
});

router.post("/wallet/verify", verifyToken, async (req,res)=>{

 const crypto = require("crypto");

 const {
   razorpay_order_id,
   razorpay_payment_id,
   razorpay_signature,
   amount
 } = req.body;

 const text =
   razorpay_order_id + "|" + razorpay_payment_id;

 const generated = crypto
   .createHmac("sha256",process.env.RAZORPAY_KEY_SECRET)
   .update(text)
   .digest("hex");

 if(generated !== razorpay_signature)
   return res.status(400).json({error:"Verification failed"});

 const numericAmount = parseInt(amount);

 /* UPDATE WALLET */
 await pool.query(`
   UPDATE recruiter_wallets
   SET balance = balance + $1
   WHERE recruiter_id=$2
 `,[numericAmount,req.user.id]);

 /* TRANSACTION LOG */
 await pool.query(`
   INSERT INTO wallet_transactions
   (recruiter_id,amount,type,purpose)
   VALUES ($1,$2,'credit','wallet recharge')
 `,[req.user.id,numericAmount]);

 res.json({success:true});
});

router.get("/wallet", verifyToken, async (req, res) => {

  try {

    const recruiterId = req.user.id;

    const result = await pool.query(`
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN type='credit' THEN amount
              WHEN type='debit' THEN -amount
            END
          ),0
        ) AS balance
      FROM wallet_transactions
      WHERE recruiter_id=$1
    `,[recruiterId]);

    const balance = Number(result.rows[0].balance);

    res.json({ balance });

  } catch(err){
    console.error("WALLET ERROR:",err);
    res.status(500).json({balance:0});
  }
});

router.post("/wallet/pay", verifyToken, async (req,res)=>{

 try{

   const recruiterId = req.user.id;
   const { purpose, amount } = req.body;

   /* GET BALANCE */
   const balanceResult = await pool.query(`
     SELECT COALESCE(
       SUM(
         CASE
          WHEN type='credit' THEN amount
          WHEN type='debit' THEN -amount
         END
       ),0
     ) AS balance
     FROM wallet_transactions
     WHERE recruiter_id=$1
   `,[recruiterId]);

   const balance =
     Number(balanceResult.rows[0].balance);

   if(balance < amount){
     return res.json({
       wallet:false,
       message:"Insufficient wallet balance"
     });
   }

   /* DEDUCT MONEY */
   await pool.query(`
     INSERT INTO wallet_transactions
     (recruiter_id,amount,type,purpose)
     VALUES ($1,$2,'debit',$3)
   `,[recruiterId,amount,purpose]);

   res.json({ wallet:true });

 }catch(err){
   console.error(err);
   res.status(500).json({error:"Wallet payment failed"});
 }

});

router.post("/add-boost", verifyToken, async(req,res)=>{

 await pool.query(`
   UPDATE recruiter_profiles
   SET boost_credits = boost_credits + 5
   WHERE user_id=$1
 `,[req.user.id]);

 res.json({success:true});
});

router.post("/add-resume", verifyToken, async(req,res)=>{

 await pool.query(`
   UPDATE recruiter_profiles
   SET resume_credits = resume_credits + 10
   WHERE user_id=$1
 `,[req.user.id]);

 res.json({success:true});
});

router.post("/create-subscription", verifyToken, async (req,res)=>{

 const { razorpayPlanId } = req.body;

 const subscription =
   await razorpay.subscriptions.create({
     plan_id: razorpayPlanId,
     customer_notify: 1,
     total_count: 12
   });

 res.json(subscription);
});

router.post("/downgrade", verifyToken, async (req, res) => {

  await pool.query(
    `UPDATE recruiter_profiles
     SET plan_id = 1,
         plan_expires_at = NULL
     WHERE user_id = $1`,
    [req.user.id]
  );

  res.json({ downgraded: true });
});

router.get("/wallet/history", verifyToken, async (req,res)=>{

 const result = await pool.query(`
   SELECT amount,type,purpose,created_at
   FROM wallet_transactions
   WHERE recruiter_id=$1
   ORDER BY created_at DESC
 `,[req.user.id]);

 res.json(result.rows);
});

router.get("/performance", verifyToken, async (req, res) => {

  const recruiterId = req.user.id;

  const boosted = await pool.query(`
    SELECT COUNT(*) FROM jobs
    WHERE recruiter_id = $1
    AND boost_until > NOW()
  `, [recruiterId]);

  const resumes = await pool.query(`
    SELECT COUNT(*) FROM resume_unlocks
    WHERE recruiter_id = $1
  `, [recruiterId]);

  res.json({
    activeBoosts: boosted.rows[0].count,
    resumesUnlocked: resumes.rows[0].count
  });

});

const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: "uploads/resumes",
  filename: (req, file, cb) => {
    const uniqueName =
      req.user.id + "_" + Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.post(
  "/upload-resume",
  verifyToken,
  upload.single("resume"),
  async (req, res) => {

    if (req.user.role !== "student") {
      return res.status(403).json({ error: "Students only" });
    }

    const filePath = req.file.filename;

    await pool.query(
      `
      INSERT INTO resumes (user_id, resume_file)
      VALUES ($1,$2)
      ON CONFLICT (user_id)
      DO UPDATE SET resume_file=$2
      `,
      [req.user.id, filePath]
    );

    res.json({ uploaded: true });
  }
);

// GET ALL PLANS
router.get("/plans", verifyToken, async (req, res) => {
  try {

    const recruiter = await pool.query(
      `SELECT plan_id FROM recruiter_profiles
       WHERE user_id = $1`,
      [req.user.id]
    );

    const currentPlanId = recruiter.rows[0]?.plan_id || 1;

    const plans = await pool.query(
      `SELECT * FROM plans ORDER BY price ASC`
    );

    const updatedPlans = plans.rows.map(plan => ({
      ...plan,
      is_current: plan.id === currentPlanId
    }));

    res.json({ plans: updatedPlans });

  } catch (err) {
    console.error("PLANS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/wallet/buy-plan", verifyToken, async (req,res)=>{

 try{

   const recruiterId = req.user.id;
   const { planId } = req.body;

   /* GET PLAN */
   const planResult = await pool.query(
     `SELECT * FROM plans WHERE id=$1`,
     [planId]
   );

   if(!planResult.rows.length)
     return res.status(400).json({error:"Invalid plan"});

   const plan = planResult.rows[0];

   /* GET WALLET BALANCE */
   const balanceResult = await pool.query(`
     SELECT COALESCE(
       SUM(
         CASE
          WHEN type='credit' THEN amount
          WHEN type='debit' THEN -amount
         END
       ),0
     ) AS balance
     FROM wallet_transactions
     WHERE recruiter_id=$1
   `,[recruiterId]);

   const balance =
     Number(balanceResult.rows[0].balance);

   /* WALLET CHECK */
   if(balance < plan.price){
     return res.json({
       wallet:false,
       message:"Insufficient wallet"
     });
   }

   /* DEDUCT WALLET */
   await pool.query(`
     INSERT INTO wallet_transactions
     (recruiter_id,amount,type,purpose)
     VALUES ($1,$2,'debit','plan purchase')
   `,[recruiterId,plan.price]);

   /* ACTIVATE PLAN */
   await pool.query(`
     UPDATE recruiter_profiles
     SET plan_id=$1,
         plan_expires_at =
           NOW() + INTERVAL '30 days'
     WHERE user_id=$2
   `,[planId,recruiterId]);

   res.json({ wallet:true });

 }catch(err){
   console.error(err);
   res.status(500).json({error:"Wallet plan failed"});
 }

});

module.exports = router;
