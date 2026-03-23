const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth.middleware");
const { getRecommendations } = require("../services/recommendation.service");

router.get("/my", verifyToken, async (req, res) => {
  try {
    const tips = await getRecommendations(req.user.id);
    res.json({ tips });
  } catch (err) {
    console.error("Recommendation error:", err);
    res.status(500).json({ error: "Failed to load recommendations" });
  }
});

module.exports = router;
