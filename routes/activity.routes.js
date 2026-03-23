const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");

/* ================= TRACK ACTIVITY ================= */
router.post("/track", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { lesson_id, seconds } = req.body;

    if (!lesson_id || !seconds) {
      return res.status(400).json({ error: "lesson_id and seconds required" });
    }

    // ✅ 1. Track activity (increment time)
    await pool.query(`
      INSERT INTO activity (user_id, lesson_id, seconds_spent, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id, lesson_id)
      DO UPDATE SET
        seconds_spent = activity.seconds_spent + EXCLUDED.seconds_spent,
        updated_at = NOW()
    `, [userId, lesson_id, seconds]);

    // ✅ 2. Read total time for this lesson
    const timeRes = await pool.query(`
      SELECT seconds_spent
      FROM activity
      WHERE user_id = $1 AND lesson_id = $2
    `, [userId, lesson_id]);

    const totalSeconds = Number(timeRes.rows[0]?.seconds_spent || 0);
    console.log("⏱ Lesson watch time:", totalSeconds);

    // ✅ 3. Auto mark lesson complete after 30 seconds
    if (totalSeconds >= 30) {
      await pool.query(`
        INSERT INTO progress (user_id, lesson_id, completed, updated_at)
        VALUES ($1, $2, true, NOW())
        ON CONFLICT (user_id, lesson_id)
        DO UPDATE SET
          completed = true,
          updated_at = NOW()
      `, [userId, lesson_id]);

      console.log("✅ Lesson marked completed:", lesson_id);
    }

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Activity track error:", err);
    res.status(500).json({ error: "Failed to track activity" });
  }
});


/* ================= MY ACTIVITY SUMMARY ================= */
router.get("/my", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const totals = await pool.query(`
      SELECT
        COALESCE(SUM(seconds_spent),0) AS total_seconds,
        COUNT(DISTINCT lesson_id) AS lessons_completed
      FROM activity
      WHERE user_id = $1
    `, [userId]);

    const recent = await pool.query(`
      SELECT lesson_id, seconds_spent, updated_at
      FROM activity
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 5
    `, [userId]);

    const daily = await pool.query(`
  SELECT
    to_char(
      (updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date,
      'YYYY-MM-DD'
    ) AS activity_date,
    ROUND(SUM(seconds_spent)/60) AS minutes_spent
  FROM activity
  WHERE user_id = $1
  GROUP BY activity_date
  ORDER BY activity_date
`, [userId]);



    res.json({
      totals: totals.rows[0],
      recent: recent.rows,
      daily: daily.rows
    });

  } catch (err) {
    console.error("❌ Load activity error:", err);
    res.status(500).json({ error: "Failed to load activity" });
  }
});



module.exports = router;
