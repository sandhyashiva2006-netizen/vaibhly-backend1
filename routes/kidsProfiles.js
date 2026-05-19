const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const {
  verifyToken
} = require("../middleware/auth.middleware");

/**
 * GET /api/kids/profiles
 * Get all child profiles of logged-in parent/user
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const parentId = req.user.id;

    const result = await pool.query(
      `SELECT id, parent_id, child_name, class_level, avatar, created_at
       FROM kids_profiles
       WHERE parent_id = $1
       ORDER BY id DESC`,
      [parentId]
    );

    res.json({
      success: true,
      profiles: result.rows,
    });
  } catch (err) {
    console.error("GET kids profiles error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load child profiles",
    });
  }
});

/**
 * POST /api/kids/profiles
 * Add child profile
 */
router.post("/", authenticateToken, async (req, res) => {
  try {
    const parentId = req.user.id;
    const { child_name, class_level, avatar } = req.body;

    if (!child_name || !class_level) {
      return res.status(400).json({
        success: false,
        message: "Child name and class are required",
      });
    }

    const result = await pool.query(
      `INSERT INTO kids_profiles (parent_id, child_name, class_level, avatar)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        parentId,
        child_name.trim(),
        String(class_level).trim(),
        avatar || "/assets/kids-avatar.png",
      ]
    );

    res.json({
      success: true,
      message: "Child profile added",
      profile: result.rows[0],
    });
  } catch (err) {
    console.error("POST kids profile error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to add child profile",
    });
  }
});

/**
 * PUT /api/kids/profiles/:id
 * Update child profile
 */
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const parentId = req.user.id;
    const profileId = req.params.id;
    const { child_name, class_level, avatar } = req.body;

    const result = await pool.query(
      `UPDATE kids_profiles
       SET child_name = COALESCE($1, child_name),
           class_level = COALESCE($2, class_level),
           avatar = COALESCE($3, avatar)
       WHERE id = $4 AND parent_id = $5
       RETURNING *`,
      [child_name, class_level, avatar, profileId, parentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Child profile not found",
      });
    }

    res.json({
      success: true,
      message: "Child profile updated",
      profile: result.rows[0],
    });
  } catch (err) {
    console.error("PUT kids profile error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update child profile",
    });
  }
});

/**
 * DELETE /api/kids/profiles/:id
 */
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const parentId = req.user.id;
    const profileId = req.params.id;

    const result = await pool.query(
      `DELETE FROM kids_profiles
       WHERE id = $1 AND parent_id = $2
       RETURNING id`,
      [profileId, parentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Child profile not found",
      });
    }

    res.json({
      success: true,
      message: "Child profile deleted",
    });
  } catch (err) {
    console.error("DELETE kids profile error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete child profile",
    });
  }
});

module.exports = router;