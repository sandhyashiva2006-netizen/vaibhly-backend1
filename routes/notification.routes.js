const express = require("express");
const router = express.Router();
const pool = require("../db");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

/* ================= ADMIN SEND NOTIFICATION ================= */
router.post("/send", verifyToken, isAdmin, async (req, res) => {
  try {
    const { title, message, user_id } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "Title and message required" });
    }

    await pool.query(
      `
      INSERT INTO notifications (user_id, title, message)
      VALUES ($1, $2, $3)
      `,
      [user_id || null, title, message]
    );


    res.json({ success: true });

  } catch (err) {
    console.error("Send notification error:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

/* ================= STUDENT FETCH NOTIFICATIONS ================= */
router.get("/my", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT *
      FROM notifications
      WHERE user_id IS NULL OR user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("Fetch notifications error:", err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

/* ================= MARK AS READ ================= */
router.put("/read/:id", verifyToken, async (req, res) => {
  try {
    const notificationId = req.params.id;

    await pool.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE id = $1
      `,
      [notificationId]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

module.exports = router;
