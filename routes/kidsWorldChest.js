const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.post(
  "/open-chest",
  async (req, res) => {

    try {

      const {
        child_id,
        node_id
      } = req.body;

      const existing =
        await pool.query(
          `
          SELECT *
          FROM kids_world_chest_claims
          WHERE child_id = $1
          AND node_id = $2
          `,
          [
            child_id,
            node_id
          ]
        );

      if (
        existing.rows.length
      ) {

        return res.json({

          success: true,

          already_claimed: true,

          reward_type:
            existing.rows[0]
              .reward_type,

          reward_value:
            existing.rows[0]
              .reward_value

        });

      }

      const rewards = [

        {
          type: "coins",
          value: "100"
        },

        {
          type: "xp",
          value: "200"
        },

        {
          type: "coins",
          value: "150"
        },

        {
          type: "xp",
          value: "300"
        }

      ];

      const reward =
        rewards[
          Math.floor(
            Math.random() *
            rewards.length
          )
        ];

      await pool.query(
        `
        INSERT INTO
        kids_world_chest_claims
        (
          child_id,
          node_id,
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
          node_id,
          reward.type,
          reward.value
        ]
      );

await pool.query(
`
INSERT INTO
kids_world_node_progress
(
child_id,
node_id,
unlocked,
completed,
completed_at
)

VALUES
(
$1,
$2,
true,
true,
NOW()
)

ON CONFLICT
(
child_id,
node_id
)

DO UPDATE SET

completed = true,

completed_at = NOW()
`,
[
child_id,
node_id
]
);

      let rewardXp = 0;
      let rewardCoins = 0;

      if (
        reward.type === "xp"
      ) {

        rewardXp =
          Number(
            reward.value
          );

      }

      if (
        reward.type === "coins"
      ) {

        rewardCoins =
          Number(
            reward.value
          );

      }

      await pool.query(
        `
        INSERT INTO
        kids_rewards
        (
          child_id,
          xp,
          coins
        )
        VALUES
        (
          $1,
          $2,
          $3
        )
        ON CONFLICT (child_id)
        DO UPDATE SET

        xp =
          kids_rewards.xp +
          EXCLUDED.xp,

        coins =
          kids_rewards.coins +
          EXCLUDED.coins,

        updated_at = NOW()
        `,
        [
          child_id,
          rewardXp,
          rewardCoins
        ]
      );

      const currentNode =
        await pool.query(
          `
          SELECT
            world_slug,
            node_order
          FROM kids_world_nodes
          WHERE id = $1
          `,
          [node_id]
        );

      if (
        currentNode.rows.length
      ) {

        const node =
          currentNode.rows[0];

        const nextNode =
          await pool.query(
            `
            SELECT id
            FROM kids_world_nodes
            WHERE world_slug = $1
            AND node_order = $2
            `,
            [
              node.world_slug,
              node.node_order + 1
            ]
          );

        if (
          nextNode.rows.length
        ) {

          await pool.query(
            `
            INSERT INTO
            kids_world_node_progress
            (
              child_id,
              node_id,
              unlocked
            )
            VALUES
            (
              $1,
              $2,
              true
            )
            ON CONFLICT DO NOTHING
            `,
            [
              child_id,
              nextNode.rows[0].id
            ]
          );

        }

      }

      return res.json({

        success: true,

        reward_type:
          reward.type,

        reward_value:
          reward.value,

        xp:
          rewardXp,

        coins:
          rewardCoins

      });

    }
    catch (err) {

      console.error(err);

      return res
        .status(500)
        .json({

          success: false

        });

    }

  }
);

module.exports = router;