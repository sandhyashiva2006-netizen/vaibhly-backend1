const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth.middleware");
const pool = require("../config/db");

// ================= STUDENT PROFILE =================
router.get("/profile", verifyToken, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("req.user missing:", req.user);
      return res.status(401).json({ error: "Invalid token payload" });
    }

    const result = await pool.query(
  `
  SELECT
    u.id,
    u.name,
u.username,
u.role,
    c.course_name AS course
  FROM users u
  LEFT JOIN courses c ON c.id = u.course_id
  WHERE u.id = $1
  `,
  [req.user.id]
);

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Profile SQL error:", err.message);
    res.status(500).json({ error: "Profile failed" });
  }
});

module.exports = router;
