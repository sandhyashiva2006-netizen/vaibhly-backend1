const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");
const puppeteer = require("puppeteer");

/* ================= GET LATEST CERTIFICATE ================= */
router.get("/latest", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT 
        c.certificate_id,
        c.issued_at,
        co.title AS course_title,
        e.title AS exam_title,
        u.name AS student_name
      FROM certificates c
      LEFT JOIN courses co ON co.id = c.course_id
      LEFT JOIN exams e ON e.id = c.exam_id
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.user_id = $1
      ORDER BY c.issued_at DESC
      LIMIT 1
    `, [userId]);

    if (!result.rows.length) {
      return res.status(404).json({
        error: "No certificate found"
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("❌ latest certificate error:", err);
    res.status(500).json({ error: "Failed to load certificate" });
  }
});


/* ================= VERIFY CERTIFICATE ================= */
router.get("/verify/:id", async (req, res) => {
console.log("VERIFY CERTIFICATE:", req.params.id);
  try {

    const result = await pool.query(
`
SELECT
  c.certificate_id,
  c.type,
  c.issued_at,
  u.name AS student_name,

  /* ✅ ALWAYS GET COURSE NAME */
  COALESCE(cr.title, ce.title, 'Course') AS course_title,

  /* ✅ ALWAYS GET EXAM NAME */
  CASE
    WHEN c.type = 'course' THEN 'Final Course Exam'
    WHEN c.type = 'competitive' THEN ce.title
    WHEN c.type = 'exam' THEN e.title
    ELSE 'Assessment'
  END AS exam_title

FROM certificates c

JOIN users u
ON u.id = c.user_id

LEFT JOIN courses cr ON cr.id = c.course_id
LEFT JOIN competitive_exams ce ON ce.id = c.course_id
LEFT JOIN exams e ON e.id = c.course_id


WHERE c.certificate_id = $1
`,
[req.params.id]
);

    if (!result.rows.length) {
      return res.status(404).json({
        valid: false,
        message: "Certificate not found"
      });
    }

    res.json({
      valid: true,
      certificate: result.rows[0]
    });

  } catch (err) {

    console.error("Certificate verify error:", err);

    res.status(500).json({
      valid: false,
      message: "Server error"
    });

  }
});

/* ================= DOWNLOAD CERTIFICATE PDF ================= */
router.get("/download/:certificateId", async (req, res) => {
  const { certificateId } = req.params;

  try {

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    const url = `http://localhost:5000/certificate.html?id=${certificateId}`;

    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 60000
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true
    });

    await browser.close();

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=certificate-${certificateId}.pdf`
    );
    res.setHeader("Content-Type", "application/pdf");

    res.send(pdfBuffer);

  } catch (err) {
    console.error("❌ PDF GENERATION FAILED:", err);

    res.status(500).json({
      error: "Failed to generate certificate PDF",
      details: err.message
    });
  }
});


/* ================= CERTIFICATE STATUS ================= */
router.get("/status", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM certificates
      WHERE user_id = $1
      `,
      [userId]
    );

    const hasCertificate = Number(result.rows[0].count) > 0;

    res.json({ hasCertificate });

  } catch (err) {
    console.error("Certificate status error:", err);
    res.status(500).json({ error: "Failed to load certificate status" });
  }
});


/* ================= ALL MY CERTIFICATES ================= */
router.get("/my", verifyToken, async (req, res) => {
  try {

    const userId = req.user.id;

    const result = await pool.query(`
      SELECT DISTINCT ON (c.certificate_id)
        c.certificate_id,
        c.issued_at,

        /* course name */
        co.title AS course_name,

        /* exam name */
        e.title AS exam_name,

        /* optional score (latest attempt) */
        r.score,
        r.total_questions

      FROM certificates c

      /* course */
      LEFT JOIN courses co 
        ON co.id = c.course_id

      /* exam */
      LEFT JOIN exams e 
        ON e.id = c.exam_id

      /* latest result (optional, no duplicates) */
      LEFT JOIN LATERAL (
        SELECT r1.score, r1.total_questions
        FROM exam_results r1
        WHERE r1.user_id = c.user_id
        AND r1.exam_id = c.exam_id
        ORDER BY r1.attempted_at DESC
        LIMIT 1
      ) r ON true

      WHERE c.user_id = $1

      ORDER BY c.certificate_id, c.issued_at DESC
    `, [userId]);

    res.json({
      success: true,
      certificates: result.rows
    });

  } catch (err) {
    console.error("❌ Load certificates error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to load certificates"
    });
  }
});

module.exports = router;