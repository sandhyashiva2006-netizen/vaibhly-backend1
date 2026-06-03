const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const {
  verifyToken
} = require("../middleware/auth.middleware");

router.get(
  "/worlds",
  verifyToken,
  async(req,res)=>{

    try{

      const childId =
        Number(req.query.child_id);

      const result =
        await pool.query(
`
SELECT

  c.world_slug,

  COUNT(DISTINCT c.id)::int
  AS total_courses,

  COUNT(
    DISTINCT CASE
    WHEN e.completed = true
    THEN e.course_id
    END
  )::int
  AS completed_courses

FROM courses c

LEFT JOIN kids_enrollments e

ON e.course_id = c.id

AND e.child_id = $1

WHERE
  c.world_slug IS NOT NULL

GROUP BY c.world_slug

ORDER BY c.world_slug
`,
[childId]
);

      return res.json({

        success:true,

        worlds:
        result.rows

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

router.get(
"/world-progress",
verifyToken,
async(req,res)=>{

  try{

    const childId =
      Number(
        req.query.child_id
      );

    const result =
      await pool.query(
`
SELECT *
FROM kids_world_progress
WHERE child_id = $1
ORDER BY world_slug
`,
[childId]
);

    return res.json({

      success:true,

      progress:
      result.rows

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

router.post(
"/game-complete",
verifyToken,
async(req,res)=>{

try{

const {

child_id,
game_id,
score

} = req.body;

const game =
await pool.query(
`
SELECT *
FROM kids_world_games
WHERE id = $1
`,
[game_id]
);

if(
!game.rows.length
){

return res.status(404)
.json({
success:false
});

}

const worldGame =
game.rows[0];

await pool.query(
`
INSERT INTO
kids_world_game_progress
(
child_id,
game_id,
best_score,
play_count,
completed,
completed_at
)

VALUES
(
$1,
$2,
$3,
1,
true,
NOW()
)

ON CONFLICT
(
child_id,
game_id
)

DO UPDATE SET

best_score =
GREATEST(
kids_world_game_progress.best_score,
EXCLUDED.best_score
),

play_count =
kids_world_game_progress.play_count + 1,

completed = true,

completed_at = NOW()
`,
[
child_id,
game_id,
score
]
);

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

ON CONFLICT(child_id)

DO UPDATE SET

xp =
kids_rewards.xp +
EXCLUDED.xp,

coins =
kids_rewards.coins +
EXCLUDED.coins
`,
[
child_id,
worldGame.reward_xp,
worldGame.reward_coins
]
);

await pool.query(
`
INSERT INTO
kids_pet_evolution
(
child_id,
pet_xp
)

VALUES
(
$1,
$2
)

ON CONFLICT(child_id)

DO UPDATE SET

pet_xp =
kids_pet_evolution.pet_xp
+ EXCLUDED.pet_xp
`,
[
child_id,
worldGame.reward_xp
]
);

const pet =
await pool.query(
`
SELECT *
FROM kids_pet_evolution
WHERE child_id = $1
`,
[child_id]
);

let stage = 1;

if(
pet.rows[0].pet_xp >= 1500
){
stage = 3;
}
else if(
pet.rows[0].pet_xp >= 500
){
stage = 2;
}

await pool.query(
`
UPDATE kids_pet_evolution
SET evolution_stage = $1
WHERE child_id = $2
`,
[
stage,
child_id
]
);

return res.json({

success:true,

xp:
worldGame.reward_xp,

coins:
worldGame.reward_coins,

stage

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