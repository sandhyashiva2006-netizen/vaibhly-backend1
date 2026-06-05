const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.post(
"/open-chest",
async(req,res)=>{

try{

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

if(
existing.rows.length
){

return res.json({

success:true,

already_claimed:true,

reward_type:
existing.rows[0].reward_type,

reward_value:
existing.rows[0].reward_value

});

}

const rewards = [

{
type:"coins",
value:"100"
},

{
type:"xp",
value:"200"
},

{
type:"coins",
value:"150"
},

{
type:"xp",
value:"300"
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
$1,$2,$3,$4
)
`,
[
child_id,
node_id,
reward.type,
reward.value
]
);

if(
reward.type ===
"coins"
){

await pool.query(
`
UPDATE kids
SET reward_coins =
COALESCE(
reward_coins,
0
) + $1
WHERE id = $2
`,
[
Number(
reward.value
),
child_id
]
);

}

if(
reward.type ===
"xp"
){

await pool.query(
`
UPDATE kids
SET xp =
COALESCE(
xp,
0
) + $1
WHERE id = $2
`,
[
Number(
reward.value
),
child_id
]
);

}

return res.json({

success:true,

reward_type:
reward.type,

reward_value:
reward.value

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