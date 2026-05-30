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

      const result =
        await pool.query(
          `
          SELECT *
          FROM kids_reward_chests
          WHERE active = true
          ORDER BY id
          `
        );

      return res.json({

        success:true,

        chests:
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
  "/open",
  verifyToken,
  async (req,res) => {

    try {

      const {
        child_id,
        chest_id
      } = req.body;

      const chest =
        await pool.query(
          `
          SELECT *
          FROM kids_reward_chests
          WHERE id = $1
          `,
          [chest_id]
        );

      if (
        !chest.rows.length
      ) {

        return res.json({

          success:false,

          message:
            "Chest not found"

        });

      }

      const cost =
        chest.rows[0]
        .coin_cost;

      const rewards =
        await pool.query(
          `
          SELECT *
          FROM kids_rewards
          WHERE child_id = $1
          `,
          [child_id]
        );

      if (
        !rewards.rows.length
      ) {

        return res.json({

          success:false,

          message:
            "Reward account not found"

        });

      }

      const coins =
        Number(
          rewards.rows[0]
          .coins || 0
        );

      if (
        coins < cost
      ) {

        return res.json({

          success:false,

          message:
            "Not enough coins"

        });

      }

      await pool.query(
        `
        UPDATE kids_rewards

        SET coins =
          coins - $1

        WHERE child_id = $2
        `,
        [
          cost,
          child_id
        ]
      );

      const random =
        Math.random();

      let rewardType;
      let rewardValue;

      if (random < 0.40) {

        rewardType =
          "xp";

        rewardValue =
          50;

        await pool.query(
          `
          UPDATE kids_rewards

          SET xp =
            COALESCE(xp,0)+50

          WHERE child_id = $1
          `,
          [child_id]
        );

      }

      else if (
        random < 0.70
      ) {

        rewardType =
          "coins";

        rewardValue =
          100;

        await pool.query(
          `
          UPDATE kids_rewards

          SET coins =
            COALESCE(coins,0)+100

          WHERE child_id = $1
          `,
          [child_id]
        );

      }

      else if (
        random < 0.85
      ) {

        rewardType =
          "frame";

        rewardValue =
          "gold-frame";

      }

      else if (
        random < 0.95
      ) {

        rewardType =
          "pet";

        rewardValue =
          "dragon-pet";

      }

      else {

        rewardType =
          "badge";

        rewardValue =
          "Lucky Explorer";

        await pool.query(
          `
          INSERT INTO
          kids_badges
          (
            child_id,
            badge_name,
            badge_icon,
            badge_type
          )
          VALUES
          (
            $1,
            'Lucky Explorer',
            '🎁',
            'achievement'
          )
          `,
          [child_id]
        );

      }

      await pool.query(
        `
        INSERT INTO
        kids_chest_openings
        (
          child_id,
          chest_id,
          reward_type,
          reward_value
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4
        )
        `,
        [
          child_id,
          chest_id,
          rewardType,
          rewardValue
        ]
      );

      return res.json({

        success:true,

        rewardType,

        rewardValue

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