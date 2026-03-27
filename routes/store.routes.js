const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");

/* ===========================
   GET ALL COURSES (STORE)
=========================== */
router.get("/courses", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, title, description, price, thumbnail
      FROM courses
WHERE published = true
      ORDER BY id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Store courses error:", err);
    res.status(500).json({ error: "Failed to load store courses" });
  }
});

/* ===========================
   GET SINGLE COURSE
=========================== */
router.get("/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM courses WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Single course error:", err);
    res.status(500).json({ error: "Failed to load course" });
  }
});

/* ===========================
   BUY COURSE (FAKE PAYMENT)
=========================== */
router.post("/buy/:courseId", verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { courseId } = req.params;
console.log("🛒 BUY REQUEST:", { userId, courseId });

    await client.query("BEGIN");

    // Get course
const courseRes = await client.query(
  "SELECT id, price FROM courses WHERE id = $1",
  [courseId]
);
console.log("📦 Fetching course...");


if (courseRes.rows.length === 0) {
  throw new Error("Course not found");
}


const price = courseRes.rows[0].price || 0;


    // Create order
    const orderRes = await client.query(
      `INSERT INTO orders(user_id, total_amount)
       VALUES($1, $2)
       RETURNING id`,
      [userId, price]
    );

    const orderId = orderRes.rows[0].id;

    // Create order item
    await client.query(
      `INSERT INTO order_items(order_id, course_id, price)
       VALUES($1, $2, $3)`,
      [orderId, courseId, price]
    );

    // Auto enroll user (skip if already exists)
await client.query(
  `INSERT INTO user_courses(user_id, course_id)
   VALUES($1, $2)
   ON CONFLICT DO NOTHING`,
  [userId, courseId]
);



    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Course purchased & enrolled successfully",
      orderId
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Purchase error full:", err.message, err.stack);
    res.status(500).json({ error: "Purchase failed" });
  } finally {
    client.release();
  }
});

/* ===========================
   GET MY ORDERS
=========================== */
router.get("/my-orders", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
console.log("TOKEN USER ID:", userId);
    const result = await pool.query(`
  SELECT 
    o.id,
    o.total_amount,
    o.status,
    o.created_at,
    c.title AS course_name
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN courses c ON c.id = oi.course_id
  WHERE o.user_id = $1
  ORDER BY o.created_at DESC
`, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error("Orders fetch error:", err);
    res.status(500).json({ error: "Failed to load orders" });
  }
});

/* ===========================
   CONFIRM PURCHASE (SECURE)
=========================== */
router.post("/confirm-purchase", verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { courseId, paymentId } = req.body;

    if (!courseId || !paymentId) {
      return res.status(400).json({ error: "Missing payment data" });
    }

    await client.query("BEGIN");

    // Get course price
    const courseRes = await client.query(
      "SELECT id, price FROM courses WHERE id = $1",
      [courseId]
    );

    if (courseRes.rows.length === 0) {
      throw new Error("Course not found");
    }

    const price = courseRes.rows[0].price || 0;

    // Save order
    const orderRes = await client.query(
      `INSERT INTO orders(user_id, total_amount, status)
       VALUES($1, $2, 'paid')
       RETURNING id`,
      [userId, price]
    );

    const orderId = orderRes.rows[0].id;

    // Save order item
    await client.query(
      `INSERT INTO order_items(order_id, course_id, price)
       VALUES($1, $2, $3)`,
      [orderId, courseId, price]
    );

    // Enroll user
    await client.query(
      `INSERT INTO user_courses(user_id, course_id)
       VALUES($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, courseId]
    );

 // Enroll user
    await client.query(
      `INSERT INTO user_courses(user_id, courseId)
       VALUES($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, courseId]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      orderId,
      paymentId
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Confirm purchase error:", err);
    res.status(500).json({ error: "Purchase confirmation failed" });
  } finally {
    client.release();
  }
});

/* ===========================
   ADMIN SALES DASHBOARD
=========================== */
router.get("/admin/sales", verifyToken, async (req, res) => {
  try {
    // Optional: protect admin only
        const totalRevenueRes = await pool.query(`
      SELECT COALESCE(SUM(total_amount),0) AS revenue FROM orders
    `);

    const totalOrdersRes = await pool.query(`
      SELECT COUNT(*) AS total_orders FROM orders
    `);

    const topCoursesRes = await pool.query(`
      SELECT 
        c.title,
        COUNT(oi.id) AS sales
      FROM order_items oi
      JOIN courses c ON c.id = oi.course_id
      GROUP BY c.title
      ORDER BY sales DESC
      LIMIT 5
    `);

    const dailySalesRes = await pool.query(`
      SELECT 
        DATE(created_at) AS date,
        SUM(total_amount) AS revenue
      FROM orders
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 7
    `);

    res.json({
      revenue: totalRevenueRes.rows[0].revenue,
      totalOrders: totalOrdersRes.rows[0].total_orders,
      topCourses: topCoursesRes.rows,
      dailySales: dailySalesRes.rows
    });

  } catch (err) {
    console.error("Admin sales error:", err);
    res.status(500).json({ error: "Failed to load sales data" });
  }
});

/* ================= STORE DATA ================= */

router.get("/all", async (req, res) => {

  try {

    const courses = await pool.query(
      "SELECT id, title, description, price, instructor_id FROM courses WHERE is_published = true"
    );

    const exams = await pool.query(
      "SELECT id, title, price FROM competitive_exams WHERE active = true"
    );

    res.json({
      courses: courses.rows,
      exams: exams.rows
    });

  } catch (err) {

    console.error("Store load error:", err);
    res.status(500).json({ error: "Failed to load store" });

  }

});

module.exports = router;
