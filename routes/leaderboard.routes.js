const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");

/* ================= STUDENT LEADERBOARD ================= */
router.get("/", verifyToken, async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        w.coins
      FROM user_wallets w
      JOIN users u
      ON u.id = w.user_id
      WHERE u.role = 'student'
      ORDER BY w.coins DESC
      LIMIT 10
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

module.exports = router;