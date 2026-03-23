const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");


/* ================= SALES SUMMARY ================= */
router.get("/summary", verifyToken, isAdmin, async (req, res) => {
  try {

    /* ✅ Orders */
    const ordersRes = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_orders,
        COALESCE(SUM(total_amount),0)::numeric AS total_revenue
      FROM orders
      WHERE UPPER(status) = 'PAID'
        AND payment_id IS NOT NULL
    `);

    /* ✅ Enrollments */
    const enrollRes = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_enrollments
      FROM user_courses
      WHERE is_active = true
    `);

    /* ✅ Today Orders */
    const todayRes = await pool.query(`
      SELECT 
        COUNT(*)::int AS today_orders,
        COALESCE(SUM(total_amount),0)::numeric AS today_revenue
      FROM orders
      WHERE 
        UPPER(status) = 'PAID'
        AND payment_id IS NOT NULL
        AND created_at::date = CURRENT_DATE
    `);

    res.json({
      totalOrders: ordersRes.rows[0].total_orders,
      totalRevenue: Number(ordersRes.rows[0].total_revenue),
      todayOrders: todayRes.rows[0].today_orders,
      todayRevenue: Number(todayRes.rows[0].today_revenue),
      totalEnrollments: enrollRes.rows[0].total_enrollments
    });

  } catch (err) {
    console.error("Sales summary error:", err);
    res.status(500).json({ error: "Failed to load summary" });
  }
});

/* ================= ORDERS LIST ================= */
router.get("/orders", verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      from,
      to
    } = req.query;

    const offset = (page - 1) * limit;

    const filters = [];
    const values = [];
    let idx = 1;

    if (status) {
      filters.push(`UPPER(o.status) = UPPER($${idx++})`);
      values.push(status);
    }

    if (from) {
      filters.push(`o.created_at::date >= $${idx++}`);
      values.push(from);
    }

    if (to) {
      filters.push(`o.created_at::date <= $${idx++}`);
      values.push(to);
    }

    if (search) {
      filters.push(`
        (
          LOWER(u.name) LIKE LOWER($${idx})
          OR LOWER(c.title) LIKE LOWER($${idx})
        )
      `);
      values.push(`%${search}%`);
      idx++;
    }

    const whereClause = filters.length
      ? "WHERE " + filters.join(" AND ")
      : "";

    const baseQuery = `
      FROM orders o
      JOIN users u ON u.id = o.user_id
      LEFT JOIN user_courses uc 
        ON (
          uc.payment_id = o.payment_id
          OR
          (uc.user_id = o.user_id AND uc.course_id = o.course_id)
        )
      LEFT JOIN courses c ON c.id = uc.course_id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT 
        o.id,
        o.total_amount,
        o.status,
        o.created_at,
        o.invoice_file,
        u.name AS student_name,
        STRING_AGG(DISTINCT c.title, ', ') AS course_name
      ${baseQuery}
      GROUP BY o.id, u.name
      ORDER BY o.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT o.id) AS total
      ${baseQuery}
    `;

    const dataValues = [...values, limit, offset];
    const countValues = [...values];

    const [rowsRes, countRes] = await Promise.all([
      pool.query(dataQuery, dataValues),
      pool.query(countQuery, countValues)
    ]);

    // ✅ CSV Export Mode
if (req.query.export === "csv") {
  const rows = rowsRes.rows;

  let csv = "OrderID,Student,Course,Amount,Status,Date\n";

  rows.forEach(r => {
    csv += `"${r.id}","${r.student_name}","${r.course_name || ""}","${r.total_amount}","${r.status}","${r.created_at}"\n`;
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
  return res.send(csv);
}

// ✅ Normal JSON Mode
res.json({
  orders: rowsRes.rows,
  total: Number(countRes.rows[0].total),
  page: Number(page),
  limit: Number(limit)
});


  } catch (err) {
    console.error("Orders pagination error:", err);
    res.status(500).json({ error: "Failed to load orders" });
  }
});

/* ================= TOP COURSES ================= */
router.get("/top-courses", verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.title,
        COUNT(uc.id)::int AS enrollments
      FROM user_courses uc
      JOIN courses c ON c.id = uc.course_id
      WHERE uc.is_active = true
      GROUP BY c.title
      ORDER BY enrollments DESC
      LIMIT 5
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("Top courses error:", err);
    res.status(500).json({ error: "Failed to load top courses" });
  }
});

/* ================= DASHBOARD ANALYTICS ================= */
router.get("/dashboard", verifyToken, isAdmin, async (req, res) => {
  try {

    /* ✅ KPI TOTALS */
    const totalsRes = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM orders WHERE status='PAID' AND payment_id IS NOT NULL) AS total_orders,
        (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status='PAID' AND payment_id IS NOT NULL) AS total_revenue,
        (SELECT COUNT(*) FROM user_courses WHERE is_active = true) AS total_enrollments
    `);

    /* ✅ Revenue Trend */
    const revenueRes = await pool.query(`
      SELECT 
        DATE(created_at) AS date,
        SUM(total_amount)::numeric AS revenue
      FROM orders
      WHERE status = 'PAID'
        AND payment_id IS NOT NULL
      GROUP BY DATE(created_at)
      ORDER BY date ASC
      LIMIT 30
    `);

    /* ✅ Orders Trend */
    const ordersRes = await pool.query(`
      SELECT 
        DATE(created_at) AS date,
        COUNT(*)::int AS orders
      FROM orders
      WHERE status = 'PAID'
        AND payment_id IS NOT NULL
      GROUP BY DATE(created_at)
      ORDER BY date ASC
      LIMIT 30
    `);

    /* ✅ Top Courses */
    const topCoursesRes = await pool.query(`
      SELECT 
        c.title,
        COUNT(uc.id)::int AS enrollments
      FROM user_courses uc
      JOIN courses c ON c.id = uc.course_id
      WHERE uc.is_active = true
      GROUP BY c.title
      ORDER BY enrollments DESC
      LIMIT 5
    `);

    const totals = totalsRes.rows[0];

    res.json({
      totals: {
        totalOrders: Number(totals.total_orders),
        totalRevenue: Number(totals.total_revenue),
        totalEnrollments: Number(totals.total_enrollments)
      },
      revenueTrend: revenueRes.rows,
      orderTrend: ordersRes.rows,
      topCourses: topCoursesRes.rows
    });

  } catch (err) {
    console.error("Dashboard analytics error:", err);
    res.status(500).json({ error: "Failed to load dashboard analytics" });
  }
});


module.exports = router;
