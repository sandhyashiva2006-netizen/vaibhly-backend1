const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();

console.log("AUTH ROUTES LOADED - REFERRAL VERSION");


/* ================= STUDENT REGISTER =================*/
router.post("/register", async (req, res) => {
console.log("REGISTER ROUTE HIT");

  try {
    const { name, email, password, referral } = req.body;

console.log("REGISTER BODY:", req.body);
console.log("REFERRAL VALUE:", referral);

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const username = await generateUsername(name);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, username)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [name, email, hashedPassword, "student", username]
    );

    const newUser = result.rows[0];

    await pool.query(
      `INSERT INTO user_wallets (user_id, coins)
       VALUES ($1, 0)`,
      [newUser.id]
    );

    const random = Math.floor(1000 + Math.random() * 9000);
    const referralCode =
      name.substring(0, 4).toUpperCase() + random + newUser.id;

    await pool.query(
      `UPDATE users
       SET referral_code = $1
       WHERE id = $2`,
      [referralCode, newUser.id]
    );

    if (referral && referral.trim() !== "") {
      const cleanCode = referral.trim().toUpperCase();

console.log("ENTERED REFERRAL BLOCK");
console.log("CLEAN CODE:", referral.trim().toUpperCase());

      const refUser = await pool.query(
        `SELECT id
         FROM users
         WHERE TRIM(UPPER(referral_code)) = $1
         LIMIT 1`,
        [cleanCode]
      );

console.log("MATCH RESULT:", refUser.rows);

      if (refUser.rows.length > 0) {
        const referrerId = refUser.rows[0].id;

        await pool.query(
          `UPDATE users
           SET referred_by = $1
           WHERE id = $2`,
          [referrerId, newUser.id]
        );

        await pool.query(
          `UPDATE user_wallets
           SET coins = coins + 50
           WHERE user_id = $1`,
          [referrerId]
        );

        await pool.query(
          `UPDATE user_wallets
           SET coins = coins + 25
           WHERE user_id = $1`,
          [newUser.id]
        );

        await pool.query(
          `INSERT INTO coin_transactions
           (user_id, type, amount, reference_id)
           VALUES
           ($1,'referral_bonus',50,$2),
           ($3,'welcome_referral',25,$4)`,
          [referrerId, newUser.id, newUser.id, referrerId]
        );
      }
    }

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

    const {
      name,
      email,
      username,
      password,
      company
    } = req.body;

    if (!name || !email || !username || !password || !company) {
      return res.status(400).json({
        error: "All fields are required"
      });
    }

    /* Email check */
    const existingEmail = await pool.query(
      `SELECT id FROM users WHERE email=$1`,
      [email]
    );

    if (existingEmail.rows.length) {
      return res.status(400).json({
        error: "Email already exists"
      });
    }

    /* Username check */
    const existingUser = await pool.query(
      `SELECT id FROM users WHERE username=$1`,
      [username]
    );

    if (existingUser.rows.length) {
      return res.status(400).json({
        error: "Username already taken"
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

const cleanUsername = username.toLowerCase().trim();

    const userResult = await pool.query(
      `
      INSERT INTO users
      (name,email,password,role,username)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id
      `,
      [
        name,
        email,
        hashedPassword,
        "recruiter",
        username
      ]
    );

    const userId = userResult.rows[0].id;

    await pool.query(
      `
      INSERT INTO recruiter_profiles
      (user_id, company_name, plan_id)
      VALUES ($1,$2,1)
      `,
      [userId, company]
    );

    res.status(201).json({
      success: true
    });

  } catch (err) {
    console.error(
      "Recruiter registration error:",
      err
    );

    res.status(500).json({
      error: err.message
    });
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

const nodemailer = require("nodemailer");

router.post("/forgot-password", async (req,res)=>{
 try{

   const { email } = req.body;

   if(!email){
     return res.status(400).json({
       error:"Email required"
     });
   }

   const user = await pool.query(
     `SELECT id,email FROM users WHERE email=$1`,
     [email]
   );

   if(!user.rows.length){
     return res.status(404).json({
       error:"Email not found"
     });
   }

   const otp =
     Math.floor(100000 + Math.random()*900000).toString();

   await pool.query(
     `
     UPDATE users
     SET reset_otp=$1,
         reset_otp_expiry=NOW() + INTERVAL '10 minutes'
     WHERE email=$2
     `,
     [otp,email]
   );

   const transporter = nodemailer.createTransport({
     service:"gmail",
     auth:{
       user:process.env.EMAIL_USER,
       pass:process.env.EMAIL_PASS
     }
   });

   await transporter.sendMail({
     from:process.env.EMAIL_USER,
     to:email,
     subject:"Vaibhly Password Reset OTP",
     text:`Your OTP is ${otp}`
   });

   res.json({
     success:true
   });

 }catch(err){
   console.error(err);
   res.status(500).json({
     error:err.message
   });
 }
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
router.get(
  "/google/callback",

  passport.authenticate("google", {
    session: false
  }),

  async (req, res) => {

    try{

      const jwt = require("jsonwebtoken");

      const token = jwt.sign(
        {
          id:req.user.id,
          role:req.user.role
        },
        process.env.JWT_SECRET,
        {
          expiresIn:"7d"
        }
      );

      res.redirect(
        `https://vaibhly-frontend.pages.dev/google-success.html?token=${token}&role=${req.user.role}`
      );

    }catch(err){

      console.log(err);

      res.redirect(
        "https://vaibhly-frontend.pages.dev/login.html"
      );

    }

  }
);

module.exports = router;
