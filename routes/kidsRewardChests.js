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
  "purple-frame";

const frameItem =
  await pool.query(
    `
    SELECT id
    FROM kids_shop_items
    WHERE item_value = 'purple-frame'
    LIMIT 1
    `
  );

if (
  frameItem.rows.length
) {

  await pool.query(
    `
    INSERT INTO
    kids_purchases
    (
      child_id,
      item_id
    )
    VALUES
    (
      $1,
      $2
    )
    ON CONFLICT DO NOTHING
    `,
    [
      child_id,
      frameItem.rows[0].id
    ]
  );

}

      }

      else if (
  random < 0.95
) {

  rewardType =
    "pet";

  rewardValue =
    "tiger-pet";

  const petItem =
    await pool.query(
      `
      SELECT id
      FROM kids_shop_items
      WHERE item_value = 'tiger-pet'
      LIMIT 1
      `
    );

  if (
    petItem.rows.length
  ) {

    await pool.query(
      `
      INSERT INTO
      kids_purchases
      (
        child_id,
        item_id
      )
      VALUES
      (
        $1,
        $2
      )
      ON CONFLICT DO NOTHING
      `,
      [
        child_id,
        petItem.rows[0].id
      ]
    );

  }

}

      else {

  rewardType =
    "theme";

  rewardValue =
    "rocket-theme";

  const themeItem =
    await pool.query(
      `
      SELECT id
      FROM kids_shop_items
      WHERE item_value = 'rocket-theme'
      LIMIT 1
      `
    );

  if (
    themeItem.rows.length
  ) {

    await pool.query(
      `
      INSERT INTO
      kids_purchases
      (
        child_id,
        item_id
      )
      VALUES
      (
        $1,
        $2
      )
      ON CONFLICT DO NOTHING
      `,
      [
        child_id,
        themeItem.rows[0].id
      ]
    );

  }

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