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

console.log("✅ kidsProfiles routes loaded");

router.get("/", verifyToken, async (req, res) => {
  console.log("✅ GET kids profiles hit");
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
router.post("/", verifyToken, async (req, res) => {
  console.log("✅ POST kids profiles hit");

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
router.put("/:id", verifyToken, async (req, res) => {
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
router.delete("/:id", verifyToken, async (req, res) => {
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

/**
 * GET /api/kids/profiles/parent-analytics/:childId
 */

router.get(

  "/parent-analytics/:childId",

  verifyToken,

  async (req, res) => {

    try {

      const childId =
        Number(
          req.params.childId
        );

      let totalXP = 0;
      let totalCoins = 0;
      let streak = 0;
      let watchTime = 0;
      let quizAccuracy = 0;

      // XP + COINS
      try {

        const rewards =
          await pool.query(
            `
            SELECT
              xp,
              coins
            FROM kids_rewards
            WHERE user_id = $1
            `,
            [req.user.id]
          );

        totalXP =
          Number(
            rewards.rows[0]
            ?.xp || 0
          );

        totalCoins =
          Number(
            rewards.rows[0]
            ?.coins || 0
          );

      }

      catch (err) {

        console.log(
          "Rewards table missing"
        );

      }

      // STREAK
      try {

        const streakResult =
          await pool.query(
            `
            SELECT
              streak_count
            FROM kids_daily_streaks
            WHERE user_id = $1
            `,
            [req.user.id]
          );

        streak =
          Number(
            streakResult.rows[0]
            ?.streak_count || 0
          );

      }

      catch (err) {

        console.log(
          "Streak table missing"
        );

      }

      // WATCH TIME
      try {

        const watchResult =
          await pool.query(
            `
            SELECT

              SUM(
                watched_seconds
              ) AS total

            FROM kids_lesson_progress

            WHERE child_id = $1
            `,
            [childId]
          );

        watchTime =
          Number(
            watchResult.rows[0]
            ?.total || 0
          );

      }

      catch (err) {

        console.log(
          "Watch time failed"
        );

      }

      // QUIZ ACCURACY
      try {

        const quizResult =
          await pool.query(
            `
            SELECT

              COUNT(*) AS total,

              SUM(

                CASE

                  WHEN is_correct = true

                  THEN 1

                  ELSE 0

                END

              ) AS correct

            FROM kids_quiz_attempts

            WHERE child_id = $1
            `,
            [childId]
          );

        const totalQuiz =
          Number(
            quizResult.rows[0]
            ?.total || 0
          );

        const correctQuiz =
          Number(
            quizResult.rows[0]
            ?.correct || 0
          );

        if (totalQuiz > 0) {

          quizAccuracy =
            Math.round(

              (
                correctQuiz /
                totalQuiz
              ) * 100

            );

        }

      }

      catch (err) {

        console.log(
          "Quiz stats failed"
        );

      }

      return res.json({

        success: true,

        analytics: {

          totalXP,

          totalCoins,

          streak,

          watchTime,

          quizAccuracy

        }

      });

    }

    catch (err) {

      console.error(
        "Parent analytics error:",
        err
      );

      return res.status(500)
      .json({

        success: false,

        error:
          err.message

      });

    }

  }
);


module.exports = router;