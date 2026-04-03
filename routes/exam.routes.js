const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");
const verifySubscription = require("../middleware/subscription");
const EXAM_UNLOCK_COST = 200; // same for all exams

/* ======================================================
   GET QUESTIONS FOR EXAM
====================================================== */

router.get("/:examId/questions", verifyToken, async (req, res) => {

  try {

    const examId = Number(req.params.examId);

    console.log("Loading exam questions for:", examId);

    const result = await pool.query(`
SELECT id, question, option_a, option_b, option_c, option_d
FROM questions WHERE exam_id = $1

UNION ALL

SELECT id, question, option_a, option_b, option_c, option_d
FROM exam_questions WHERE course_id = $1

UNION ALL

SELECT id, question, option_a, option_b, option_c, option_d
FROM competitive_questions WHERE exam_id = $1
`, [examId]);

    console.log("Questions found:", result.rows.length);

    if (!result.rows.length) {
      return res.json({
        success: false,
        questions: []
      });
    }

    const formatted = result.rows.map(q => ({
      id: q.id,
      question: q.question,
      options: [
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d
      ]
    }));

    res.json({
      success: true,
      questions: formatted
    });

  } catch (err) {

    console.error("Questions route error:", err);

    res.status(500).json({
      success: false,
      error: "Failed to load questions"
    });

  }

});

/* ======================================================
   GET ALL EXAMS FOR STUDENT
====================================================== */
router.get("/list", verifyToken, async (req, res) => {
  try {

    const userId = req.user.id;

   /* ===== NORMAL EXAMS (FILTERED BY USER COURSES) ===== */

const normalExams = await pool.query(`
  SELECT
    e.id,
    e.title,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM exam_results r
        WHERE r.exam_id = e.id
          AND r.user_id = $1
      )
      THEN 'COMPLETED'
      ELSE 'NOT_ATTEMPTED'
    END AS status
  FROM exams e
  JOIN user_courses uc ON uc.course_id = e.course_id
  WHERE uc.user_id = $1
`, [userId]);


     res.json(normalExams.rows);

  } catch (err) {

    console.error("❌ exam list error:", err);

    res.status(500).json({
      message: "Failed to load exams"
    });

  }
});


/* ======================================================
   LOAD EXAM QUESTIONS
====================================================== */
router.get("/:examId", verifyToken, async (req, res) => {
  try {

    const examId = Number(req.params.examId);

/* ===== ADMIN EXAM QUESTIONS ===== */
const adminQuestions = await pool.query(`
SELECT
 id,
 question,
 option_a,
 option_b,
 option_c,
 option_d
FROM questions
WHERE exam_id = $1
`, [examId]);

/* ===== COURSE FINAL EXAM QUESTIONS ===== */
const courseQuestions = await pool.query(`
SELECT
 id,
 question,
 option_a,
 option_b,
 option_c,
 option_d
FROM exam_questions
WHERE course_id=$1
`, [examId]);

/* ===== COMPETITIVE EXAM QUESTIONS ===== */
const competitiveQuestions = await pool.query(
`
SELECT
 id,
 question,
 option_a,
 option_b,
 option_c,
 option_d
FROM competitive_questions
WHERE exam_id = $1
`,
[examId]
);

const allQuestions = [
  ...adminQuestions.rows,
  ...courseQuestions.rows,
  ...competitiveQuestions.rows
];

if (!allQuestions.length) {
  return res.json({
    success: false,
    questions: []
  });
}

const questions = allQuestions.map(q => ({
  id: q.id,
  question: q.question,
  options: [
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d
  ]
}));

res.json({
  success: true,
  questions
});

  } catch (err) {

    console.error("❌ exam load error:", err);

    res.status(500).json({
      success: false,
      error: "Failed to load exam"
    });

  }
});


/* ======================================================
   GET STUDENT EXAM RESULTS (LATEST ATTEMPT PER EXAM)
====================================================== */
router.get("/results", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT DISTINCT ON (e.id)
        e.title AS exam_name,
        r.score,
        r.total_questions,
        r.status,
        r.attempted_at
      FROM exam_results r
      JOIN exams e ON e.id = r.exam_id
      WHERE r.user_id = $1
      ORDER BY e.id, r.attempted_at DESC
      `,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ exam results error:", err);
    res.status(500).json({ message: "Failed to load exam results" });
  }
});


/* ======================================================
   SUBMIT EXAM (CRITICAL FIX)
====================================================== */
router.post("/submit", verifyToken, async (req, res) => {
  try {

    console.log("📥 BACKEND RECEIVED:", req.body);
    console.log("USER:", req.user);

    const userId = req.user.id;
    const { exam_id, answers } = req.body;

    if (!exam_id || !answers) {
      return res.status(400).json({
        success: false,
        error: "Invalid submission data"
      });
    }

   /* ================= GET COURSE ID ================= */

const examRes = await pool.query(
  `SELECT course_id FROM exams WHERE id = $1`,
  [exam_id]
);

const courseId = examRes.rows[0]?.course_id;

/* ================= USE IT BELOW ================= */

const qRes = await pool.query(
  `
  SELECT id, correct_option FROM questions WHERE exam_id = $1

  UNION ALL

  SELECT id, correct_answer AS correct_option 
  FROM exam_questions WHERE course_id = $2

  UNION ALL

  SELECT id, correct_option FROM competitive_questions WHERE exam_id = $1
  `,
  [exam_id, courseId]
);

/* ================= VALIDATE USER COURSE ACCESS ================= */

const accessCheck = await pool.query(
  `SELECT 1 FROM user_courses 
   WHERE user_id = $1 AND course_id = $2`,
  [userId, courseId]
);

if (accessCheck.rows.length === 0) {
  return res.status(403).json({
    success: false,
    error: "You are not enrolled in this course"
  });
}

    /* ================= ATTEMPT LIMIT ================= */

    const attemptCheck = await pool.query(
      `SELECT COUNT(*) FROM exam_attempts WHERE user_id = $1 AND exam_id = $2`,
      [userId, exam_id]
    );

    const attempts = Number(attemptCheck.rows[0].count);

    const MAX_ATTEMPTS = 5;

    const alreadyPassed = await pool.query(
      `SELECT 1 FROM exam_attempts WHERE user_id = $1 AND exam_id = $2 AND status = 'PASSED'`,
      [userId, exam_id]
    );

    if (alreadyPassed.rows.length > 0) {
  return res.status(400).json({
    success: false,
    error: "You already passed this exam"
  });
}

if (attempts >= MAX_ATTEMPTS) {
  return res.status(403).json({
    success: false,
    error: "Maximum attempts reached"
  });
}

    /* ================= LOAD QUESTIONS ================= */

   const qRes = await pool.query(
  `
  SELECT id, correct_option FROM questions WHERE exam_id = $1

  UNION ALL

  SELECT id, correct_answer AS correct_option 
  FROM exam_questions WHERE course_id = $2

  UNION ALL

  SELECT id, correct_option FROM competitive_questions WHERE exam_id = $1
  `,
  [exam_id, courseId]
);

    const totalQuestions = Object.keys(answers).length;

    if (totalQuestions === 0) {
      return res.status(400).json({
        success: false,
        error: "No questions found for this exam"
      });
    }

    /* ================= CALCULATE SCORE ================= */

    let correctCount = 0;

    qRes.rows.forEach(q => {
      const selectedIndex = Number(answers[q.id]);
      const selectedLetter = ["A", "B", "C", "D"][selectedIndex];

      if (selectedLetter === q.correct_option) {
        correctCount++;
      }
    });

    const percentage = Math.round(
      (correctCount / totalQuestions) * 100
    );

    const status = percentage >= 50 ? "PASSED" : "FAILED";

    console.log("✅ Correct:", correctCount);
    console.log("📊 Percentage:", percentage);
    console.log("🏁 Status:", status);

/* ================= SAVE ATTEMPT ================= */

await pool.query(
  `
  INSERT INTO exam_attempts
  (user_id, exam_id, score, status, attempted_at)
  VALUES ($1,$2,$3,$4,NOW())
  `,
  [userId, exam_id, correctCount, status]
);

/* ================= GENERATE CERTIFICATE ================= */

let certificateId = null;

if (status === "PASSED") {

  const existingCert = await pool.query(
    `SELECT certificate_id FROM certificates
     WHERE user_id = $1 AND exam_id = $2`,
    [userId, exam_id]
  );

  if (existingCert.rows.length > 0) {

    certificateId = existingCert.rows[0].certificate_id;

  } else {

    certificateId =
      "EDU-" + Math.random().toString(36).substring(2, 10).toUpperCase();

    await pool.query(
      `INSERT INTO certificates 
       (certificate_id, user_id, exam_id, course_id, issued_at)
       VALUES ($1,$2,$3,$4,NOW())`,
      [certificateId, userId, exam_id, courseId]
    );
  }
}

/* ================= SAVE RESULT ================= */

const examExists = await pool.query(
  `SELECT id FROM exams WHERE id = $1`,
  [exam_id]
);

if (examExists.rows.length > 0) {

  await pool.query(`
    INSERT INTO exam_results
    (user_id, exam_id, score, total_questions, status, certificate_id, attempted_at)
    VALUES ($1,$2,$3,$4,$5,$6,NOW())
  `, [
    userId,
    exam_id,
    correctCount,
    totalQuestions,
    status,
    certificateId   // ✅ linked correctly
  ]);
}

    /* ================= RESPONSE ================= */

    return res.json({
      success: true,
      score: correctCount,
      total: totalQuestions,
      percentage,
      status,
      certificateId
    });

  } catch (err) {
    console.error("❌ exam submit error:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* ================= CREATE EXAM ================= */
router.post("/", verifyToken, isAdmin, async (req, res) => {

  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Exam title is required" });
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
    res.status(500).json({ message: "Failed to create exam" });
  }
});

router.get("/", verifyToken, async (req, res) => {

  const userId = req.user.id;

  const examsRes = await pool.query(`
    SELECT e.*, m.course_id
    FROM exams e
    JOIN modules m ON m.id = e.module_id
  `);

  const completedCourses = await pool.query(`
    SELECT course_id
    FROM user_courses
    WHERE user_id = $1
  `, [userId]);

  const unlockedExams = await pool.query(`
    SELECT exam_id
    FROM exam_unlocks
    WHERE user_id = $1
  `, [userId]);

  const completedCourseIds = completedCourses.rows.map(r => r.course_id);
  const unlockedExamIds = unlockedExams.rows.map(r => r.exam_id);

  const exams = examsRes.rows.map(exam => {

    const isCompletedCourse = completedCourseIds.includes(exam.course_id);
    const isUnlocked = unlockedExamIds.includes(exam.id);

    const unlocked = isCompletedCourse || isUnlocked;

    return {
      ...exam,
      unlocked,
      unlock_cost: EXAM_UNLOCK_COST
    };
  });

  res.json(exams);
});

router.post("/unlock", verifyToken, async (req, res) => {
  try {
    const { exam_id } = req.body;
    const userId = req.user.id;

    if (!exam_id) {
      return res.status(400).json({ error: "exam_id required" });
    }

    const COIN_RATE = 10;

/* Get exam price */
const examRes = await pool.query(
`SELECT price FROM competitive_exams WHERE id=$1`,
[exam_id]
);

if(!examRes.rows.length){
 return res.status(404).json({error:"Exam not found"});
}

const examPrice = Number(examRes.rows[0].price);

/* convert rupees → coins */
const EXAM_COST = examPrice * COIN_RATE;

    // 🔎 Get wallet
    const walletRes = await pool.query(
      "SELECT coins FROM user_wallets WHERE user_id = $1",
      [userId]
    );

    const walletCoins = walletRes.rows[0]?.coins || 0;

    // 🟢 CASE 1: Enough coins
    if (walletCoins >= EXAM_COST) {

      await pool.query(
        "UPDATE user_wallets SET coins = coins - $1 WHERE user_id = $2",
        [EXAM_COST, userId]
      );


      await pool.query(
        `INSERT INTO coin_transactions (user_id, type, amount)
         VALUES ($1, 'exam_unlock', $2)`,
        [userId, -EXAM_COST]
      );

      await pool.query(
        `INSERT INTO user_exam_unlocks (user_id, exam_id)
         VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [userId, exam_id]
      );

      return res.json({
        success: true,
        method: "coins"
      });
    }

const existing = await pool.query(
`SELECT * FROM user_exam_unlocks
 WHERE user_id=$1 AND exam_id=$2`,
[userId, exam_id]
);

if(existing.rows.length){
 return res.json({
  success:true,
  message:"Already unlocked"
 });
}

    // 🔴 CASE 2: Not enough coins → calculate balance
    const remainingCoins = EXAM_COST - walletCoins;
    const rupeeToPay = Math.ceil(remainingCoins / COIN_RATE);

    return res.json({
      success: false,
      partial: true,
      currentCoins: walletCoins,
      requiredCoins: EXAM_COST,
      remainingCoins,
      rupeeToPay
    });

  } catch (err) {
    console.error("Exam unlock error:", err);
    res.status(500).json({ error: "Unlock failed" });
  }
});

router.post("/confirm-payment", verifyToken, async (req, res) => {
  try {
    const { exam_id } = req.body;
    const userId = req.user.id;

    await pool.query(
      `INSERT INTO user_exam_unlocks (user_id, exam_id)
       VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [userId, exam_id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Exam payment confirm error:", err);
    res.status(500).json({ error: "Payment confirm failed" });
  }
});



router.get("/exams-view", verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        e.id,
        e.title AS exam_name,
        COUNT(q.id) AS total_questions,
        CASE 
          WHEN e.active = true THEN 'Active'
          ELSE 'Inactive'
        END AS status
      FROM exams e
      LEFT JOIN questions q ON q.exam_id = e.id
      GROUP BY e.id
      ORDER BY e.id ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Admin exams-view error:", err);
    res.status(500).json({ error: "Failed to load exams" });
  }
});

/* ================= Delete EXAM ================= */
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const examId = req.params.id;

    await pool.query("DELETE FROM exams WHERE id = $1", [examId]);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete exam error:", err);
    res.status(500).json({ error: "Failed to delete exam" });
  }
});

/* ================= ADMIN EXAMS ================= */

// 📥 Get all exams
router.get("/exams-view", verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        e.id,
        e.title,
        e.course_id,
        e.active,
        COUNT(q.id) AS total_questions
      FROM exams e
      LEFT JOIN questions q ON q.exam_id = e.id
      GROUP BY e.id
      ORDER BY e.id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Admin exams-view error:", err);
    res.status(500).json({ error: "Failed to load exams" });
  }
});

// ➕ Create exam
router.post("/exams", verifyToken, isAdmin, async (req, res) => {
  try {
    const { title, course_id } = req.body;

    if (!title || !course_id) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const result = await pool.query(
      `
      INSERT INTO exams (title, course_id, active)
      VALUES ($1, $2, true)
      RETURNING *
      `,
      [title, course_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create exam error:", err);
    res.status(500).json({ error: "Failed to create exam" });
  }
});

// 🗑 Delete exam
router.delete("/exams/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const examId = Number(req.params.id);
    await pool.query(`DELETE FROM exams WHERE id = $1`, [examId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete exam error:", err);
    res.status(500).json({ error: "Failed to delete exam" });
  }
});

// 🔁 Toggle exam active
router.patch("/exams/:id/toggle", verifyToken, isAdmin, async (req, res) => {
  try {
    const examId = Number(req.params.id);

    const result = await pool.query(`
      UPDATE exams
      SET active = NOT active
      WHERE id = $1
      RETURNING active
    `, [examId]);

    res.json({ active: result.rows[0].active });
  } catch (err) {
    console.error("Toggle exam error:", err);
    res.status(500).json({ error: "Failed to toggle exam" });
  }
});

/* ======================================================
   TOGGLE EXAM ACTIVE STATUS (ADMIN)
====================================================== */
router.patch("/:id/toggle", verifyToken, isAdmin, async (req, res) => {

  try {
    const examId = Number(req.params.id);

    if (!examId) {
      return res.status(400).json({ error: "Invalid exam id" });
    }

    const result = await pool.query(
      `
      UPDATE exams
      SET active = NOT active
      WHERE id = $1
      RETURNING id, title, active
      `,
      [examId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Exam not found" });
    }

    res.json({
      success: true,
      exam: result.rows[0]
    });

  } catch (err) {
    console.error("❌ Toggle exam error:", err);
    res.status(500).json({ error: "Failed to toggle exam" });
  }
});

module.exports = router;
