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

      const result =
        await pool.query(
          `
          SELECT

            c.id,

            c.challenge_name,

            c.challenge_type,

            c.target_value,

            c.reward_xp,

            c.reward_coins,

            COALESCE(
              p.progress_value,
              0
            ) AS progress_value,

            COALESCE(
              p.completed,
              false
            ) AS completed,

            COALESCE(
              p.reward_claimed,
              false
            ) AS reward_claimed

          FROM
          kids_weekly_challenges c

          LEFT JOIN
          kids_weekly_challenge_progress p

          ON

            p.challenge_id =
            c.id

            AND

            p.child_id = $1

          WHERE
            c.is_active = true

          ORDER BY
            c.id
          `,
          [childId]
        );

      return res.json({

        success:true,

        challenges:
          result.rows

      });

    }

    catch(err) {

      console.error(err);

      return res.status(500)
      .json({
        success:false
      });

    }

  }
);

router.post(
  "/claim",
  verifyToken,
  async (req,res) => {

    try {

      const {
        child_id,
        challenge_id
      } = req.body;

      const progress =
        await pool.query(
          `
          SELECT

            p.*,

            c.reward_xp,

            c.reward_coins

          FROM
          kids_weekly_challenge_progress p

          JOIN
          kids_weekly_challenges c

          ON
          c.id =
          p.challenge_id

          WHERE

            p.child_id = $1

            AND

            p.challenge_id = $2
          `,
          [
            child_id,
            challenge_id
          ]
        );

      if (
        !progress.rows.length
      ) {

        return res.json({

          success:false,

          message:
            "Challenge not found"

        });

      }

      const row =
        progress.rows[0];

      if (
        !row.completed
      ) {

        return res.json({

          success:false,

          message:
            "Challenge not completed"

        });

      }

      if (
        row.reward_claimed
      ) {

        return res.json({

          success:false,

          message:
            "Reward already claimed"

        });

      }

      await pool.query(
        `
        UPDATE kids_rewards

        SET

          xp =
            COALESCE(xp,0)+$1,

          coins =
            COALESCE(coins,0)+$2

        WHERE child_id = $3
        `,
        [
          row.reward_xp,
          row.reward_coins,
          child_id
        ]
      );

      await pool.query(
        `
        UPDATE
        kids_weekly_challenge_progress

        SET

          reward_claimed = true

        WHERE

          child_id = $1

          AND

          challenge_id = $2
        `,
        [
          child_id,
          challenge_id
        ]
      );

      return res.json({

        success:true,

        xp:
          row.reward_xp,

        coins:
          row.reward_coins

      });

    }

    catch(err) {

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