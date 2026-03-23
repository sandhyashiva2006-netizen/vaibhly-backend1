const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

/* ======================================================
   GET ALL ENROLLMENTS (ADMIN)
====================================================== */
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      active = "",
      export: exportMode
    } = req.query;

    const offset = (page - 1) * limit;

    const filters = [];
    const values = [];
    let idx = 1;

    if (active !== "") {
      filters.push(`uc.is_active = $${idx++}`);
      values.push(active === "true");
    }

    if (search) {
      filters.push(`
        (
          LOWER(u.name) LIKE LOWER($${idx})
          OR LOWER(u.email) LIKE LOWER($${idx})
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
      FROM user_courses uc
      JOIN users u ON u.id = uc.user_id
      JOIN courses c ON c.id = uc.course_id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT 
        uc.id,
        u.name AS student_name,
        u.email,
        c.title AS course_name,
        uc.payment_id,
        uc.is_active,
        uc.purchased_at
      ${baseQuery}
      ORDER BY uc.purchased_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      ${baseQuery}
    `;

    const dataValues = [...values, limit, offset];
    const countValues = [...values];

    const [rowsRes, countRes] = await Promise.all([
      pool.query(dataQuery, dataValues),
      pool.query(countQuery, countValues)
    ]);

    // ✅ CSV Export
    if (exportMode === "csv") {
      let csv = "Student,Email,Course,PaymentID,Status,Date\n";

      rowsRes.rows.forEach(r => {
        csv += `"${r.student_name}","${r.email}","${r.course_name}","${r.payment_id || ""}","${r.is_active ? "Active" : "Revoked"}","${r.purchased_at}"\n`;
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=enrollments.csv");
      return res.send(csv);
    }

    res.json({
      enrollments: rowsRes.rows,
      total: Number(countRes.rows[0].total),
      page: Number(page),
      limit: Number(limit)
    });

  } catch (err) {
    console.error("Enrollments pagination error:", err);
    res.status(500).json({ error: "Failed to load enrollments" });
  }
});


/* ======================================================
   REVOKE ENROLLMENT
====================================================== */
router.post("/revoke", verifyToken, isAdmin, async (req, res) => {
  try {
    const { enrollment_id, reason } = req.body;

    if (!enrollment_id) {
      return res.status(400).json({ error: "enrollment_id required" });
    }

    // Disable enrollment
    await pool.query(
      `UPDATE user_courses SET is_active = false WHERE id = $1`,
      [enrollment_id]
    );

    // Audit log
    await pool.query(
      `
      INSERT INTO enrollment_audit
      (admin_id, user_id, course_id, action, reason)
      SELECT 
        $1, user_id, course_id, 'REVOKE', $2
      FROM user_courses WHERE id = $3
      `,
      [req.user.id, reason || "Admin revoked", enrollment_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Revoke enrollment error:", err);
    res.status(500).json({ error: "Failed to revoke enrollment" });
  }
});

/* ======================================================
   GRANT ENROLLMENT
====================================================== */
router.post("/grant", verifyToken, isAdmin, async (req, res) => {
  try {
    const { enrollment_id, reason } = req.body;

    if (!enrollment_id) {
      return res.status(400).json({ error: "enrollment_id required" });
    }

    // Enable enrollment
    await pool.query(
      `UPDATE user_courses SET is_active = true WHERE id = $1`,
      [enrollment_id]
    );

    // Audit log
    await pool.query(
      `
      INSERT INTO enrollment_audit
      (admin_id, user_id, course_id, action, reason)
      SELECT 
        $1, user_id, course_id, 'GRANT', $2
      FROM user_courses WHERE id = $3
      `,
      [req.user.id, reason || "Admin granted", enrollment_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Grant enrollment error:", err);
    res.status(500).json({ error: "Failed to grant enrollment" });
  }
});

module.exports = router;
