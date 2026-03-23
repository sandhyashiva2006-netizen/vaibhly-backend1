const express = require("express");
const router = express.Router();
const path = require("path");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

/* ======================================================
   ✅ ADMIN — LIST ALL INVOICES (SECURE)
   URL: /api/invoice/admin
====================================================== */
router.get("/admin", verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.id,
        o.invoice_no,
        o.invoice_file,
        o.total_amount,
        o.status,
        o.created_at,
        u.name AS student_name,
        u.email,
        c.title AS course_name
      FROM orders o
      JOIN users u ON u.id = o.user_id
      JOIN courses c ON c.id = o.course_id
      WHERE o.invoice_file IS NOT NULL
      ORDER BY o.created_at DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("Admin invoice list error:", err);
    res.status(500).json({ error: "Failed to load invoices" });
  }
});


/* ======================================================
   ✅ DOWNLOAD INVOICE PDF (SECURE)
   URL: /api/invoice/download/:filename
====================================================== */
router.get("/download/:filename", verifyToken, async (req, res) => {
  try {
    const { filename } = req.params;

    const invoicePath = path.join(
      __dirname,
      "..",
      "invoices",
      filename
    );

    return res.download(invoicePath);

  } catch (err) {
    console.error("Invoice download error:", err);
    res.status(500).json({ error: "Failed to download invoice" });
  }
});


/* ======================================================
   ⚠️ DO NOT PLACE DYNAMIC ROUTES ABOVE ADMIN
====================================================== */
// (If you ever add routes like "/:id", keep them LAST)

module.exports = router;
