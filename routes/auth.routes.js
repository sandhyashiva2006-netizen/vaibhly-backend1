const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();




/* ================= STUDENT REGISTER =================*/
router.post("/register", async (req, res) => {
  try {
    console.log("🔥 REGISTER API HIT");

    const { name, email, password, referral } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    // 🔍 Check existing user
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email=$1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 👤 Generate username
    const username = await generateUsername(name);

    // 🧾 Insert user
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, username)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, email, hashedPassword, "student", username]
    );

    const newUser = result.rows[0];

    // 💰 Wallet
    await pool.query(
      "INSERT INTO user_wallets (user_id, coins) VALUES ($1, 0)",
      [newUser.id]
    );

    // 🎁 Referral code
    const random = Math.floor(1000 + Math.random() * 9000);
    const referralCode =
      name.substring(0, 4).toUpperCase() + random + newUser.id;

    await pool.query(
      "UPDATE users SET referral_code = $1 WHERE id = $2",
      [referralCode, newUser.id]
    );

    // 🔗 Referral link
    if (referral) {
      const refUser = await pool.query(
        "SELECT id FROM users WHERE UPPER(referral_code)=UPPER($1)",
        [referral]
      );

      if (refUser.rows.length) {
        await pool.query(
          "UPDATE users SET referred_by=$1 WHERE id=$2",
          [refUser.rows[0].id, newUser.id]
        );
      }
    }

    // ✅ FINAL RESPONSE (ONLY ONCE)
    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        referral_code: referralCode
      }
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

async function generateUsername(name) {

  let base = name.toLowerCase().replace(/\s+/g, "");
  let username = base;
  let counter = 1;

  while (true) {

    const exists = await pool.query(
      "SELECT 1 FROM users WHERE username = $1",
      [username]
    );

    if (!exists.rows.length) return username;

    username = base + counter;
    counter++;
  }
}


 /* ================= LOGIN (ADMIN + STUDENT) =================*/
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
  {
    id: user.id,   // ✅ MUST MATCH DB users.id
    role: user.role
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// ================= ADMIN LOGIN (OPTIONAL SEPARATE) =================
router.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1 AND role='admin'",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid admin credentials" });
    }

    const admin = result.rows[0];

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid admin credentials" });
    }

    const token = jwt.sign(
      { id: admin.id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Admin login failed" });
  }
});

router.post("/recruiter/register", async (req, res) => {
  try {
    const { name, email, password, company } = req.body;

    if (!name || !email || !password || !company) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check existing user
    const existing = await pool.query(
      "SELECT id FROM users WHERE email=$1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate username from email
    const username = email.split("@")[0];

    // Insert into users
    const userResult = await pool.query(
      `INSERT INTO users (name, email, password, role, username)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [name, email, hashedPassword, "recruiter", username]
    );

    const userId = userResult.rows[0].id;

    // Insert recruiter profile
    await pool.query(
      `INSERT INTO recruiter_profiles (user_id, company_name)
       VALUES ($1,$2)`,
      [userId, company]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Recruiter registration error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/recruiter/login", async (req, res) => {
  try {

    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];

    if (user.role !== "recruiter") {
      return res.status(403).json({ error: "Not a recruiter account" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    });

  } catch (err) {
    console.error("Recruiter login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

const sendEmail = require("../utils/sendEmail");

router.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await pool.query(
    "INSERT INTO otp_codes (email, otp, expires_at) VALUES ($1,$2,NOW() + INTERVAL '5 minutes')",
    [email, otp]
  );

  await sendEmail(
    email,
    "EduNexa OTP Verification",
    `Your OTP is: ${otp}`
  );

  res.json({ success: true });
});

router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  const result = await pool.query(
    "SELECT * FROM otp_codes WHERE email=$1 AND otp=$2 AND expires_at > NOW()",
    [email, otp]
  );

  if (!result.rows.length) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  res.json({ success: true });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  const user = await pool.query("SELECT id FROM users WHERE email=$1", [email]);

  if (!user.rows.length) {
    return res.status(400).json({ error: "Email not found" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await pool.query(
    "INSERT INTO otp_codes (email, otp, expires_at) VALUES ($1,$2,NOW() + INTERVAL '5 minutes')",
    [email, otp]
  );

  await sendEmail(
    email,
    "Reset Your Password",
    `Your password reset OTP is: ${otp}`
  );

  res.json({ success: true });
});

router.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const result = await pool.query(
    "SELECT * FROM otp_codes WHERE email=$1 AND otp=$2 AND expires_at > NOW()",
    [email, otp]
  );

  if (!result.rows.length) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  await pool.query(
    "UPDATE users SET password=$1 WHERE email=$2",
    [hashed, email]
  );

  res.json({ success: true });
});

const passport = require("passport");

// GOOGLE LOGIN START
router.get("/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// GOOGLE CALLBACK
router.get("/google/callback",
  passport.authenticate("google", { session: false }),
  async (req, res) => {

    const jwt = require("jsonwebtoken");

    const token = jwt.sign(
      { id: req.user.id, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.redirect(`http://localhost:5500/google-success.html?token=${token}`);
  }
);

module.exports = router;
