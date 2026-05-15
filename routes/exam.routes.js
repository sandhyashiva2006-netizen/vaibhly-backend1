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

    const userId = req.user.id;
    const examId = Number(req.params.examId);

    if (!examId) {
      return res.status(400).json({
        success:false,
        error:"Invalid exam ID"
      });
    }

    /* ================= DETECT EXAM TYPE ================= */

    let examRes = await pool.query(
      `
      SELECT course_id, type
      FROM exams
      WHERE id = $1
      `,
      [examId]
    );

    let courseId = null;
    let examType = "course";

    if (examRes.rows.length) {

      courseId = examRes.rows[0].course_id;
      examType = examRes.rows[0].type || "course";

    } else {

      const compRes = await pool.query(
        `
        SELECT id
        FROM competitive_exams
        WHERE id = $1 AND active = true
        `,
        [examId]
      );

      if (!compRes.rows.length) {
        return res.status(404).json({
          success:false,
          error:"Exam not found"
        });
      }

      examType = "competitive";
    }

    /* =====================================================
       COMPETITIVE EXAM TOKEN CHECK
    ===================================================== */

    if (examType === "competitive") {

      const tokenCheck = await pool.query(
        `
        SELECT attempts
        FROM user_exam_tokens
        WHERE user_id = $1
        AND exam_id = $2
        `,
        [userId, examId]
      );

      if (
        !tokenCheck.rows.length ||
        Number(tokenCheck.rows[0].attempts) <= 0
      ) {
        return res.status(403).json({
          success:false,
          error:"No attempts available. Purchase again."
        });
      }

}

    /* ================= LOAD QUESTIONS ================= */

    let result;

    if (examType === "competitive") {

      result = await pool.query(
        `
        SELECT id, question, option_a, option_b, option_c, option_d
        FROM competitive_questions
        WHERE exam_id = $1
        ORDER BY id ASC
        `,
        [examId]
      );

    } else {

      result = await pool.query(
        `
        SELECT id, question, option_a, option_b, option_c, option_d
        FROM questions
        WHERE exam_id = $1

        UNION ALL

        SELECT id, question, option_a, option_b, option_c, option_d
        FROM exam_questions
        WHERE course_id = $2
        `,
        [examId, courseId]
      );
    }

    const questions = result.rows.map(q => ({
      id: q.id,
      question: q.question,
      options: [
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d
      ]
    }));

    return res.json({
      success:true,
      questions
    });

  } catch(err) {

    console.error(err);

    return res.status(500).json({
      success:false,
      error:"Failed to load questions"
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
  FROM exam_attempts ea
  WHERE ea.exam_id = e.id
  AND ea.user_id = $1
  AND ea.status = 'PASSED'
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

const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

router.post("/create-order", verifyToken, async (req, res) => {
  try {

    const { exam_id, amount } = req.body;

    if (!exam_id || !amount) {
      return res.status(400).json({
        error: "Missing fields"
      });
    }

    const options = {
      amount: Number(amount) * 100,
      currency: "INR",
      receipt: "exam_" + Date.now()
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      amount: options.amount,
      orderId: order.id,
      dbOrderId: Date.now()
    });

  } catch (err) {
    console.error("Create order error:", err);

    res.status(500).json({
      error: "Failed to create order"
    });
  }
});

/* ======================================================
   SUBMIT EXAM (CRITICAL FIX)
====================================================== */


router.post("/submit", verifyToken, async (req, res) => {
  try {

    const userId = req.user.id;
    const { exam_id, answers } = req.body;

    if (!exam_id || !answers) {
      return res.status(400).json({
        success: false,
        error: "Invalid submission data"
      });
    }

    /* ================= DETECT EXAM TYPE ================= */

    let examInfo = await pool.query(
      `
      SELECT course_id, type
      FROM exams
      WHERE id = $1
      `,
      [exam_id]
    );

    let courseId = null;
    let examType = "course";

    if (examInfo.rows.length > 0) {

      courseId = examInfo.rows[0].course_id;
      examType = examInfo.rows[0].type || "course";

    } else {

      const compRes = await pool.query(
        `
        SELECT id
        FROM competitive_exams
        WHERE id = $1 AND active = true
        `,
        [exam_id]
      );

      if (!compRes.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Exam not found"
        });
      }

      examType = "competitive";
    }

    /* ================= COURSE ACCESS CHECK ================= */

    if (examType === "course") {

      const accessCheck = await pool.query(
        `
        SELECT 1
        FROM user_courses
        WHERE user_id = $1 AND course_id = $2
        `,
        [userId, courseId]
      );

      if (!accessCheck.rows.length) {
        return res.status(403).json({
          success: false,
          error: "You are not enrolled in this course"
        });
      }
    }

    /* ================= LOAD ANSWERS ================= */

    let qRes;

    if (examType === "competitive") {

      qRes = await pool.query(
        `
        SELECT id, correct_option
        FROM competitive_questions
        WHERE exam_id = $1
        `,
        [exam_id]
      );

    } else {

      qRes = await pool.query(
        `
        SELECT id, correct_option
        FROM questions
        WHERE exam_id = $1

        UNION ALL

        SELECT id, correct_answer AS correct_option
        FROM exam_questions
        WHERE course_id = $2
        `,
        [exam_id, courseId]
      );
    }

    const totalQuestions =
  qRes.rows.length;


    /* ================= CALCULATE SCORE ================= */

    let correctCount = 0;

    qRes.rows.forEach(q => {

      const selectedIndex = Number(answers[q.id]);
      const selectedLetter =
        ["A", "B", "C", "D"][selectedIndex];

      if (selectedLetter === q.correct_option) {
        correctCount++;
      }
    });

    const percentage = Math.round(
      (correctCount / totalQuestions) * 100
    );

    const status =
      percentage >= 50 ? "PASSED" : "FAILED";

    /* ================= SAVE ATTEMPT ================= */

    await pool.query(
      `
      INSERT INTO exam_attempts
      (user_id, exam_id, score, status, attempted_at)
      VALUES ($1,$2,$3,$4,NOW())
      `,
      [userId, exam_id, correctCount, status]
    );

    /* ================= CERTIFICATE ================= */

    let certificateId = null;

    if (status === "PASSED") {

      const existingCert = await pool.query(
        `
        SELECT certificate_id
        FROM certificates
        WHERE user_id = $1
        AND exam_id = $2
        `,
        [userId, exam_id]
      );

      if (existingCert.rows.length) {

        certificateId =
          existingCert.rows[0].certificate_id;

      } else {

        certificateId =
          "EDU-" +
          Math.random()
            .toString(36)
            .substring(2, 10)
            .toUpperCase();

let competitiveTitle = "";

if (examType === "competitive") {

  const titleRes = await pool.query(
    `
    SELECT title
    FROM competitive_exams
    WHERE id = $1
    `,
    [exam_id]
  );

  competitiveTitle =
    titleRes.rows[0]?.title || "Competitive Exam";
}

await pool.query(
`
INSERT INTO certificates
(
 user_id,
 exam_id,
 course_id,
 certificate_id,
 type,
 certificate_title,
 issued_at
)
VALUES ($1,$2,$3,$4,$5,$6,NOW())
`,
[
 userId,

 examType === "competitive"
   ? null
   : exam_id,

 examType === "competitive"
   ? null
   : courseId,

 certificateId,

 examType === "competitive"
   ? "competitive"
   : "course",

 examType === "competitive"
   ? competitiveTitle
   : null
]
);
      }
    }

    /* ================= REWARD COINS ================= */

    const rewardCoins =
      status === "PASSED"
        ? (examType === "competitive" ? 30 : 20)
        : 5;

    await pool.query(
      `
      INSERT INTO user_wallets (user_id, coins)
      VALUES ($1,$2)

      ON CONFLICT (user_id)
      DO UPDATE
      SET coins =
      user_wallets.coins + EXCLUDED.coins
      `,
      [userId, rewardCoins]
    );

    /* ================= SAVE RESULT ================= */

    const normalExamExists = await pool.query(
      `
      SELECT id FROM exams WHERE id = $1
      `,
      [exam_id]
    );

    if (normalExamExists.rows.length) {

      await pool.query(
        `
        INSERT INTO exam_results
        (user_id, exam_id, score, total_questions, status, certificate_id, attempted_at)
        VALUES ($1,$2,$3,$4,$5,$6,NOW())
        `,
        [
          userId,
          exam_id,
          correctCount,
          totalQuestions,
          status,
          certificateId
        ]
      );
    }

/* ===== CONSUME TOKEN AFTER SUBMIT ===== */

if(examType === "competitive"){

  await pool.query(
    `
    UPDATE user_exam_tokens

    SET attempts =
      attempts - 1

    WHERE user_id = $1
    AND exam_id = $2
    `,
    [userId, exam_id]
  );

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

    return res.status(500).json({
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




const crypto = require("crypto");

router.post("/confirm-payment", verifyToken, async (req, res) => {
  try {

    const userId = req.user.id;

    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      exam_id,
      dbOrderId
    } = req.body;

    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !exam_id
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing payment data"
      });
    }

    /* ==========================================
       VERIFY SIGNATURE
    ========================================== */

    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        razorpay_order_id + "|" + razorpay_payment_id
      )
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: "Invalid payment signature"
      });
    }

    /* ==========================================
       CHECK EXAM EXISTS
    ========================================== */

    const examRes = await pool.query(
      `
      SELECT id, title, price
      FROM competitive_exams
      WHERE id = $1 AND active = true
      `,
      [exam_id]
    );

    if (!examRes.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Exam not found"
      });
    }

    const exam = examRes.rows[0];
    const price = Number(exam.price);

    /* ==========================================
       LOAD USER WALLET
       10 coins = ₹1
    ========================================== */

    const COINS_PER_RUPEE = 10;

    const walletRes = await pool.query(
      `
      SELECT coins
      FROM user_wallets
      WHERE user_id = $1
      `,
      [userId]
    );

    const coins = walletRes.rows[0]?.coins || 0;

    const maxCoinsToUse =
      Math.min(
        coins,
        price * COINS_PER_RUPEE
      );

    /* ==========================================
       DEDUCT USED COINS
    ========================================== */

    if (maxCoinsToUse > 0) {

      await pool.query(
        `
        UPDATE user_wallets
        SET coins = coins - $1
        WHERE user_id = $2
        `,
        [maxCoinsToUse, userId]
      );
    }

    /* ==========================================
       SAVE EXAM UNLOCK
    ========================================== */

    await pool.query(
`
INSERT INTO user_exam_tokens
(user_id, exam_id, attempts)

VALUES ($1,$2,1)

ON CONFLICT (user_id, exam_id)

DO UPDATE SET attempts =
user_exam_tokens.attempts + 1
`,
[userId, exam_id]
);

    /* ==========================================
       OPTIONAL ORDER HISTORY TABLE
       only if table exists
    ========================================== */

    try {

      await pool.query(
        `
        INSERT INTO exam_orders
        (
          user_id,
          exam_id,
          payment_id,
          order_id,
          amount,
          created_at
        )
        VALUES ($1,$2,$3,$4,$5,NOW())
        `,
        [
          userId,
          exam_id,
          razorpay_payment_id,
          razorpay_order_id,
          price
        ]
      );

    } catch (e) {
      console.log(
        "exam_orders table optional, skipped"
      );
    }

    /* ==========================================
       SUCCESS
    ========================================== */

    return res.json({
      success: true,
      message: "Exam unlocked successfully"
    });

  } catch (err) {

    console.error(
      "confirm-payment error:",
      err
    );

    return res.status(500).json({
      success: false,
      error: "Payment confirmation failed"
    });
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




router.get("/tokens/:examId", verifyToken, async (req,res)=>{

const userId = req.user.id;
const examId = req.params.examId;

const result = await pool.query(
`
SELECT attempts
FROM user_exam_tokens
WHERE user_id=$1 AND exam_id=$2
`,
[userId, examId]
);

res.json({
attempts: result.rows[0]?.attempts || 0
});

});

/* ================= UNLOCK EXAM ================= */

router.post(
  "/unlock/:examId",
  verifyToken,
  async (req, res) => {

    try {

      const userId = req.user.id;

      const examId =
        Number(req.params.examId);

      /* ===== LOAD EXAM ===== */

      const examRes = await pool.query(
        `
        SELECT
          id,
          title,
          price
        FROM competitive_exams
        WHERE id = $1
        `,
        [examId]
      );

      if (!examRes.rowCount) {

        return res.status(404).json({
          success:false,
          error:"Exam not found"
        });

      }

      const exam =
        examRes.rows[0];

      /* ===== USER WALLET ===== */

      const walletRes = await pool.query(
        `
        SELECT coins
        FROM user_wallets
        WHERE user_id = $1
        `,
        [userId]
      );

      const coins =
        Number(
          walletRes.rows[0]?.coins || 0
        );

      /* =========================================
         DIRECT COIN UNLOCK
      ========================================= */

      if (coins >= Number(exam.price)) {

        /* deduct coins */

        await pool.query(
          `
          UPDATE user_wallets

          SET coins =
            coins - $1

          WHERE user_id = $2
          `,
          [
            Number(exam.price),
            userId
          ]
        );

await pool.query(
  `
  INSERT INTO wallet_ledger
  (
    user_id,
    amount,
    type,
    purpose
  )

  VALUES ($1,$2,$3,$4)
  `,
  [
    userId,
    -Number(exam.price),
    'exam_purchase',
    'Competitive Exam Purchase'
  ]
);

        /* add attempt */

        await pool.query(
          `
          INSERT INTO user_exam_tokens
          (
            user_id,
            exam_id,
            attempts
          )

          VALUES ($1,$2,1)

          ON CONFLICT
          (user_id, exam_id)

          DO UPDATE SET

          attempts =
          user_exam_tokens.attempts + 1
          `,
          [userId, examId]
        );

        return res.json({

          success:true,

          directUnlock:true,

          redirect:
            `/exam.html?id=${examId}`,

          usedCoins:true

        });

      }

      /* =========================================
         PAYMENT REQUIRED
      ========================================= */

      return res.json({

        success:true,

        directUnlock:false,

        payable:Number(exam.price),

        price:Number(exam.price),

        coins,

        discount:0

      });

    } catch(err) {

      console.error(
        "UNLOCK ERROR:",
        err
      );

      return res.status(500).json({

        success:false,

        error:"Unlock failed"

      });

    }

  }
);

/* ================= COURSE EXAM QUESTIONS ================= */

router.get(
"/course/:courseId",

verifyToken,

async(req,res)=>{

try{

const courseId =
Number(req.params.courseId);

if(!courseId){

return res.status(400).json({
error:"Invalid course ID"
});

}

const result =
await pool.query(
`
SELECT *
FROM exam_questions
WHERE course_id = $1
ORDER BY id ASC
`,
[courseId]
);

return res.json(result.rows);

}catch(err){

console.error(
"Load course exam questions error:",
err
);

return res.status(500).json({
error:"Failed to load exam questions"
});

}

}
);

module.exports = router;
