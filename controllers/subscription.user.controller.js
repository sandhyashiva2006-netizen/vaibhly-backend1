const pool = require("../db");

exports.subscribe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan_id } = req.body;

    const planRes = await pool.query(
      "SELECT * FROM subscription_plans WHERE id=$1 AND is_active=true",
      [plan_id]
    );

    if (!planRes.rows.length) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const plan = planRes.rows[0];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration_days);

    await pool.query(
      `INSERT INTO user_subscriptions
       (user_id, plan_id, start_date, end_date, status)
       VALUES ($1,$2,NOW(),$3,'ACTIVE')`,
      [userId, plan_id, endDate]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Subscribe error:", err);
    res.status(500).json({ error: "Subscription failed" });
  }
};
