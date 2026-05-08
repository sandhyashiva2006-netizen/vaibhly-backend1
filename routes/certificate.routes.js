const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");
const puppeteer = require("puppeteer");
const chromium = require("@sparticuz/chromium");

/* ================= GET LATEST CERTIFICATE ================= */
router.get("/latest", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
SELECT 
  c.certificate_id,
  c.issued_at,

  -- ✅ FIX: correct field names
  CASE 
    WHEN c.exam_id IS NOT NULL THEN NULL
    ELSE co.title
  END AS course_title,

  CASE 
    WHEN c.exam_id IS NOT NULL THEN e.title
    ELSE NULL
  END AS exam_title

FROM certificates c

LEFT JOIN courses co ON co.id = c.course_id
LEFT JOIN exams e ON e.id = c.exam_id

WHERE c.user_id = $1
AND c.certificate_id IS NOT NULL

 ORDER BY c.issued_at DESC
      `,
      [userId]
    );

    if (!result.rows.length) {
      return res.json(null); // ✅ IMPORTANT (no error)
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("❌ latest certificate error:", err);
    res.status(500).json({ error: "Failed to load certificate" });
  }
});

/* ================= VERIFY CERTIFICATE ================= */
router.get("/verify/:id", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        c.certificate_id,
        c.type,
        c.issued_on,
        c.issued_at,
        c.certificate_title,
        c.course_name,

        u.name AS student_name

      FROM certificates c

      JOIN users u
        ON u.id = c.user_id

      WHERE c.certificate_id = $1
      LIMIT 1
    `, [req.params.id]);

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

    console.error("Verify error:", err);

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

  args: chromium.args,

  defaultViewport: chromium.defaultViewport,

  executablePath:
    await chromium.executablePath(),

  headless: chromium.headless

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

router.get("/", verifyToken, async (req, res) => {

  try {

    const userId = req.user.id;

    const result = await pool.query(`

      SELECT
        c.certificate_id,
        c.issued_at,
        c.type,

        /* COURSE NAME */
        co.title AS course_name,

        /* EXAM NAME */
       COALESCE(
  c.certificate_title,
  ce.title,
  e.title,
  co.title
) AS exam_name

      FROM certificates c

      /* courses */
      LEFT JOIN courses co
        ON co.id = c.course_id

      /* competitive exams */
      LEFT JOIN competitive_exams ce
        ON ce.id = c.exam_id

      /* regular exams */
      LEFT JOIN exams e
        ON e.id = c.exam_id

      WHERE c.user_id = $1

      ORDER BY c.issued_at DESC

    `, [userId]);

console.log(
  "CERTIFICATES DB:",
  result.rows
);

    res.json(result.rows);

  } catch(err) {

    console.error(
      "Certificate fetch failed:",
      err
    );

    res.status(500).json({
      error:"Failed"
    });

  }

});

module.exports = router;