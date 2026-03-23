const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");

const multer = require("multer");
const path = require("path");


/* ================= GET PROFILE ================= */
router.get("/me", verifyToken, async (req, res) => {
console.log("🔥 PROFILE ROUTE HIT");
console.log("USER FROM TOKEN:", req.user);

  try {

    console.log("FULL USER OBJECT:", req.user);

const userId = req.user.id || req.user.user_id || req.user.userId;

console.log("USER ID USED:", userId);

    console.log("👉 USER ID FROM TOKEN:", userId);

    const result = await pool.query(
      "SELECT id, name, email, bio FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }

});

/* ================= UPDATE PROFILE ================= */
router.put("/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, bio, theme } = req.body;

    await pool.query(
      `UPDATE users
       SET name = $1,
           bio = $2,
           theme = $3
       WHERE id = $4`,
      [name, bio, theme, userId]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

/* ================= AVATAR UPLOAD ================= */

const storage = multer.diskStorage({
  destination: "uploads/avatars",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${req.user.id}${ext}`);
  }
});

const upload = multer({ storage });

router.post(
  "/avatar",
  verifyToken,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const filePath = `/uploads/avatars/${req.file.filename}`;

      await pool.query(
        "UPDATE users SET avatar=$1 WHERE id=$2",
        [filePath, req.user.id]
      );

      res.json({ avatar: filePath });

    } catch (err) {
      console.error("Avatar upload error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

/* ================= PUBLIC PROFILE ================= */

// 🔍 Check username availability
router.get("/check-username/:username", verifyToken, async (req, res) => {
  try {
    const username = String(req.params.username || "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");

    if (!username || username.length < 3) {
      return res.json({ available: false });
    }

    const existing = await pool.query(
      "SELECT 1 FROM public_profiles WHERE username = $1",
      [username]
    );

    res.json({ available: existing.rowCount === 0 });

  } catch (err) {
    console.error("Username check error", err);
    res.status(500).json({ available: false });
  }
});


// 📥 Get my public profile (private view)
router.get("/public/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      "SELECT * FROM public_profiles WHERE user_id = $1",
      [userId]
    );

    if (!result.rows.length) {
      return res.json(null);
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Load public profile error", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});


// 💾 Save my public profile
router.post("/public/save", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      username,
      headline,
      bio,
      avatar,
      is_public,
      social_links
    } = req.body;

    if (!username || username.length < 3) {
      return res.status(400).json({ error: "Invalid username" });
    }

    const cleanUsername = username
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");

    await pool.query(`
      INSERT INTO public_profiles
        (user_id, username, headline, bio, avatar, is_public, social_links, updated_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        username = EXCLUDED.username,
        headline = EXCLUDED.headline,
        bio = EXCLUDED.bio,
        avatar = EXCLUDED.avatar,
        is_public = EXCLUDED.is_public,
        social_links = EXCLUDED.social_links,
        updated_at = NOW()
    `, [
      userId,
      cleanUsername,
      headline || "",
      bio || "",
      avatar || "",
      Boolean(is_public),
      social_links || {}
    ]);

    res.json({ success: true });

  } catch (err) {
    console.error("Save public profile error", err);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

// 👁 Private preview (logged-in user only)
router.get("/public/preview/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT
        p.username,
        p.headline,
        p.bio,
        p.avatar,
        p.social_links,
        u.name
      FROM public_profiles p
      JOIN users u ON u.id = p.user_id
      WHERE p.user_id = $1
    `, [userId]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Preview profile error", err);
    res.status(500).json({ error: "Failed to load preview" });
  }
});

// 🌍 Public profile by username (public access)
router.get("/public/u/:username", async (req, res) => {
  try {

    const username = req.params.username;

    const result = await pool.query(`
      SELECT
  p.username,
  p.headline,
  p.bio,
  p.avatar,
  p.social_links,
  u.name,
  r.resume_data,
  r.template AS template


      FROM public_profiles p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN resumes r ON r.user_id = u.id
      WHERE p.username = $1
        AND p.is_public = true
      ORDER BY r.updated_at DESC
      LIMIT 1
    `, [username]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const row = result.rows[0];


    res.json({
  username: row.username,
  headline: row.headline,
  bio: row.bio,
  avatar: row.avatar,
  social_links: row.social_links || {},
  name: row.name,
  resume: row.resume_data || null,
  template: row.template || "modern"
});


  } catch (err) {
    console.error("Public profile load error", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

router.get("/resume/messages", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT type, message, email, created_at
      FROM resume_contacts
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,[userId]);

    res.json(result.rows);

  } catch (err) {
    console.error("Resume messages error:", err);
    res.status(500).json([]);
  }
});

router.get("/resume/messages/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const result = await pool.query(`
      SELECT *
      FROM resume_contacts
      WHERE username = $1
      ORDER BY created_at DESC
    `, [username]);

    res.json(result.rows);

  } catch (err) {
    console.error("Load resume messages error", err);
    res.status(500).json([]);
  }
});

/* ================= GET MY RESUME ================= */
router.get("/resume/me", verifyToken, async (req, res) => {
  try {
    console.log("📄 Fetching resume for user:", req.user.id);

    const result = await pool.query(
      "SELECT * FROM resumes WHERE user_id = $1 LIMIT 1",
      [req.user.id]
    );

    console.log("📦 Resume query result:", result.rows);

    if (!result.rows.length) {
      return res.json(null);
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("❌ Resume fetch DB error:", err.message);
    console.error(err); // FULL error
    res.status(500).json({ error: "Failed to fetch resume" });
  }
});

router.get("/:username", async (req, res) => {
  try {

    const username = req.params.username;

    const userRes = await pool.query(
      `SELECT id, username, role
       FROM users
       WHERE username = $1`,
      [username]
    );

    if (!userRes.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRes.rows[0];

    const postsRes = await pool.query(
      `SELECT *
       FROM posts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    );

    res.json({
      user,
      posts: postsRes.rows
    });

  } catch (err) {
    console.error("Profile load error:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

router.get("/instructor/:id", async (req, res) => {
  try {

    const instructorId = Number(req.params.id);

    const instructor = await pool.query(
      "SELECT id, name, bio FROM users WHERE id = $1",
      [instructorId]
    );

    const courses = await pool.query(
      "SELECT id, title, price FROM courses WHERE instructor_id = $1",
      [instructorId]
    );

    console.log("Instructor:", instructor.rows);
    console.log("Courses:", courses.rows);

    res.json({
      instructor: instructor.rows[0] || {},
      courses: courses.rows || []
    });

  } catch (err) {
    console.error("Instructor error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

router.put("/update", verifyToken, async (req, res) => {

  const { name, bio } = req.body;

  await pool.query(
    "UPDATE users SET name = $1, bio = $2 WHERE id = $3",
    [name, bio, req.user.user_id || req.user.id]
  );

  res.json({ success: true });

});

module.exports = router;
