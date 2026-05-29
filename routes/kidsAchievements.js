const express =
  require("express");

const router =
  express.Router();

const pool =
  require("../config/db");

const {
  verifyToken
} =
require("../middleware/auth.middleware");

router.get(
  "/list",
  verifyToken,
  async (req,res) => {

    try {

      const childId =
        Number(
          req.query.child_id
        );

      const earned =
  await pool.query(
    `
    SELECT
      badge_name,
      badge_icon,
      badge_type,
      earned_at
    FROM kids_badges
    WHERE child_id = $1
    ORDER BY earned_at DESC
    `,
    [childId]
  );

      const stats =
  await pool.query(
    `
    SELECT

      COUNT(*) AS total_badges,

      MIN(earned_at) AS first_badge,

      MAX(earned_at) AS latest_badge

    FROM kids_badges

    WHERE child_id = $1
    `,
    [childId]
  );

const latestBadge =
  await pool.query(
    `
    SELECT
      badge_name,
      badge_icon,
      earned_at

    FROM kids_badges

    WHERE child_id = $1

    ORDER BY earned_at DESC

    LIMIT 1
    `,
    [childId]
  );

    return res.json({

  success:true,

  earned:
    earned.rows,

  stats:
    stats.rows[0],

  latestBadge:
    latestBadge.rows[0] || null

});

    }

    catch(err){

      console.error(err);

      return res.status(500)
      .json({
        success:false
      });

    }

  }
);

module.exports =
  router;