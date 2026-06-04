const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const {
verifyToken
} = require("../middleware/auth.middleware");

router.get(
"/world-map",

async(req,res)=>{

try{

const childId =
Number(req.query.child_id);

const worldSlug =
req.query.world_slug;

const firstNode =
await pool.query(
`
SELECT id
FROM kids_world_nodes
WHERE world_slug = $1
ORDER BY node_order
LIMIT 1
`,
[worldSlug]
);

if(firstNode.rows.length){

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
childId,
firstNode.rows[0].id
]
);

}

const result =
await pool.query(
`
SELECT

n.*,

COALESCE(
p.unlocked,
false
) AS unlocked,

COALESCE(
p.completed,
false
) AS completed

FROM kids_world_nodes n

LEFT JOIN
kids_world_node_progress p

ON p.node_id = n.id

AND p.child_id = $1

WHERE
n.world_slug = $2

ORDER BY n.node_order
`,
[
childId,
worldSlug
]
);

return res.json({

success:true,

nodes:
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

module.exports =
router;