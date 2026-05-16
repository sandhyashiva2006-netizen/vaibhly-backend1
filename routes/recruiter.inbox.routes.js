const express = require("express");
const router = express.Router();

const pool = require("../config/db");

const { verifyToken } =
require("../middleware/auth.middleware");

const { allowRecruiter } =
require("../middleware/role.middleware");


/* ================= GET RECRUITER INBOX ================= */

router.get(
"/recruiter/inbox",
verifyToken,
allowRecruiter,
async(req,res)=>{

try{

const recruiterId = req.user.id;

console.log("Recruiter inbox requested by:", recruiterId);

const result = await pool.query(
`
SELECT 
  rm.*
FROM resume_messages rm
WHERE rm.recruiter_id = $1
ORDER BY rm.created_at DESC
`,
[recruiterId]
);

return res.json(result.rows);

}catch(err){

console.error("RECRUITER INBOX DB ERROR:", err.message);
console.error("RECRUITER INBOX FULL ERROR:", err);

return res.status(500).json({
error:"Failed to load recruiter inbox",
details: err.message
});

}

});

module.exports = router;