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

    const result = await pool.query(`
      SELECT amount, type, purpose, created_at
      FROM wallet_ledger
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [req.user.id]);

    res.json({
      success: true,
      transactions: result.rows
    });

  } catch (err) {
    console.error(err);
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

router.post("/reward-course", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { course_id } = req.body;

    const already = await pool.query(`
      SELECT 1
      FROM wallet_ledger
      WHERE user_id = $1
      AND type = 'course_complete'
      AND reference_id = $2
      LIMIT 1
    `, [userId, course_id]);

    if (already.rows.length) {
      return res.json({ success: true, message: "Already rewarded" });
    }

    await pool.query(`
      UPDATE user_wallets
      SET coins = coins + 50
      WHERE user_id = $1
    `, [userId]);

    await pool.query(`
      INSERT INTO wallet_ledger
      (user_id, amount, type, reference_id, purpose)
      VALUES ($1,$2,'course_complete',$3,$4)
    `, [
      userId,
      50,
      course_id,
      'Course Completion Reward'
    ]);

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: "Reward failed" });
  }
});

router.get("/store-items", async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT
        id,
        name,
        coins,
        price,
        active
      FROM marketplace_items
      WHERE active = true
      ORDER BY coins ASC
    `);

    res.json(result.rows);

  } catch (err) {

    console.error("Store items error:", err);

    res.status(200).json([]);
  }
});

router.post("/buy", verifyToken, async (req, res) => {

  try {

    const userId = req.user.id;

    const { item_id } = req.body;

    /* ===== GET ITEM ===== */

    const itemRes = await pool.query(
      `
      SELECT *
      FROM marketplace_items
      WHERE id = $1
      AND is_active = true
      `,
      [item_id]
    );

    if (!itemRes.rows.length) {

      return res.status(404).json({
        error: "Item not found"
      });

    }

    const item = itemRes.rows[0];

    /* ===== USER WALLET ===== */

    const wallet = await pool.query(
      `
      SELECT coins
      FROM user_wallets
      WHERE user_id = $1
      `,
      [userId]
    );

    const userCoins =
      wallet.rows[0]?.coins || 0;

    /* ===== CHECK BALANCE ===== */

    if (userCoins < item.coins) {

      return res.status(400).json({
        error: "Not enough coins"
      });

    }

    /* ===== DEDUCT COINS ===== */

    await pool.query(
      `
      UPDATE user_wallets
      SET coins = coins - $1
      WHERE user_id = $2
      `,
      [item.coins, userId]
    );

    /* ===== WALLET HISTORY ===== */

    await pool.query(
      `
      INSERT INTO wallet_ledger
      (user_id, amount, type, purpose)

      VALUES ($1,$2,$3,$4)
      `,
      [
        userId,
        -item.coins,
        'store_purchase',
        item.name || 'Store Item Purchase'
      ]
    );

    /* ===== SUCCESS ===== */

    res.json({

      success: true,

      item

    });

  } catch (err) {

    console.error(
      "Store purchase error:",
      err
    );

    res.status(500).json({
      error: "Purchase failed"
    });

  }

});

router.post("/buy-coins", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { pack } = req.body;

    const packs = {
      starter: 250,
      popular: 600,
      pro: 1400
    };

    if (!packs[pack]) {
      return res.status(400).json({ error: "Invalid pack" });
    }

    const coins = packs[pack];

    await pool.query(`
      INSERT INTO user_wallets (user_id, coins)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET coins = user_wallets.coins + EXCLUDED.coins
    `, [userId, coins]);

    await pool.query(`
INSERT INTO wallet_ledger
(user_id, amount, type, purpose)
VALUES ($1,$2,$3,$4)
`,[
 userId,
 coins,
 'coin_purchase',
 'Coin Pack Purchase'
]);

    res.json({
      success: true,
      coins
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Purchase failed" });
  }
});

module.exports = router;
