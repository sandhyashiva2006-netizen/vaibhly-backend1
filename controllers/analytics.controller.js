const pool = require("../db");

/* ================= DASHBOARD SUMMARY ================= */

exports.getAnalyticsSummary = async (req, res) => {
  try {

    const users = await pool.query(
      "SELECT COUNT(*) FROM users"
    );

    const courses = await pool.query(
      "SELECT COUNT(*) FROM courses"
    );

    const enrollments = await pool.query(
      "SELECT COUNT(*) FROM user_courses"
    );

    const orders = await pool.query(`
      SELECT 
        COUNT(*) AS total_orders,
        COALESCE(SUM(total_amount), 0) AS total_revenue
      FROM orders
      WHERE status = 'PAID'
    `);

    const topCourses = await pool.query(`
      SELECT 
        c.title,
        COUNT(uc.id) AS enrollments
      FROM user_courses uc
      JOIN courses c ON c.id = uc.course_id
      GROUP BY c.title
      ORDER BY enrollments DESC
      LIMIT 5
    `);

    const orderTrend = await pool.query(`
      SELECT 
        DATE(created_at) AS date,
        COUNT(*) AS orders,
        SUM(total_amount) AS revenue
      FROM orders
      WHERE status = 'PAID'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    res.json({
      totals: {
        users: Number(users.rows[0].count),
        courses: Number(courses.rows[0].count),
        enrollments: Number(enrollments.rows[0].count),
        orders: Number(orders.rows[0].total_orders),
        revenue: Number(orders.rows[0].total_revenue)
      },
      topCourses: topCourses.rows,
      orderTrend: orderTrend.rows
    });

  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
};
