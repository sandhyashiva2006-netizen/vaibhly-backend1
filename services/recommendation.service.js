const pool = require("../config/db");

async function getRecommendations(userId) {

  const tips = [];

  try {
    // 🔍 Count completed lessons safely
    const completedRes = await pool.query(`
      SELECT COUNT(*) AS completed
      FROM lesson_activity
      WHERE user_id = $1
    `, [userId]);

    const completed = Number(completedRes.rows[0]?.completed || 0);

    // 🕒 Last activity
    const lastActivity = await pool.query(`
      SELECT seconds_spent, last_active
      FROM lesson_activity
      WHERE user_id = $1
      ORDER BY last_active DESC
      LIMIT 1
    `, [userId]);

    const recent = lastActivity.rows[0];

    if (completed === 0) {
      tips.push("🚀 Start your first lesson to begin tracking progress.");
    }

    if (recent && recent.seconds_spent < 120) {
      tips.push("⏱ Spend more time on lessons for better understanding.");
    }

    if (completed >= 3) {
      tips.push("🏆 You're making good progress. Try attempting an exam soon.");
    }

  } catch (err) {
    console.error("Recommendation engine error:", err);
  }

  // Always return at least one tip
  if (!tips.length) {
    tips.push("📅 Study at least 30 minutes daily to stay consistent.");
  }

  return tips;
}

module.exports = { getRecommendations };
