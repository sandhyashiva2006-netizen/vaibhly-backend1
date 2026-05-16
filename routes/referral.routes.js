const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const verifyToken = require("../middleware/verifyToken");

/* ================= GET MY REFERRAL DATA ================= */
router.get("/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await pool.query(
      `
      SELECT id, name, email, referral_code
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    let user = userResult.rows[0];

    /*
      If old user has no referral code,
      create one automatically.
    */
    if (!user.referral_code) {
      const newCode =
        "VAI" +
        userId +
        Math.random().toString(36).substring(2, 7).toUpperCase();

      const updateResult = await pool.query(
        `
        UPDATE users
        SET referral_code = $1
        WHERE id = $2
        RETURNING id, name, email, referral_code
        `,
        [newCode, userId]
      );

      user = updateResult.rows[0];
    }

    const referralsResult = await pool.query(
      `
      SELECT id, name, email, created_at
      FROM users
      WHERE referred_by = $1
      ORDER BY created_at DESC
      `,
      [user.referral_code]
    );

    return res.json({
      referral_code: user.referral_code,
      ref_count: referralsResult.rows.length,
      referrals: referralsResult.rows
    });

  } catch (err) {
    console.error("REFERRAL ME ERROR:", err);

    return res.status(500).json({
      error: "Failed to load referral data",
      details: err.message
    });
  }
});

module.exports = router;