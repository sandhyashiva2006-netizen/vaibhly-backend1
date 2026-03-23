const pool = require("../db");

module.exports = async function verifySubscription(req, res, next) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT *
       FROM user_subscriptions
       WHERE user_id = $1
         AND status = 'ACTIVE'
         AND end_date >= NOW()
       ORDER BY end_date DESC
       LIMIT 1`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(403).json({
        error: "Active subscription required"
      });
    }

    req.subscription = result.rows[0];
    next();

  } catch (err) {
    console.error("Subscription middleware error:", err);
    res.status(500).json({ error: "Subscription validation failed" });
  }
};
