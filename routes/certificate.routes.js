const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");
const puppeteer = require("puppeteer");

/* ================= GET LATEST CERTIFICATE ================= */
router.get("/latest", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
`
SELECT
  u.name AS student_name,
  c.certificate_id,
  c.issued_at,

  /* course title */
  co.title AS course_title,

  /* exam title */
  CASE
  WHEN c.type = 'course' THEN NULL
    WHEN c.type = 'competitive' THEN ce.title
    WHEN c.type = 'exam' THEN e.title
    ELSE NULL
  END AS exam_title,

  NULL AS score,
  NULL AS total_questions

FROM certificates c

JOIN users u ON u.id = c.user_id

LEFT JOIN courses co ON co.id = c.course_id
LEFT JOIN competitive_exams ce ON ce.id = c.course_id
LEFT JOIN exams e ON e.id = c.course_id

WHERE c.user_id = $1

ORDER BY c.issued_at DESC
LIMIT 1
`,
[userId]
);

    if (!result.rows.length) {
      return res.status(404).json({
        message: "No certificate found"
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("❌ certificate error:", err);
    res.status(500).json({ message: "Certificate error" });
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
  /* COURSE EXAM CERTIFICATES */
  SELECT
    c.certificate_id,
    c.issued_at,
    co.title AS course_name,
    'Final Course Exam' AS exam_name,
    NULL AS score,
    NULL AS total_questions
  FROM certificates c
  JOIN courses co ON co.id = c.course_id
  WHERE c.user_id = $1

  UNION ALL

  /* ADMIN EXAM CERTIFICATES */
  SELECT
    r.certificate_id,
    r.attempted_at AS issued_at,
    co.title AS course_name,
    e.title AS exam_name,
    r.score,
    r.total_questions
  FROM exam_results r
  JOIN exams e ON e.id = r.exam_id
  LEFT JOIN courses co ON co.id = e.course_id
  WHERE r.user_id = $1
  AND r.status = 'PASSED'

  ORDER BY issued_at DESC
`, [userId]);

    res.json({ certificates: result.rows });

  } catch (err) {
    console.error("❌ Load certificates error:", err);
    res.status(500).json({ error: "Failed to load certificates" });
  }
});


module.exports = router;