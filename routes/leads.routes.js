const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

/* ================= CREATE LEAD (PUBLIC) ================= */
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, course_interest, source } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone required" });
    }

    const result = await pool.query(
      `
      INSERT INTO leads 
      (name, email, phone, course_interest, source)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [name, email, phone, course_interest, source || "Website"]
    );

    const lead = result.rows[0];

// ⏰ Schedule follow-up after 2 hours
await pool.query(`
  INSERT INTO lead_followups (lead_id, followup_at)
  VALUES ($1, NOW() + INTERVAL '2 hours')
`, [lead.id]);

res.json({
  success: true,
  lead
});


  } catch (err) {
    console.error("Create lead error:", err);
    res.status(500).json({ error: "Failed to save lead" });
  }
});

/* ================= ADMIN: GET ALL LEADS ================= */
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM leads
      ORDER BY created_at DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("Load leads error:", err);
    res.status(500).json({ error: "Failed to load leads" });
  }
});

/* ================= ADMIN: UPDATE LEAD STATUS ================= */
router.put("/:id/status", verifyToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    await pool.query(
      "UPDATE leads SET status = $1 WHERE id = $2",
      [status, id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Update lead error:", err);
    res.status(500).json({ error: "Failed to update lead" });
  }
});

/* ================= LEAD ANALYTICS SUMMARY ================= */
router.get("/analytics/summary", verifyToken, isAdmin, async (req, res) => {
  try {
    const total = await pool.query(`SELECT COUNT(*) FROM leads`);
    const newCount = await pool.query(`SELECT COUNT(*) FROM leads WHERE status='NEW'`);
    const contacted = await pool.query(`SELECT COUNT(*) FROM leads WHERE status='CONTACTED'`);
    const closed = await pool.query(`SELECT COUNT(*) FROM leads WHERE status='CLOSED'`);

    res.json({
      total: Number(total.rows[0].count),
      new: Number(newCount.rows[0].count),
      contacted: Number(contacted.rows[0].count),
      closed: Number(closed.rows[0].count)
    });

  } catch (err) {
    console.error("Lead analytics error:", err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

/* ================= EXPORT CSV ================= */
router.get("/export", verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, name, phone, email, course_interest, status, created_at
      FROM leads
      ORDER BY created_at DESC
    `);

    let csv = "ID,Name,Phone,Email,Course,Status,Created At\n";

    result.rows.forEach(r => {
      csv += `${r.id},"${r.name}","${r.phone}","${r.email || ""}","${r.course_interest || ""}",${r.status},${r.created_at}\n`;
    });

    res.header("Content-Type", "text/csv");
    res.attachment("leads.csv");
    res.send(csv);

  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

module.exports = router;
