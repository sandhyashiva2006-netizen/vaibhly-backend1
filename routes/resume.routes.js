const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* ================= TEMPLATE CSS ================= */
const TEMPLATE_CSS = {

  modern: `
    body { font-family: system-ui; padding:40px; }
    .resume-sheet { max-width:800px; margin:auto; }
    h1 { font-size:28px; }
  `,

  minimal: `
    body { font-family: Georgia, serif; padding:40px; }
    h1 { font-size:32px; letter-spacing:2px; }
    h3 { margin-top:20px; border-bottom:1px solid #ddd; }
  `,

  classic: `
    body { font-family: "Times New Roman"; padding:40px; }
    h1 { text-transform:uppercase; letter-spacing:3px; }
    h3 { margin-top:24px; border-bottom:2px solid black; }
  `,

  ats: `
    body { font-family: Arial; padding:40px; }
    h1 { font-size:26px; }
    h3 { margin-top:20px; }
  `,

  creative: `
    body { font-family: system-ui; padding:40px; background:#fff4f8; }
    .resume-sheet {
      background:white;
      padding:40px;
      border-radius:16px;
      box-shadow:0 8px 30px rgba(0,0,0,.08);
    }
    h1 { color:#e91e63; }
    h3 { color:#e91e63; }
  `,

  professional: `
    body { font-family: system-ui; padding:40px; }
    .resume-sheet { border-left:6px solid #2563eb; padding-left:20px; }
    h1 { color:#2563eb; }
  `,

  executive: `
    body { font-family: system-ui; padding:40px; background:#f8fafc; }
    .resume-sheet {
      background:white;
      padding:40px;
      border-radius:12px;
    }
    h1 { font-size:30px; color:#111827; }
    h3 { margin-top:24px; color:#374151; }
  `,

  corporate: `
    body { font-family: system-ui; padding:40px; }
    .resume-sheet {
      border-top:6px solid #1e3a8a;
      padding-top:20px;
    }
    h1 { color:#1e3a8a; }
  `,

  luxury: `
    body { font-family: serif; padding:40px; background:#fafafa; }
    h1 { color:#b8860b; }
    h3 { border-bottom:2px solid #b8860b; }
  `,

  dark: `
    body { background:#111827; color:white; padding:40px; }
    h1 { color:#22d3ee; }
    h3 { color:#9ca3af; }
  `,

  startup: `
    body { font-family: system-ui; padding:40px; }
    .resume-sheet {
      background:linear-gradient(to right,#eef2ff,#ffffff);
      padding:40px;
      border-radius:12px;
    }
    h1 { color:#4f46e5; }
  `,

  neon: `
    body { background:#0f172a; color:white; padding:40px; }
    h1 { color:#38bdf8; }
    h3 { color:#f472b6; }
  `,

  elegant: `
    body { font-family: "Playfair Display", serif; padding:40px; }
    h1 { font-size:34px; }
    h3 { border-bottom:1px solid #ccc; }
  `
};


/* ================= SAVE / UPDATE RESUME ================= */
router.post("/save", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { resume_data, template } = req.body;

function generateSlug(name, title) {
  return (
    (name || "resume") +
    "-" +
    (title || "profile")
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

    if (!resume_data) {
      return res.status(400).json({ error: "resume_data required" });
    }

const slug = generateSlug(resume_data.name, resume_data.title);

// 🔒 Check if theme is premium
const themeRes = await pool.query(
  "SELECT is_premium FROM resume_themes WHERE code = $1",
  [template]
);

if (themeRes.rows.length) {

  const isPremium = themeRes.rows[0].is_premium;

  if (isPremium) {

    const purchase = await pool.query(
      "SELECT 1 FROM theme_purchases WHERE user_id=$1 AND theme_code=$2",
      [userId, template]
    );

    if (!purchase.rows.length) {
      return res.status(403).json({
        error: "Please purchase this theme first"
      });
    }
  }
}

const userRes = await pool.query(
  "SELECT is_pro FROM users WHERE id = $1",
  [userId]
);

const isPro = userRes.rows[0]?.is_pro;

const lockedTemplates = ["creative", "professional"];

if (!isPro && lockedTemplates.includes(template)) {
  return res.status(403).json({
    error: "This template is available for Pro users only"
  });
}

    await pool.query(
      `
      INSERT INTO resumes (user_id, resume_data, template, slug, updated_at)
VALUES ($1, $2, $3, $4, NOW())
ON CONFLICT (user_id)
DO UPDATE SET
  resume_data = EXCLUDED.resume_data,
  template = EXCLUDED.template,
  slug = EXCLUDED.slug,
  updated_at = NOW()

      `,
      [userId, resume_data, template || "modern", slug]

    );

    res.json({ success: true });


  } catch (err) {
    console.error("Save resume error:", err);
    res.status(500).json({ error: "Failed to save resume" });
  }
});

router.get("/slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const r = await pool.query(
      `
      SELECT r.id,
             r.resume_data,
             r.template,
             u.username
      FROM resumes r
      JOIN users u ON u.id = r.user_id
      WHERE r.slug = $1
        AND r.is_public = true
      `,
      [slug]
    );

    if (!r.rows.length) {
      return res.status(404).json({ error: "Resume not found" });
    }

    res.json({
      id: r.rows[0].id,
      resume_data: r.rows[0].resume_data,
      template: r.rows[0].template,
      username: r.rows[0].username
    });

  } catch (err) {
    console.error("Slug resume error:", err);
    res.status(500).json({ error: "Failed to load resume" });
  }
});

/* ================= AUTO GENERATE RESUME ================= */
router.post("/auto-generate", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("🧠 Auto-generate resume for user:", userId);

    // ✅ build resume data HERE
    const resumeData = {
      name: "Sandhya",
      email: "sandhyashiva2006@gmail.com",
      phone: "9985792939",
      title: "Certified Professional",
      summary: "Completed professional training on EduNexa.",
      skills: "HTML, CSS, JavaScript",
      projects: "Capstone Project",
      education: "EduNexa Certified Program"
    };

    await pool.query(
      `
      INSERT INTO resumes (user_id, resume_data, template, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        resume_data = EXCLUDED.resume_data,
        template = EXCLUDED.template,
        updated_at = NOW()
      `,
      [userId, resumeData, "creative"]
    );

    res.json({ success: true, message: "Resume auto-generated" });

  } catch (err) {
    console.error("❌ AUTO-GENERATE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});



/* ================= PUBLIC RESUME ================= */
router.get("/public/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: "Invalid user" });
    }

    // 1️⃣ Fetch resume
    const r = await pool.query(
  `
  SELECT
    r.id,
    r.resume_data,
    r.template,
    u.username
  FROM resumes r
  JOIN users u ON u.id = r.user_id
  WHERE r.user_id = $1
  `,
  [userId]
);


    if (!r.rows.length) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const resumeRow = r.rows[0];

    // 2️⃣ TRACK VIEW (🔥 THIS WAS FAILING BEFORE)
    await pool.query(
      `INSERT INTO resume_activity (resume_id, type)
       VALUES ($1, 'view')`,
      [resumeRow.id]
    );

    // 3️⃣ Send resume
    res.json({
  id: resumeRow.id,
  resume_data: resumeRow.resume_data,
  template: resumeRow.template || "modern",
  username: resumeRow.username
});


  } catch (err) {
    console.error("Public resume fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch resume" });
  }
});


/* ================= DOWNLOAD PDF ================= */
router.get("/download/:resumeId", async (req, res) => {
  try {
    const resumeId = Number(req.params.resumeId);

    if (!resumeId) {
      return res.status(400).send("Invalid resume id");
    }

    // ✅ Fetch resume using resume ID (NOT user_id)
    const r = await pool.query(
      "SELECT resume_data, template FROM resumes WHERE id = $1",
      [resumeId]
    );

    if (!r.rows.length) {
      return res.status(404).send("Resume not found");
    }

    const resume = r.rows[0].resume_data || {};
    const template = r.rows[0].template || "modern";

    // ✅ Resume HTML
    const resumeHTML = `
      <div class="resume-sheet">
        <h1>${resume.name || ""}</h1>
        <h3>${resume.title || ""}</h3>
        <p>${resume.email || ""} ${resume.phone || ""}</p>
        <hr>

        <h3>Summary</h3>
        <p>${resume.summary || ""}</p>

        <h3>Skills</h3>
        <p>${resume.skills || ""}</p>

        <h3>Projects</h3>
        <p>${resume.projects || ""}</p>

        <h3>Education</h3>
        <p>${resume.education || ""}</p>
      </div>
    `;

// 🔥 Fetch certificates for this resume
const certRes = await pool.query(
  `
  SELECT cr.title AS course_name, c.issued_at
  FROM certificates c
  JOIN courses cr ON cr.id = c.course_id
  JOIN resumes r ON r.user_id = c.user_id
  WHERE r.id = $1
  ORDER BY c.issued_at DESC
  `,
  [resumeId]
);

const certificates = certRes.rows;

    // ✅ Template CSS
    const TEMPLATE_CSS = {
  modern: `
    body { font-family: system-ui; padding:40px; }
    .resume-sheet { max-width:800px; margin:auto; }
  `,

  creative: `
    body {
      font-family: system-ui;
      background:#faf7f9;
      padding:40px;
    }

    .resume-sheet {
      background:white;
      padding:40px;
      border-radius:16px;
      box-shadow:0 8px 30px rgba(0,0,0,.08);
    }

    h1 { color:#e91e63; }
    h3 { color:#e91e63; margin-top:24px; }
  `,   // 👈 THIS COMMA WAS MISSING

  minimal: `
    body { font-family: Georgia, serif; padding:40px; }
    h1 { font-size:32px; letter-spacing:2px; }
    h3 { margin-top:20px; border-bottom:1px solid #ddd; }
  `,

  professional: `
    body { font-family: system-ui; padding:40px; }
    .resume-sheet { border-left:6px solid #2563eb; padding-left:20px; }
    h1 { color:#2563eb; }
  `
};


    // ✅ Final HTML
    const html = `
      <html>
      <head>
        <style>
          ${TEMPLATE_CSS[template] || TEMPLATE_CSS.modern}
        </style>
      </head>
      <body>
        ${resumeHTML}
      </body>
      </html>
    `;

    // ✅ Puppeteer
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=EduNexa_Resume_${resumeId}.pdf`
    );

    res.send(pdf);

  } catch (err) {
    console.error("❌ PDF ERROR:", err);
    res.status(500).send("PDF generation failed");
  }
});


/* ================= TOGGLE RESUME VISIBILITY ================= */
router.post("/toggle-privacy", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { is_public } = req.body;

    await pool.query(
      `
      UPDATE resumes
      SET is_public = $1, updated_at = NOW()
      WHERE user_id = $2
      `,
      [is_public === true, userId]
    );

    res.json({ success: true, is_public });

  } catch (err) {
    console.error("❌ Privacy toggle failed:", err);
    res.status(500).json({ error: "Failed to update privacy" });
  }
});



/* ================= TRACK RESUME VIEW ================= */
router.post("/view", async (req, res) => {
  try {
    const { resume_id } = req.body;

    if (!resume_id) {
      return res.status(400).json({ error: "Missing resume_id" });
    }

    // 🔥 Get owner user_id from resumes table
    const r = await pool.query(
      "SELECT user_id FROM resumes WHERE id = $1",
      [resume_id]
    );

    if (!r.rows.length) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const userId = r.rows[0].user_id;

    // ✅ Insert tracking row
    await pool.query(
      `
      INSERT INTO resume_contacts
      (resume_id, user_id, type)
      VALUES ($1, $2, 'view')
      `,
      [resume_id, userId]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("View tracking failed:", err);
    res.status(500).json({ error: "View tracking failed" });
  }
});


/* ================= PUBLIC RESUME CONTACT TRACK ================= */
router.post("/public/resume/contact", async (req, res) => {
  try {
    const { resume_id, type, recruiter_email, message } = req.body;

    if (!resume_id || !type) {
      return res.status(400).json({ error: "resume_id and type required" });
    }

    await pool.query(
      `
      INSERT INTO resume_activity
        (resume_id, type, recruiter_email, message)
      VALUES
        ($1, $2, $3, $4)
      `,
      [
        resume_id,
        type,
        recruiter_email || null,
        message || null
      ]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Resume contact tracking failed:", err);
    res.status(500).json({ error: "Failed to track contact" });
  }
});

router.post("/contact", async (req, res) => {
  try {
    const { resume_id, type, recruiter_email, message } = req.body;

    if (!resume_id || !type) {
      return res.status(400).json({ error: "Missing data" });
    }

    const r = await pool.query(
      "SELECT user_id FROM resumes WHERE id = $1",
      [resume_id]
    );

    if (!r.rows.length) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const userId = r.rows[0].user_id;

    await pool.query(
  `
  INSERT INTO resume_contacts
  (resume_id, user_id, type, email, message)
  VALUES ($1, $2, $3, $4, $5)
  `,
  [
    resume_id,
    userId,
    type,
    recruiter_email || null,
    message || null
  ]
);

const { sendRecruiterNotification } = require("../utils/mailer");

const userEmailRes = await pool.query(
  "SELECT email FROM users WHERE id = $1",
  [userId]
);

const candidateEmail = userEmailRes.rows[0]?.email;

if (candidateEmail && message) {
  await sendRecruiterNotification(
    candidateEmail,
    recruiter_email,
    message
  );
}

    res.json({ success: true });

  } catch (err) {
    console.error("Contact save failed:", err);
    res.status(500).json({ error: "Failed to save contact" });
  }
});

router.get("/stats", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get resume id
    const resume = await pool.query(
      "SELECT id FROM resumes WHERE user_id = $1",
      [userId]
    );

    if (!resume.rows.length) {
      return res.json({ views: 0, contacts: 0 });
    }

    const resumeId = resume.rows[0].id;

    // Count views
    const views = await pool.query(
      "SELECT COUNT(*) FROM resume_contacts WHERE resume_id = $1 AND type = 'view'",
      [resumeId]
    );

    // Count contacts
    const contacts = await pool.query(
      `
      SELECT COUNT(*) 
      FROM resume_contacts 
      WHERE resume_id = $1 
      AND type IN ('email','whatsapp','message')
      `,
      [resumeId]
    );

    res.json({
      views: Number(views.rows[0].count),
      contacts: Number(contacts.rows[0].count)
    });

  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Stats failed" });
  }
});

/* ================= RECRUITER INBOX ================= */
router.get("/messages", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const resumeRes = await pool.query(
      "SELECT id FROM resumes WHERE user_id = $1",
      [userId]
    );

    if (!resumeRes.rows.length) {
      return res.json([]);
    }

    const resumeId = resumeRes.rows[0].id;

    const messagesRes = await pool.query(
      `
      SELECT
        type,
        message,
        email,
        created_at
      FROM resume_contacts
      WHERE resume_id = $1
        AND type != 'view'
      ORDER BY created_at DESC
      `,
      [resumeId]
    );

    res.json(messagesRes.rows);

  } catch (err) {
    console.error("Inbox error:", err);
    res.status(500).json([]);
  }
});

/* ================= GET MY RESUME ================= */
router.get("/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const r = await pool.query(
      `
      SELECT id, slug, is_public
      FROM resumes
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (!r.rows.length) {
      return res.json(null);
    }

    res.json(r.rows[0]);

  } catch (err) {
    console.error("Fetch my resume failed:", err);
    res.status(500).json({ error: "Failed to fetch resume" });
  }
});

/* ================= CHECK THEME ACCESS ================= */
router.get("/themes/check/:code", verifyToken, async (req, res) => {
  try {

    const { code } = req.params;
    const userId = req.user.id;

    const theme = await pool.query(
      "SELECT * FROM resume_themes WHERE code=$1",
      [code]
    );

    if (!theme.rows.length)
      return res.status(404).json({ error: "Theme not found" });

    if (!theme.rows[0].is_premium)
      return res.json({ allowed: true });

    const purchase = await pool.query(
      "SELECT * FROM theme_purchases WHERE user_id=$1 AND theme_code=$2",
      [userId, code]
    );

    const allowed = purchase.rows.length > 0;

    res.json({
      allowed,
      price: theme.rows[0].price
    });

  } catch (err) {
    console.error("Theme check failed:", err);
    res.status(500).json({ error: "Theme check failed" });
  }
});


/* ================= LIST THEMES ================= */
router.get("/themes", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT 
        t.code,
        t.name,
        t.is_premium,
        t.price,
        EXISTS (
          SELECT 1 FROM theme_purchases p
          WHERE p.user_id = $1 AND p.theme_code = t.code
        ) AS purchased
      FROM resume_themes t
      ORDER BY t.id
    `, [userId]);

    res.json(result.rows);

  } catch (err) {
    console.error("Themes fetch failed:", err);
    res.status(500).json([]);
  }
});


/* ================= CREATE THEME ORDER ================= */
router.post("/themes/create-order", verifyToken, async (req, res) => {
  try {
    const { theme_code } = req.body;
    const userId = req.user.id;

    const themeRes = await pool.query(
      "SELECT * FROM resume_themes WHERE code=$1",
      [theme_code]
    );

    if (!themeRes.rows.length)
      return res.status(404).json({ error: "Theme not found" });

    const theme = themeRes.rows[0];

    if (!theme.is_premium)
      return res.status(400).json({ error: "Theme is free" });

    const order = await razorpay.orders.create({
      amount: theme.price * 100, // ₹ to paise
      currency: "INR",
      receipt: `theme_${theme_code}_${userId}`,
    });

    res.json({
      orderId: order.id,
      amount: theme.price,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (err) {
    console.error("Order creation failed:", err);
    res.status(500).json({ error: "Order failed" });
  }
});

const crypto = require("crypto");

/* ================= VERIFY PAYMENT ================= */
router.post("/themes/verify", verifyToken, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      theme_code
    } = req.body;

    const userId = req.user.id;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature)
      return res.status(400).json({ error: "Payment verification failed" });

    // Save purchase
    await pool.query(
      `
      INSERT INTO theme_purchases (user_id, theme_code)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [userId, theme_code]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Payment verify failed:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});


module.exports = router;