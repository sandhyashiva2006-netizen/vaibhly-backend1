const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");
const analyticsController = require("../controllers/analytics.controller");

router.get(
  "/summary",
  verifyToken,
  isAdmin,
  analyticsController.getAnalyticsSummary
);

module.exports = router;
