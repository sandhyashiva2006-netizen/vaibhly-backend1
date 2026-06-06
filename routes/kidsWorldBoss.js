const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.post(
"/boss-complete",
async(req,res)=>{

try{

const {
child_id,
node_id
} = req.body;

const previous =
await pool.query(
`
SELECT *
FROM kids_world_boss_results
WHERE child_id = $1
AND node_id = $2
`,
[
child_id,
node_id
]
);

const firstCompletion =
previous.rows.length === 0;

let rewardXp;
let rewardCoins;

if(firstCompletion){

rewardXp = 500;
rewardCoins = 200;

}
else{

rewardXp = 50;
rewardCoins = 20;

}

await pool.query(
`
INSERT INTO
kids_world_boss_results
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
$1,
$2,
100,
3,
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

await pool.query(
`
UPDATE
kids_world_node_progress

SET

completed = true,

completed_at = NOW()

WHERE

child_id = $1

AND

node_id = $2
`,
[
child_id,
node_id
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

const nodeInfo =
await pool.query(
`
SELECT world_slug
FROM kids_world_nodes
WHERE id = $1
`,
[node_id]
);

if(
!nodeInfo.rows.length
){
return res.status(400).json({
success:false,
message:"Invalid node"
});
}

const worldSlug =
nodeInfo.rows[0].world_slug;

console.log(
"INSERTING WORLD COMPLETION",
child_id
);



await pool.query(
`
INSERT INTO
kids_world_completions
(
child_id,
world_slug
)
VALUES
(
$1,
$2
)
ON CONFLICT
DO NOTHING
`,
[
child_id,
worldSlug
]
);

console.log(
"WORLD COMPLETION SAVED"
);

let nextWorld = null;

if(
worldSlug ===
"learning-village"
){
nextWorld = "jungle";
}

if(
worldSlug ===
"jungle"
){
nextWorld = "pirate";
}

if(
worldSlug ===
"pirate"
){
nextWorld = "kingdom";
}

if(nextWorld){

await pool.query(
`
INSERT INTO
kids_world_progress
(
child_id,
world_slug,
missions_completed,
total_missions,
progress_percent,
completed
)
VALUES
(
$1,
$2,
0,
0,
0,
false
)
ON CONFLICT
DO NOTHING
`,
[
child_id,
nextWorld
]
);

}


return res.json({

success:true,

xp:rewardXp,

coins:rewardCoins,

firstCompletion

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

module.exports = router;