const pool = require("../db");

/* ================= ADMIN: PLANS ================= */

// Get all plans
exports.getPlans = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM subscription_plans ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get plans error:", err);
    res.status(500).json({ error: "Failed to load plans" });
  }
};

// Create plan
exports.createPlan = async (req, res) => {
  try {
    const { name, price, duration_days, description } = req.body;

    if (!name || !price || !duration_days) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const result = await pool.query(
      `INSERT INTO subscription_plans
       (name, price, duration_days, description)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [name, price, duration_days, description]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create plan error:", err);
    res.status(500).json({ error: "Failed to create plan" });
  }
};

// Update plan
exports.updatePlan = async (req, res) => {
  try {
    const { id, name, price, duration_days, description, is_active } = req.body;

    const result = await pool.query(
      `UPDATE subscription_plans
       SET name=$1, price=$2, duration_days=$3,
           description=$4, is_active=$5
       WHERE id=$6 RETURNING *`,
      [name, price, duration_days, description, is_active, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update plan error:", err);
    res.status(500).json({ error: "Failed to update plan" });
  }
};

// Delete plan (optional)
exports.deletePlan = async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM subscription_plans WHERE id=$1",
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Delete plan error:", err);
    res.status(500).json({ error: "Failed to delete plan" });
  }
};
