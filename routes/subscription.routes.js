const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");
const controller = require("../controllers/subscription.controller");

// Admin routes
router.get("/plans", verifyToken, isAdmin, controller.getPlans);
router.post("/plans", verifyToken, isAdmin, controller.createPlan);
router.put("/plans", verifyToken, isAdmin, controller.updatePlan);
router.delete("/plans/:id", verifyToken, isAdmin, controller.deletePlan);

const userController = require("../controllers/subscription.user.controller");

router.post("/subscribe", verifyToken, userController.subscribe);

// ✅ Public - get active plans (for students)
router.get("/public-plans", verifyToken, async (req, res) => {
  try {
    const pool = require("../db");
    const result = await pool.query(
      "SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Public plans error:", err);
    res.status(500).json({ error: "Failed to load plans" });
  }
});

module.exports = router;
