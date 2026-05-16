const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../uploads/posts");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/quicktime"
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only image/video files allowed"));
    }

    cb(null, true);
  }
});

/* ================= PUBLIC COURSES ================= */
router.get("/courses", async (req, res) => {
  try {
    const result = await pool.query(`
  SELECT 
    id,
    title,
    description,
    price,
    thumbnail
  FROM courses
  ORDER BY id DESC
`);


    res.json(result.rows);
  } catch (err) {
    console.error("Public courses error:", err);
    res.status(500).json({ error: "Failed to load public courses" });
  }
});

/* ================= PUBLIC COURSE DETAILS ================= */
router.get("/course/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const courseRes = await pool.query(`
      SELECT 
        id,
        title,
        description,
        price,
        thumbnail
      FROM courses
      WHERE id = $1
    `, [id]);

    if (!courseRes.rows.length) {
      return res.status(404).json({ error: "Course not found" });
    }

    const course = courseRes.rows[0];

    // Optional: load module count
    const moduleRes = await pool.query(`
      SELECT COUNT(*) AS modules
      FROM course_modules
      WHERE course_id = $1
    `, [id]);

    course.modules = Number(moduleRes.rows[0].modules || 0);

    res.json(course);

  } catch (err) {
    console.error("Public course detail error:", err);
    res.status(500).json({ error: "Failed to load course" });
  }
});

/* ================= PROFILE ACTIVITY ================= */
router.get('/profile-activity', verifyToken, async (req, res) => {

  try {

    const userId =
      req.query.userId ||
      req.user.id ||
      req.user.user_id ||
      req.user.userId;

    if (!userId) {
      return res.status(401).json({
        error: "User not found"
      });
    }

    /* ===== POSTED ===== */
    const posted = await pool.query(`
      SELECT
        id,
        title,
        content,
        created_at,
        'posted' AS activity_type
      FROM posts
      WHERE user_id = $1
    `, [userId]);

    /* ===== LIKED ===== */
    let likedRows = [];

    try {

     const liked = await pool.query(`
  SELECT
    p.id,
    p.title,
    p.content,
    p.created_at,
    'liked' AS activity_type
  FROM post_likes l
  JOIN posts p
    ON p.id = l.post_id
  WHERE l.user_id::text = $1::text
`, [userId]);

      likedRows = liked.rows;

    } catch(err){
      console.log("LIKED QUERY SKIPPED");
    }

    /* ===== COMMENTED ===== */
    let commentedRows = [];

    try {

     const commented = await pool.query(`
  SELECT DISTINCT
    p.id,
    p.title,
    p.content,
    c.created_at,
    'commented' AS activity_type
  FROM comments c
  JOIN posts p
    ON p.id = c.post_id
  WHERE c.user_id::text = $1::text
`, [userId]);

      commentedRows = commented.rows;

    } catch(err){
      console.log("COMMENT QUERY SKIPPED");
    }

    /* ===== MERGE ===== */
    const posts = [
      ...posted.rows,
      ...likedRows,
      ...commentedRows
    ];

    /* ===== SORT ===== */
    posts.sort((a,b)=>
      new Date(b.created_at) -
      new Date(a.created_at)
    );

    res.json({ posts });

  } catch (err) {

    console.error(
      "PROFILE ACTIVITY ERROR:",
      err.message
    );

    res.status(500).json({
      error: "Failed to load activity"
    });

  }

});

// 🎓 Public certificates by username
router.get("/certificates/:username", async (req, res) => {
  try {

    const { username } = req.params;

    const result = await pool.query(`
      SELECT
        c.certificate_id,
        cr.title AS course_name,
        c.issued_at
      FROM certificates c
      JOIN courses cr ON cr.id = c.course_id
      JOIN users u ON u.id = c.user_id
      WHERE u.username = $1
      ORDER BY c.issued_at DESC
    `, [username]);

    res.json(result.rows);

  } catch (err) {
    console.error("❌ Public certificates error:", err);
    res.status(500).json([]);
  }
});

router.get("/completed-courses/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const result = await pool.query(`
      SELECT
        cr.title AS course_name,
        uc.purchased_at
      FROM user_courses uc
      JOIN users u ON u.id = uc.user_id
      JOIN courses cr ON cr.id = uc.course_id
      WHERE u.username = $1
        AND uc.is_active = true
      ORDER BY uc.purchased_at DESC
    `, [username]);

    res.json(result.rows);

  } catch (err) {
    console.error("❌ Public completed courses error:", err);
    res.status(500).json([]);
  }
});

router.get("/certificates/by-user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(`
      SELECT
        c.certificate_id,
        cr.title AS course_name,
        c.issued_at
      FROM certificates c
      JOIN courses cr ON cr.id = c.course_id
      WHERE c.user_id = $1
      ORDER BY c.issued_at DESC
    `, [userId]);

    res.json(result.rows);

  } catch (err) {
    console.error("❌ Resume certificates error", err);
    res.json([]);
  }
});


// 📊 Resume Analytics (views + contacts + conversion)
router.get("/resume/analytics/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT
        COALESCE(resume_views,0) AS views,
        COALESCE(contact_clicks,0) AS contacts
      FROM public_profiles
      WHERE user_id = $1
      LIMIT 1
    `, [userId]);

    const row = result.rows[0] || { views: 0, contacts: 0 };
    const conversion =
      row.views > 0 ? Math.round((row.contacts / row.views) * 100) : 0;

    res.json({
      views: row.views,
      contacts: row.contacts,
      conversion
    });

  } catch (err) {
    console.error("Resume analytics error", err);
    res.status(500).json({ views: 0, contacts: 0, conversion: 0 });
  }
});




// 📩 Track recruiter contact (email / whatsapp)
router.post("/resume/contact", async (req, res) => {
  try {
    const { username, type, message, email } = req.body;

    console.log("📩 CONTACT BODY:", req.body);

    const userRes = await pool.query(
      `SELECT user_id FROM public_profiles WHERE username=$1`,
      [username]
    );

    if (!userRes.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = userRes.rows[0].user_id;

    await pool.query(`
      INSERT INTO resume_contacts (user_id, type, message, email)
      VALUES ($1,$2,$3,$4)
    `, [userId, type, message || null, email || null]);

    await pool.query(`
      UPDATE public_profiles
      SET contact_clicks = contact_clicks + 1
      WHERE user_id = $1
    `, [userId]);

    res.json({ success: true });

  } catch (err) {
    console.error("❌ CONTACT ERROR:", err.message);
    res.status(500).json({ error: "Failed to save contact" });
  }
});

// 📥 Recruiter Inbox (for logged-in user)
router.get("/resume/messages", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT
        type,
        message,
        email,
        created_at
      FROM resume_contacts
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    res.json(result.rows);

  } catch (err) {
    console.error("Recruiter inbox error", err);
    res.status(500).json([]);
  }
});

// ================= GET MY RESUME =================
router.get("/resume/me", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, user_id, data FROM resumes WHERE user_id = $1 LIMIT 1",
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Fetch resume failed:", err);
    res.status(500).json({ error: "Failed to fetch resume" });
  }
});

router.get('/api/feed', verifyToken, async (req, res) => {
  try {

    const offset = parseInt(req.query.offset) || 0;
    const userId = req.user.id;
    const course = req.query.course;

    let query = `
      SELECT 
        posts.id,
        posts.title,
        posts.content,
        posts.image_url,
        posts.media_url,
        posts.media_type,
        posts.likes,
        posts.created_at,
        posts.course,
        posts.repost_of,
        posts.repost_count,

        users.username,
        users.id AS user_id,

        EXISTS (
          SELECT 1 FROM followers f
          WHERE f.follower_id = $2
          AND f.following_id = users.id
        ) AS is_following,

        EXISTS (
          SELECT 1 FROM saved_posts sp
          WHERE sp.user_id = $2
          AND sp.post_id = posts.id
        ) AS is_saved,

        COUNT(comments.id)::int AS comment_count

      FROM posts
      JOIN users ON posts.user_id = users.id
      LEFT JOIN comments ON comments.post_id = posts.id
    `;

    const values = [offset, userId];

    if (course && course.trim() !== "") {
      query += ` WHERE posts.course ILIKE $3`;
      values.push(`%${course}%`);
    }

    query += `
      GROUP BY posts.id, users.id, posts.course
      ORDER BY posts.created_at DESC
      LIMIT 10 OFFSET $1
    `;

    const result = await pool.query(query, values);

    res.json(result.rows);

  } catch (err) {
    console.error("FEED ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/suggestions', verifyToken, async (req, res) => {
  try {

    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT 
        u.id,
        u.username,
        COALESCE(p.course, 'Student') AS course,

        -- mutual followers count
        (
          SELECT COUNT(*) 
          FROM followers f1
          JOIN followers f2 
            ON f1.following_id = f2.following_id
          WHERE f1.follower_id = $1
          AND f2.follower_id = u.id
        ) AS mutual_count,

        -- activity score (posts count)
        (
          SELECT COUNT(*) 
          FROM posts p2 
          WHERE p2.user_id = u.id
        ) AS posts_count

      FROM users u
      LEFT JOIN posts p ON p.user_id = u.id

      WHERE u.id != $1
      GROUP BY u.id, p.course
      ORDER BY mutual_count DESC, posts_count DESC
      LIMIT 6
      `,
      [userId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Suggestion failed" });
  }
});

router.get('/api/profile/:username', async (req, res) => {

  const { username } = req.params;

  const userQuery = await pool.query(
  `SELECT id,
          username,
          role
   FROM users
   WHERE username = $1`,
  [username]
);



  if (userQuery.rows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  const user = userQuery.rows[0];

  const postsQuery = await pool.query(
    `SELECT id, title, content, likes, created_at
     FROM posts
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [user.id]
  );

  const followersQuery = await pool.query(
    `SELECT COUNT(*) FROM followers WHERE following_id = $1`,
    [user.id]
  );

const followersCount = await pool.query(
  `SELECT COUNT(*) FROM followers WHERE following_id = $1`,
  [user.id]
);

const followingCount = await pool.query(
  `SELECT COUNT(*) FROM followers WHERE follower_id = $1`,
  [user.id]
);

res.json({
  user,
  posts: postsQuery.rows,
  followers: parseInt(followersCount.rows[0].count),
  following: parseInt(followingCount.rows[0].count)
});


});

router.delete('/api/posts/:id', verifyToken, async (req, res) => {
  try {

    const postId = req.params.id;
    const userId = req.user.id;

    const result = await pool.query(
      `DELETE FROM posts 
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [postId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: "Not allowed" });
    }

    res.json({ success: true });

  } catch (err) {
    console.error("DELETE POST ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/posts/:id', async (req, res) => {

  const postId = req.params.id;

  const result = await pool.query(
    `SELECT posts.*, users.username
     FROM posts
     JOIN users ON posts.user_id = users.id
     WHERE posts.id = $1`,
    [postId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Post not found" });
  }

  res.json(result.rows[0]);

});

router.put('/api/posts/:id', verifyToken, async (req, res) => {
  try {

    const postId = req.params.id;
    const userId = req.user.id;
    const { content } = req.body;

    const result = await pool.query(
      `UPDATE posts 
       SET content = $1 
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [content, postId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: "Not allowed" });
    }

    res.json({ success: true });

  } catch (err) {
    console.error("EDIT POST ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/me', verifyToken, async (req, res) => {

  const result = await pool.query(
    `SELECT id, username FROM users WHERE id = $1`,
    [req.user.id]
  );

  if (!result.rowCount) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(result.rows[0]);

});


router.get('/api/users/:id/is-following', verifyToken, async (req, res) => {

  const targetUserId = req.params.id;
  const currentUserId = req.user.id;

  const result = await pool.query(
    `SELECT id FROM followers
     WHERE follower_id = $1 AND following_id = $2`,
    [currentUserId, targetUserId]
  );

  res.json({ isFollowing: result.rowCount > 0 });

});

router.get('/api/users/:id/followers', async (req, res) => {

  const userId = req.params.id;

  const result = await pool.query(
    `SELECT users.id, users.username
     FROM followers
     JOIN users ON followers.follower_id = users.id
     WHERE followers.following_id = $1`,
    [userId]
  );

  res.json(result.rows);
});

router.get('/api/users/:id/following', async (req, res) => {

  const userId = req.params.id;

  const result = await pool.query(
    `SELECT users.id, users.username
     FROM followers
     JOIN users ON followers.following_id = users.id
     WHERE followers.follower_id = $1`,
    [userId]
  );

  res.json(result.rows);
});

router.post(
  "/api/posts",
  verifyToken,
  upload.single("media"),
  async (req, res) => {
    try {

      console.log("USER:", req.user);
      console.log("BODY:", req.body);
      console.log("FILE:", req.file);

      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: "Invalid user token"
        });
      }

      const {
        title = "",
        type = "learning",
        content = "",
        course = ""
      } = req.body || {};

      if (!title && !content && !req.file) {
        return res.status(400).json({
          error: "Title, content or media required"
        });
      }

      if (!course) {
        return res.status(400).json({
          error: "Course tag required"
        });
      }

      let mediaUrl = null;
      let mediaType = null;

      if (req.file) {
        mediaUrl = `/uploads/posts/${req.file.filename}`;
        mediaType = req.file.mimetype;
      }

      const result = await pool.query(
        `
        INSERT INTO posts
          (user_id, type, title, content, course, media_url, media_type, image_url)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id
        `,
        [
          userId,
          type,
          title,
          content,
          course,
          mediaUrl,
          mediaType,
          mediaUrl
        ]
      );

      res.json({
        success: true,
        postId: result.rows[0].id,
        media_url: mediaUrl,
        media_type: mediaType
      });

    } catch (err) {
      console.error("POST ERROR:", err);
      res.status(500).json({
        error: err.message
      });
    }
  }
);

router.post('/api/posts/:id/like', verifyToken, async (req, res) => {
console.log("LIKE ROUTE HIT");

  try {

    const postId = req.params.id;
    const userId = req.user.id;

    const existing = await pool.query(
      `SELECT id FROM post_likes
       WHERE user_id = $1 AND post_id = $2`,
      [userId, postId]
    );

    if (existing.rowCount > 0) {
      // Unlike
      await pool.query(
        `DELETE FROM post_likes
         WHERE user_id = $1 AND post_id = $2`,
        [userId, postId]
      );

      await pool.query(
        `UPDATE posts
         SET likes = likes - 1
         WHERE id = $1`,
        [postId]
      );

      return res.json({ unliked: true });
    }

    // Like
    await pool.query(
      `INSERT INTO post_likes (user_id, post_id)
       VALUES ($1, $2)`,
      [userId, postId]
    );

    await pool.query(
      `UPDATE posts
       SET likes = likes + 1
       WHERE id = $1`,
      [postId]
    );

    res.json({ liked: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Like toggle failed" });
  }

});

router.post('/api/posts/:id/repost', verifyToken, async (req, res) => {
  try {

    const originalPostId = req.params.id;
    const userId = req.user.id;

    const original = await pool.query(
      `
      SELECT *
      FROM posts
      WHERE id = $1
      `,
      [originalPostId]
    );

    if (!original.rows.length) {
      return res.status(404).json({
        error: "Original post not found"
      });
    }

    const post = original.rows[0];

    const repost = await pool.query(
      `
      INSERT INTO posts
        (
          user_id,
          type,
          title,
          content,
          image_url,
          media_url,
          media_type,
          course,
          repost_of
        )
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id
      `,
      [
        userId,
        post.type || "learning",
        post.title || "",
        post.content || "",
        post.image_url || null,
        post.media_url || null,
        post.media_type || null,
        post.course || "",
        originalPostId
      ]
    );

    await pool.query(
      `
      UPDATE posts
      SET repost_count = COALESCE(repost_count,0) + 1
      WHERE id = $1
      `,
      [originalPostId]
    );

    res.json({
      success: true,
      repostId: repost.rows[0].id
    });

  } catch (err) {
    console.error("REPOST ERROR:", err.message);
    res.status(500).json({
      error: "Failed to repost"
    });
  }
});

router.post('/api/posts/:id/save', verifyToken, async (req, res) => {
  try {

    const postId = req.params.id;
    const userId = req.user.id;

    const existing = await pool.query(
      `
      SELECT id
      FROM saved_posts
      WHERE user_id = $1
      AND post_id = $2
      `,
      [userId, postId]
    );

    if (existing.rowCount > 0) {
      await pool.query(
        `
        DELETE FROM saved_posts
        WHERE user_id = $1
        AND post_id = $2
        `,
        [userId, postId]
      );

      return res.json({
        saved: false,
        unsaved: true
      });
    }

    await pool.query(
      `
      INSERT INTO saved_posts
        (user_id, post_id)
      VALUES
        ($1,$2)
      `,
      [userId, postId]
    );

    res.json({
      saved: true
    });

  } catch (err) {
    console.error("SAVE POST ERROR:", err.message);
    res.status(500).json({
      error: "Failed to save post"
    });
  }
});

router.post('/api/posts/:id/comments', verifyToken, async (req, res) => {
  try {

    const postId = req.params.id;
    const userId = req.user.id;
    const { content, parentId } = req.body;

    const result = await pool.query(
      `INSERT INTO comments (post_id, user_id, parent_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [postId, userId, parentId || null, content]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Comment failed" });
  }
});

router.get('/api/posts/:id/comments', verifyToken, async (req, res) => {
  try {

    const postId = req.params.id;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        comments.*, 
        users.username,
        (comments.user_id = $2) AS is_owner
       FROM comments
       JOIN users ON comments.user_id = users.id
       WHERE comments.post_id = $1
       ORDER BY comments.created_at ASC`,
      [postId, userId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("COMMENTS ERROR:", err);
    res.status(500).json({ error: "Load comments failed" });
  }
});

router.delete('/api/comments/:id', verifyToken, async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.user.id;

    const result = await pool.query(
      `DELETE FROM comments 
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [commentId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: "Not allowed" });
    }

    res.json({ success: true });

  } catch (err) {
    console.error("DELETE COMMENT ERROR:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

router.put('/api/comments/:id', verifyToken, async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.user.id;
    const { content } = req.body;

    const result = await pool.query(
      `UPDATE comments 
       SET content = $1 
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [content, commentId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: "Not allowed" });
    }

    res.json({ success: true });

  } catch (err) {
    console.error("EDIT COMMENT ERROR:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

router.post('/api/users/:id/follow', verifyToken, async (req, res) => {
  try {

    const targetUserId = parseInt(req.params.id);
    const currentUserId = req.user.id;

    if (!targetUserId) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    // CHECK EXISTING FOLLOW
    const existing = await pool.query(
      `SELECT id FROM followers
       WHERE follower_id = $1 AND following_id = $2`,
      [currentUserId, targetUserId]
    );

    // 🔁 UNFOLLOW
    if (existing.rowCount > 0) {

      await pool.query(
        `DELETE FROM followers
         WHERE follower_id = $1 AND following_id = $2`,
        [currentUserId, targetUserId]
      );

      return res.json({ unfollowed: true });
    }

    // ✅ FOLLOW
    await pool.query(
      `INSERT INTO followers (follower_id, following_id)
       VALUES ($1, $2)`,
      [currentUserId, targetUserId]
    );

    // 🔔 OPTIONAL NOTIFICATION (SAFE)
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, message)
         VALUES ($1, $2)`,
        [targetUserId, "Someone followed you"]
      );
    } catch (notifErr) {
      console.warn("Notification failed:", notifErr.message);
    }

    res.json({ followed: true });

  } catch (err) {
    console.error("FOLLOW ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/notifications', verifyToken, async (req, res) => {

  const userId = req.user.id;

  const result = await pool.query(
    `SELECT * FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  res.json(result.rows);
});

router.get('/u/:username', async (req, res) => {
  const username = req.params.username;

  const user = await pool.query(
    "SELECT * FROM users WHERE username = $1",
    [username]
  );

  if (user.rows.length === 0) {
    return res.status(404).send("User not found");
  }

  const posts = await pool.query(
    "SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC",
    [user.rows[0].id]
  );

  res.render("profile", {
    user: user.rows[0],
    posts: posts.rows
  });
});

router.post("/api/recruiter/register", async (req, res) => {
  try {

    const { company_name, email, password, website, location, description } = req.body;

    const user = await pool.query(
      `INSERT INTO users (email, password, role)
       VALUES ($1, $2, 'recruiter')
       RETURNING id`,
      [email, password]
    );

    const userId = user.rows[0].id;

    await pool.query(
      `INSERT INTO recruiter_profiles
       (user_id, company_name, website, location, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, company_name, website, location, description]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.get('/api/users/:id/preview', verifyToken, async (req, res) => {
  try {

    const userId = req.params.id;

    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,

        COUNT(DISTINCT p.id) AS posts,
        COUNT(DISTINCT f1.id) AS followers,
        COUNT(DISTINCT f2.id) AS following,

        (
          SELECT course FROM posts 
          WHERE user_id = u.id 
          LIMIT 1
        ) AS course

      FROM users u
      LEFT JOIN posts p ON p.user_id = u.id
      LEFT JOIN followers f1 ON f1.following_id = u.id
      LEFT JOIN followers f2 ON f2.follower_id = u.id

      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/:id', verifyToken, async (req, res) => {
  try {

    const userId = req.params.id;

    const result = await pool.query(`
      SELECT 
        id,
        username AS name,
        email,
        role,
        headline,
        bio,
        avatar_url,

        (SELECT COUNT(*) FROM followers WHERE following_id = $1) AS followers,
        (SELECT COUNT(*) FROM followers WHERE follower_id = $1) AS following

      FROM users
      WHERE id = $1
    `, [userId]);

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/:id/posts', verifyToken, async (req, res) => {
  try {

    const userId = req.params.id;

    const result = await pool.query(`
      SELECT 
        id,
        title,
        content,
        course,
        created_at
      FROM posts
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    res.json({ posts: result.rows });

  } catch (err) {
    console.error("USER POSTS ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post(
  "/profile/change-password",
  verifyToken,
  async (req,res)=>{

    try{

      const userId = req.user.id;

      const {
        oldPassword,
        newPassword
      } = req.body;

      const userResult =
        await pool.query(
          "SELECT * FROM users WHERE id = $1",
          [userId]
        );

      const user = userResult.rows[0];

      if(!user){

        return res.status(404).json({
          message:"User not found"
        });
      }

      const isMatch =
        await bcrypt.compare(
          oldPassword,
          user.password
        );

      if(!isMatch){

        return res.status(400).json({
          message:"Current password incorrect"
        });
      }

      const hashed =
        await bcrypt.hash(newPassword,10);

      await pool.query(
        "UPDATE users SET password=$1 WHERE id=$2",
        [hashed,userId]
      );

      res.json({
        message:"Password updated successfully"
      });

    }catch(err){

      console.log(
        "CHANGE PASSWORD ERROR:",
        err
      );

      res.status(500).json({
        message:"Server error"
      });
    }
});

module.exports = router;
