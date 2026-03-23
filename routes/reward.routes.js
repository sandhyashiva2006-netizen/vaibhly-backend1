const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");

/* ================= WEEKLY CHEST ================= */
router.post("/weekly-chest", verifyToken, async (req, res) => {
console.log("🔥 Weekly chest route hit");

  try {
    const userId = req.user.id;

    const userRes = await pool.query(
      `SELECT streak_count, last_chest_claim_date
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const user = userRes.rows[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.streak_count < 7) {
      return res.status(400).json({
        error: "Reach 7 day streak first"
      });
    }

    const today = new Date().toISOString().split("T")[0];

    if (user.last_chest_claim_date === today) {
      return res.status(400).json({
        error: "Chest already claimed today"
      });
    }

    const rewardCoins = 50;

    // 🎁 Add coins
    await pool.query(
      `UPDATE user_wallets
       SET coins = coins + $1
       WHERE user_id = $2`,
      [rewardCoins, userId]
    );

    // 🪙 Log transaction
    await pool.query(
      `INSERT INTO coin_transactions (user_id, type, amount)
       VALUES ($1, 'weekly_chest', $2)`,
      [userId, rewardCoins]
    );

    // 🔥 RESET STREAK
    await pool.query(
      `UPDATE users
       SET streak_count = 0,
           last_active_date = NULL,
           last_chest_claim_date = $1
       WHERE id = $2`,
      [today, userId]
    );

    console.log("🎁 Weekly chest claimed, streak reset");
console.log("✅ Chest success sending response");

    res.json({
      success: true,
      reward: rewardCoins
    });

  } catch (err) {
    console.error("Weekly chest error:", err);
    res.status(500).json({ error: "Chest claim failed" });
  }
});

module.exports = router;
