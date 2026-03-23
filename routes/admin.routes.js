const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");
const db = require("../db");

/* ======================================================
   ASSIGN COURSE TO STUDENT
====================================================== */
router.post("/assign-course", verifyToken, isAdmin, async (req, res) => {
  try {
    const { student_id, course_id } = req.body;

    if (!student_id || !course_id) {
      return res.status(400).json({ error: "student_id and course_id required" });
    }

    await pool.query(
      "UPDATE users SET course_id = $1 WHERE id = $2 AND role = 'student'",
      [course_id, student_id]
    );

    res.json({ message: "Course assigned successfully" });
  } catch (err) {
    console.error("Assign course error:", err);
    res.status(500).json({ error: "Assignment failed" });
  }
});

/* ======================================================
   ADMIN DASHBOARD (COUNTS)
====================================================== */
router.get("/dashboard", verifyToken, isAdmin, async (req, res) => {
  try {
    const students = await pool.query(
      "SELECT COUNT(*) FROM users WHERE role='student'"
    );

    const courses = await pool.query(
      "SELECT COUNT(*) FROM courses"
    );

    const exams = await pool.query(
      "SELECT COUNT(*) FROM exams"
    );

    const attempts = await pool.query(
      "SELECT COUNT(*) FROM exam_results"
    );

    res.json({
      totalStudents: Number(students.rows[0].count),
      totalCourses: Number(courses.rows[0].count),
      totalExams: Number(exams.rows[0].count),
      totalAttempts: Number(attempts.rows[0].count)
    });
  } catch (err) {
    console.error("Admin dashboard error:", err);
    res.status(500).json({ error: "Dashboard load failed" });
  }
});

/* ======================================================
   RESET EXAM (ADMIN)
====================================================== */
router.post("/reset-exam", verifyToken, isAdmin, async (req, res) => {
  try {
    const { user_id, exam_id } = req.body;

    await pool.query(
      "DELETE FROM exam_results WHERE user_id = $1 AND exam_id = $2",
      [user_id, exam_id]
    );

    res.json({ message: "Exam reset successfully" });
  } catch (err) {
    console.error("Reset exam error:", err);
    res.status(500).json({ error: "Failed to reset exam" });
  }
});

/* ======================================================
   ADMIN: GET ALL EXAMS
====================================================== */
router.get("/exams", verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title FROM exams ORDER BY id"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Admin exams error:", err);
    res.status(500).json({ error: "Failed to load exams" });
  }
});

/* ======================================================
   ADMIN: EXAMS VIEW (WITH QUESTION COUNT)
====================================================== */
router.get("/exams-view", verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
  e.id,
  e.title,
  e.active,
  COUNT(q.id) AS total_questions
FROM exams e
LEFT JOIN questions q ON q.exam_id = e.id
GROUP BY e.id, e.active
ORDER BY e.id

    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Admin exams view error:", err);
    res.status(500).json({ error: "Failed to load exams" });
  }
});

/* ======================================================
   ADMIN: QUESTIONS BY EXAM
====================================================== */
router.get("/questions/:examId", verifyToken, isAdmin, async (req, res) => {
  try {
    const { examId } = req.params;

    const result = await pool.query(
      `
      SELECT id, question, correct_option
      FROM questions
      WHERE exam_id = $1
      ORDER BY id
      `,
      [examId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Admin questions error:", err);
    res.status(500).json({ error: "Failed to load questions" });
  }
});

/* ======================================================
   ADMIN: ADD QUESTION
====================================================== */
router.post("/questions", verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      exam_id,
      question,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option
    } = req.body;

    if (
      !exam_id ||
      !question ||
      !option_a ||
      !option_b ||
      !option_c ||
      !option_d ||
      !correct_option
    ) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const result = await pool.query(
      `
      INSERT INTO questions
      (exam_id, question, option_a, option_b, option_c, option_d, correct_option)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id
      `,
      [
        Number(exam_id),
        question,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option
      ]
    );

    res.json({ message: "Question added", id: result.rows[0].id });
  } catch (err) {
    console.error("Add question error:", err);
    res.status(500).json({ error: "Failed to add question" });
  }
});

/* ======================================================
   ADMIN: DELETE QUESTION
====================================================== */
router.delete("/questions/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM questions WHERE id = $1", [req.params.id]);
    res.json({ message: "Question deleted" });
  } catch (err) {
    console.error("Delete question error:", err);
    res.status(500).json({ error: "Failed to delete question" });
  }
});

/* ======================================================
   ADMIN: GET SINGLE QUESTION
====================================================== */
router.get("/questions/single/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM questions WHERE id = $1",
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Get question error:", err);
    res.status(500).json({ error: "Failed to load question" });
  }
});

/* ======================================================
   ADMIN: UPDATE QUESTION
====================================================== */
router.put("/questions/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      question,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option
    } = req.body;

    await pool.query(
      `
      UPDATE questions
      SET question=$1,
          option_a=$2,
          option_b=$3,
          option_c=$4,
          option_d=$5,
          correct_option=$6
      WHERE id=$7
      `,
      [
        question,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        req.params.id
      ]
    );

    res.json({ message: "Question updated" });
  } catch (err) {
    console.error("Update question error:", err);
    res.status(500).json({ error: "Failed to update question" });
  }
});

/* ======================================================
   ADMIN RESULTS SUMMARY (FIXED)
====================================================== */
router.get("/results/summary", verifyToken, isAdmin, async (req, res) => {
  try {
    const students = await pool.query(
      "SELECT COUNT(*) FROM users WHERE role='student'"
    );

    const exams = await pool.query(
      "SELECT COUNT(*) FROM exams"
    );

    const attempts = await pool.query(
      "SELECT COUNT(*) FROM exam_results"
    );

    const avgScore = await pool.query(`
      SELECT COALESCE(
        ROUND(AVG(score * 100.0 / NULLIF(total_questions, 0))),
        0
      ) AS avg_score
      FROM exam_results
    `);

    res.json({
      totalStudents: Number(students.rows[0].count),
      totalExams: Number(exams.rows[0].count),
      totalAttempts: Number(attempts.rows[0].count),
      avgScore: Number(avgScore.rows[0].avg_score)
    });
  } catch (err) {
    console.error("Admin summary error:", err);
    res.status(500).json({ error: "Failed to load summary" });
  }
});

/* ======================================================
   ADMIN EXAM-WISE RESULTS (FIXED)
====================================================== */
router.get("/results/exams", verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        e.title AS exam,
        COUNT(r.id) AS attempts,
        COALESCE(
          ROUND(AVG(r.score * 100.0 / NULLIF(r.total_questions, 0))),
          0
        ) AS avg_score,
        SUM(CASE WHEN r.status='PASSED' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN r.status='FAILED' THEN 1 ELSE 0 END) AS failed
      FROM exams e
      LEFT JOIN exam_results r ON r.exam_id = e.id
      GROUP BY e.title
      ORDER BY e.title
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Admin exam results error:", err);
    res.status(500).json({ error: "Failed to load exam results" });
  }
});

router.put("/exams/:id/toggle", verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;

  await pool.query(
    "UPDATE exams SET active = NOT active WHERE id = $1",
    [id]
  );

  res.json({ success: true });
});

router.delete("/exams/:id", verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;

  await pool.query("DELETE FROM exams WHERE id = $1", [id]);

  res.json({ success: true });
});

/* ================= CREATE EXAM ================= */
router.post("/exams", verifyToken, isAdmin, async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Exam title required" });
    }

    const result = await pool.query(
      `
      INSERT INTO exams (title, active)
      VALUES ($1, false)
      RETURNING *
      `,
      [title]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error("❌ Create exam error:", err);
    res.status(500).json({ message: "Create exam failed" });
  }
});

/* ======================================================
   ADMIN ANALYTICS DASHBOARD
====================================================== */
router.get("/analytics", verifyToken, isAdmin, async (req, res) => {
  try {
    const students = await pool.query(
      "SELECT COUNT(*) FROM users WHERE role = 'student'"
    );

    const courses = await pool.query(
      "SELECT COUNT(*) FROM courses"
    );

    const exams = await pool.query(
      "SELECT COUNT(*) FROM exams"
    );

    const certificates = await pool.query(
      "SELECT COUNT(*) FROM exam_results WHERE status = 'PASSED'"
    );

    const attempts = await pool.query(
      "SELECT COUNT(*) FROM exam_results"
    );

    const passRateRes = await pool.query(`
      SELECT 
        ROUND(
          (SUM(CASE WHEN status='PASSED' THEN 1 ELSE 0 END)::decimal 
          / NULLIF(COUNT(*),0)) * 100
        ) AS pass_rate
      FROM exam_results
    `);

    const completionRateRes = await pool.query(`
      SELECT 
        ROUND(
          (COUNT(DISTINCT lp.user_id)::decimal 
          / NULLIF((SELECT COUNT(*) FROM users WHERE role='student'),0)) * 100
        ) AS completion_rate
      FROM lesson_progress lp
    `);

    res.json({
      totalStudents: Number(students.rows[0].count),
      totalCourses: Number(courses.rows[0].count),
      totalExams: Number(exams.rows[0].count),
      totalCertificates: Number(certificates.rows[0].count),
      totalAttempts: Number(attempts.rows[0].count),
      passRate: Number(passRateRes.rows[0].pass_rate || 0),
      completionRate: Number(completionRateRes.rows[0].completion_rate || 0)
    });

  } catch (err) {
    console.error("Admin analytics error:", err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

router.get("/revenue", verifyToken, async (req,res)=>{

try{

// total instructor earnings
const revenueResult = await pool.query(`
SELECT COALESCE(SUM(amount),0) AS revenue
FROM instructor_transactions
`);

// recruiter count (no premium column)
const recruiterResult = await pool.query(`
SELECT COUNT(*) AS recruiters
FROM users
WHERE role='recruiter'
`);

const revenue = Number(revenueResult.rows[0].revenue);
const recruiters = Number(recruiterResult.rows[0].recruiters);

res.json({
 revenue: revenue,
 activePremium: recruiters,
 mrr: revenue
});

}catch(err){

console.error("Revenue error:",err);
res.status(500).json({error:"Revenue load failed"});

}

});

router.get("/recruiter-analytics", verifyToken, async (req,res)=>{

try{

const recruiters = await pool.query(`
SELECT COUNT(*) FROM users
WHERE role='recruiter'
`);

const jobs = await pool.query(`
SELECT COUNT(*) FROM jobs
`);

const applications = await pool.query(`
SELECT COUNT(*) FROM job_applications
`);

const revenue = await pool.query(`
SELECT ROUND(COALESCE(SUM(amount),0)::numeric,2) AS revenue
FROM recruiter_payments
`);

res.json({
 totalRecruiters: Number(recruiters.rows[0].count),
 activePremium: 0,
 totalJobs: Number(jobs.rows[0].count),
 totalApplications: Number(applications.rows[0].count),
 revenue: Number(revenue.rows[0].revenue)
});

}catch(err){

console.error(err);
res.status(500).json({error:"Recruiter analytics failed"});

}

});

router.get("/instructor-analytics", verifyToken, async (req,res)=>{

try{

const instructors = await pool.query(`
SELECT COUNT(*) FROM users
WHERE role='instructor'
`);

const courses = await pool.query(`
SELECT COUNT(*) FROM courses
`);

const revenue = await pool.query(`
SELECT COALESCE(SUM(amount),0) AS revenue
FROM instructor_transactions
`);

res.json({
 totalInstructors: Number(instructors.rows[0].count),
 totalCourses: Number(courses.rows[0].count),
 revenue: Number(revenue.rows[0].revenue)
});

}catch(err){

console.error(err);
res.status(500).json({error:"Instructor analytics failed"});

}

});

/* ======================================================
   ADMIN: CREATE COMPETITIVE EXAM
====================================================== */
router.post("/competitive-exams", verifyToken, isAdmin, async (req, res) => {
  try {

    const { title, price, pass_marks, total_questions } = req.body;

    const result = await pool.query(
      `INSERT INTO competitive_exams
       (title, price, pass_marks, total_questions)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [title, price, pass_marks, total_questions]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Create competitive exam error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


/* ======================================================
   ADMIN: GET COMPETITIVE EXAMS
====================================================== */
router.get("/competitive-exams", verifyToken, isAdmin, async (req, res) => {
  try {

    const result = await pool.query(
      "SELECT * FROM competitive_exams ORDER BY id DESC"
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


/* ======================================================
   ADMIN: DELETE COMPETITIVE EXAM
====================================================== */
router.delete("/competitive-exams/:id", verifyToken, isAdmin, async (req, res) => {
  try {

    const { id } = req.params;

    await pool.query(
      "DELETE FROM competitive_exams WHERE id=$1",
      [id]
    );

    res.json({ success:true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/competitive-questions", verifyToken, isAdmin, async (req,res)=>{

 const {
  exam_id,
  question,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_option
 } = req.body;

 await pool.query(
  `INSERT INTO competitive_questions
  (exam_id,question,option_a,option_b,option_c,option_d,correct_option)
  VALUES($1,$2,$3,$4,$5,$6,$7)`,
  [exam_id,question,option_a,option_b,option_c,option_d,correct_option]
 );

 res.json({success:true});

});

/* GET QUESTIONS BY EXAM */
router.get("/competitive-questions/:examId", verifyToken, isAdmin, async (req,res)=>{

const { examId } = req.params;

const result = await pool.query(
"SELECT * FROM competitive_questions WHERE exam_id=$1 ORDER BY id",
[examId]
);

res.json(result.rows);

});


/* ADD QUESTION */
router.post("/competitive-questions", verifyToken, isAdmin, async (req,res)=>{

const {
exam_id,
question,
option_a,
option_b,
option_c,
option_d,
correct_option
} = req.body;

await pool.query(
`INSERT INTO competitive_questions
(exam_id,question,option_a,option_b,option_c,option_d,correct_option)
VALUES($1,$2,$3,$4,$5,$6,$7)`,
[exam_id,question,option_a,option_b,option_c,option_d,correct_option]
);

res.json({success:true});

});

router.get("/admin/withdraw-requests", async (req,res)=>{

  const result = await db.query(`
      SELECT w.*, u.name
      FROM withdraw_requests w
      JOIN users u ON u.id = w.instructor_id
      ORDER BY w.request_date DESC
  `);

await pool.query(
`INSERT INTO admin_notifications(message)
 VALUES($1)`,
[`Instructor ${instructorId} requested ₹${amount} withdrawal`]
);

  res.json(result.rows);

});

router.post("/admin/approve-withdraw", async (req,res)=>{

  const { request_id } = req.body;

  await db.query(
    `UPDATE withdraw_requests
     SET status='approved',
         processed_date=NOW()
     WHERE id=$1`,
    [request_id]
  );

  res.json({success:true});

});

router.post("/admin/mark-paid", async (req,res)=>{

  const { request_id } = req.body;

  await db.query(
    `UPDATE withdraw_requests
     SET status='paid'
     WHERE id=$1`,
    [request_id]
  );

  res.json({success:true});

});

router.get("/admin/withdraw-requests", verifyToken, async(req,res)=>{

 try{

 const result = await pool.query(`
 SELECT 
 w.id,
 w.amount,
 w.status,
 w.created_at,
 u.name,
 p.bank_name,
 p.account_number,
 p.ifsc_code,
 p.upi_id

 FROM withdrawal_requests w

 JOIN users u
 ON u.id = w.instructor_id

 LEFT JOIN instructor_payment_details p
 ON p.instructor_id = w.instructor_id

 ORDER BY w.created_at DESC
 `);

 res.json(result.rows);

 }catch(err){

 console.error("Withdraw list error:",err);
 res.status(500).json({error:"Failed to load withdraw requests"});

 }

});

router.post("/admin/approve-withdraw", verifyToken, async(req,res)=>{

 try{

 const { id } = req.body;

 await pool.query(`
 UPDATE withdrawal_requests
 SET status='approved'
 WHERE id=$1
 `,[id]);

 res.json({message:"Withdraw approved"});

 }catch(err){

 console.error("Approve withdraw error:",err);
 res.status(500).json({error:"Approval failed"});

 }

});

router.post("/admin/mark-paid", verifyToken, async(req,res)=>{

 try{

 const { id } = req.body;

 await pool.query(`
 UPDATE withdrawal_requests
 SET status='paid'
 WHERE id=$1
 `,[id]);

 res.json({message:"Payment marked as paid"});

 }catch(err){

 console.error("Mark paid error:",err);
 res.status(500).json({error:"Failed to update payment"});

 }

});

router.get("/admin/notifications",
verifyToken,
async(req,res)=>{

 const result = await pool.query(`
 SELECT *
 FROM admin_notifications
 WHERE is_read=false
 ORDER BY created_at DESC
 `);

 res.json(result.rows);

});

router.get("/users", verifyToken, async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT id, name, email, role
      FROM users
      ORDER BY id DESC
    `);

    res.json(result.rows);

  } catch (err) {

    console.error("Users error:", err);
    res.status(500).json({ error: "Failed to load users" });

  }
});

router.get("/analytics-overview", verifyToken, async (req,res)=>{

try{

const students = await pool.query(`
SELECT COUNT(*) FROM users WHERE role='student'
`);

const instructors = await pool.query(`
SELECT COUNT(*) FROM users WHERE role='instructor'
`);

const courses = await pool.query(`
SELECT COUNT(*) FROM courses
`);

const jobs = await pool.query(`
SELECT COUNT(*) FROM jobs
`);

const instructorRevenue = await pool.query(`
SELECT COALESCE(SUM(amount),0) AS revenue
FROM instructor_transactions
`);

const recruiterRevenue = await pool.query(`
SELECT COALESCE(SUM(amount),0) AS revenue
FROM recruiter_payments
`);

res.json({

students:Number(students.rows[0].count),

instructors:Number(instructors.rows[0].count),

courses:Number(courses.rows[0].count),

jobs:Number(jobs.rows[0].count),

instructorRevenue:Number(instructorRevenue.rows[0].revenue),

recruiterRevenue:Number(recruiterRevenue.rows[0].revenue)

});

}catch(err){

console.error(err);
res.status(500).json({error:"Analytics load failed"});

}

});

/* ================= ADMIN CREATE COURSE ================= */

router.post("/courses", verifyToken, isAdmin, async (req, res) => {
  try {

    const { title, description, price } = req.body;

    const result = await pool.query(`
      INSERT INTO courses
      (title, description, price, instructor_id, created_by_role)
      VALUES ($1, $2, $3, $4, 'admin')
      RETURNING *
    `, [
      title,
      description,
      price,
      req.user.id   // admin id
    ]);

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Admin create course error:", err);
    res.status(500).json({ error: "Failed to create course" });
  }
});

module.exports = router;
