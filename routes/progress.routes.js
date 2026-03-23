const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");

/* ================= MARK LESSON COMPLETED ================= */
router.post("/complete", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { lesson_id } = req.body;

    if (!lesson_id) {
      return res.status(400).json({ error: "lesson_id required" });
    }

    // 🔥 Try inserting completion
    const insertResult = await pool.query(`
      INSERT INTO lesson_progress (user_id, lesson_id, completed_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id, lesson_id) DO NOTHING
      RETURNING *
    `, [userId, lesson_id]);

    // If no row inserted → already completed
    if (!insertResult.rows.length) {
      return res.json({ success: true, alreadyCompleted: true });
    }

    // ==============================
    // 🎁 GIVE LESSON COINS
    // ==============================

    const lessonCoins = 5;

    await pool.query(`
      UPDATE user_wallets
      SET coins = coins + $1
      WHERE user_id = $2
    `, [lessonCoins, userId]);

    console.log("🪙 Lesson reward given:", lessonCoins);

    // ==============================
    // 🔥 STREAK LOGIC
    // ==============================

    const today = new Date();
const todayStr = today.toISOString().split("T")[0];

const userRes = await pool.query(
  `SELECT streak_count, last_active_date
   FROM users
   WHERE id = $1`,
  [userId]
);

const user = userRes.rows[0] || { streak_count: 0, last_active_date: null };


let newStreak = user.streak_count || 1;


if (user.last_active_date) {
  const lastDate = new Date(user.last_active_date);

  const diffTime = today - lastDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // same day — no increment
    newStreak = user.streak_count;
  }
  else if (diffDays === 1) {
    // consecutive day
    newStreak = user.streak_count + 1;
  }
  else {
    // skipped day(s) → reset to 1
    newStreak = 1;
  }
}

await pool.query(
  `UPDATE users
   SET streak_count = $1,
       last_active_date = $2
   WHERE id = $3`,
  [newStreak, todayStr, userId]
);


    console.log("🔥 Streak updated:", newStreak);

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Save progress error:", err);
    res.status(500).json({ error: "Failed to save progress" });
  }
});


/* ================= GET COMPLETED LESSONS ================= */
router.get("/my-progress", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const courseIdRaw = req.query.course_id;

    const courseId =
      courseIdRaw && !isNaN(courseIdRaw)
        ? Number(courseIdRaw)
        : null;

    console.log("📥 Progress request:", { userId, courseId });

    let sql = `
      SELECT p.lesson_id
      FROM lesson_progress p
      JOIN lessons l ON l.id = p.lesson_id
      JOIN modules m ON m.id = l.module_id
      WHERE p.user_id = $1
    `;

    const params = [userId];

    if (courseId) {
      sql += ` AND m.course_id = $2`;
      params.push(courseId);
    }

    const result = await pool.query(sql, params);

    const lessonIds = result.rows
      .map(r => Number(r.lesson_id))
      .filter(Boolean);

    console.log("✅ Progress rows:", lessonIds);

    res.json(lessonIds);

  } catch (err) {
    console.error("❌ Get progress error:", err);
    res.status(500).json([]);
  }
});

/* ================= LEARNING HISTORY ================= */
router.get("/history", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const courseIdRaw = req.query.course_id;

    const courseId = courseIdRaw && !isNaN(courseIdRaw)
      ? Number(courseIdRaw)
      : null;

    let sql = `
      SELECT
        p.lesson_id,
        p.completed_at,
        l.title AS lesson_title,
        m.title AS module_title
      FROM lesson_progress p
      JOIN lessons l ON l.id = p.lesson_id
      JOIN modules m ON m.id = l.module_id
      WHERE p.user_id = $1
    `;

    const params = [userId];

    if (courseId) {
      sql += ` AND m.course_id = $2`;
      params.push(courseId);
    }

    sql += ` ORDER BY p.completed_at DESC`;

    const result = await pool.query(sql, params);
    res.json(result.rows);

  } catch (err) {
    console.error("❌ History error:", err);
    res.status(500).json([]);
  }
});

router.get("/streak", verifyToken, async (req, res) => {
  try {
    const user = await pool.query(
      `SELECT streak_count FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (!user.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ streak: user.rows[0].streak_count });

  } catch (err) {
    console.error("Streak fetch error:", err);
    res.status(500).json({ error: "Failed to fetch streak" });
  }
});


module.exports = router;
