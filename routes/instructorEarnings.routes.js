const express = require("express");
const router = express.Router();
const db = require("../db");

const { verifyToken } =
require("../middleware/auth.middleware");

// ======================================
// GET INSTRUCTOR EARNINGS SUMMARY
// ======================================

router.get("/summary", verifyToken, async (req, res) => {

  try {

    const instructorId = req.user.id; // ✅ secure

    // ✅ TOTAL EARNINGS
    const total = await db.query(
      `SELECT COALESCE(SUM(instructor_amount),0) AS total_earnings
       FROM instructor_earnings
       WHERE instructor_id=$1`,
      [instructorId]
    );

    // ✅ TOTAL WITHDRAWN
    const withdrawn = await db.query(
      `SELECT COALESCE(SUM(amount),0) AS total_withdrawn
       FROM withdraw_requests
       WHERE instructor_id=$1
       AND status='paid'`,
      [instructorId]
    );

    const totalEarnings = Number(total.rows[0].total_earnings);
    const withdrawnAmount = Number(withdrawn.rows[0].total_withdrawn);
    const available = totalEarnings - withdrawnAmount;

    // ✅ COURSE-WISE ANALYTICS (NEW 🔥)
    const courseStats = await db.query(`
      SELECT 
        c.id,
        c.title,
        COUNT(ie.id) AS students,
        COALESCE(SUM(ie.instructor_amount),0) AS revenue
      FROM courses c
      LEFT JOIN instructor_earnings ie 
        ON ie.course_id = c.id
      WHERE c.instructor_id = $1
      GROUP BY c.id, c.title
      ORDER BY revenue DESC
    `, [instructorId]);

    // ✅ FINAL RESPONSE
    res.json({
      total_earnings: totalEarnings,
      withdrawn: withdrawnAmount,
      available_balance: available,
      courses: courseStats.rows   // 🔥 NEW
    });

  } catch (err) {

    console.error("Earnings error:", err);
    res.status(500).json({ error: "Failed to fetch earnings" });

  }

});

module.exports = router;