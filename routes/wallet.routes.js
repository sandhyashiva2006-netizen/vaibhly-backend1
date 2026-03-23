const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");

/* ================= GET WALLET BALANCE ================= */
router.get("/balance", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT coins FROM user_wallets WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({
      success: true,
      coins: result.rows[0]?.coins || 0
    });
  } catch (err) {
    console.error("Wallet balance error:", err);
    res.status(500).json({ error: "Failed to load wallet" });
  }
});

/* ================= GET WALLET TRANSACTIONS ================= */
router.get("/transactions", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT type, amount, reference_id, created_at
      FROM coin_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [req.user.id]
    );

    res.json({
      success: true,
      transactions: result.rows
    });
  } catch (err) {
    console.error("Wallet transactions error:", err);
    res.status(500).json({ error: "Failed to load transactions" });
  }
});

router.get("/streak", verifyToken, async (req, res) => {
  const user = await pool.query(
    `SELECT streak_count FROM users WHERE id = $1`,
    [req.user.id]
  );

  res.json({ streak: user.rows[0].streak_count });
});

module.exports = router;
