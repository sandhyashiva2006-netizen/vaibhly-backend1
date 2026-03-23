const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");

console.log("✅ student routes loaded");

router.get("/profile", verifyToken, async (req, res) => {
console.log("📌 student/profile HIT, user =", req.user);  
try {
    const userId = req.user.userId || req.user.id;

    const result = await pool.query(
      `
      SELECT 
        u.name,
        c.title AS course
      FROM users u
      JOIN enrollments e ON e.user_id = u.id
      JOIN courses c ON c.id = e.course_id
      WHERE u.id = $1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
  return res.json({
    name: req.user.role,
    course: "Not enrolled yet"
  });
}


    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
