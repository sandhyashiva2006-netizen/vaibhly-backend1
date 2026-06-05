const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.post(
"/world-game-complete",
async(req,res)=>{

try{

const {
child_id,
node_id,
score,
stars
} = req.body;

let rewardXp = 10;
let rewardCoins = 5;

const existingScore =
await pool.query(
`
SELECT *
FROM kids_world_game_scores
WHERE child_id = $1
AND node_id = $2
`,
[
child_id,
node_id
]
);

const firstCompletion =
existingScore.rows.length === 0;

await pool.query(
`
INSERT INTO
kids_world_game_scores
(
child_id,
node_id,
score,
stars,
completed,
completed_at
)

VALUES
(
$1,$2,$3,$4,
true,
NOW()
)

ON CONFLICT
(
child_id,
node_id
)

DO UPDATE SET

score = EXCLUDED.score,
stars = EXCLUDED.stars,
completed = true,
completed_at = NOW()
`,
[
child_id,
node_id,
score || 100,
stars || 3
]
);

if(firstCompletion){

rewardXp = 50;
rewardCoins = 20;

}

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

if(currentNode.rows.length){

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

if(nextNode.rows.length){

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

ON CONFLICT
DO NOTHING
`,
[
child_id,
nextNode.rows[0].id
]
);

}

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

return res.json({

success:true,

xp:rewardXp,

coins:rewardCoins,

first_completion:
firstCompletion

});

}
catch(err){

console.error(err);

return res.status(500).json({
success:false
});

}

}
);

module.exports = router;