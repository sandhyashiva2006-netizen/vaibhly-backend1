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

const result = await pool.query(
`
SELECT 
  rm.id,
  rm.recruiter_id,
  rm.student_id,
  rm.message,
  rm.type,
  rm.is_read,
  rm.created_at,

  u.username AS student_name,
  u.email AS student_email

FROM recruiter_messages rm

LEFT JOIN users u
ON u.id = rm.student_id

WHERE rm.recruiter_id = $1

ORDER BY rm.created_at DESC
`,
[recruiterId]
);

return res.json(result.rows);

}catch(err){

console.error("RECRUITER INBOX ERROR:", err);

return res.status(500).json({
error:"Failed to load recruiter inbox",
details:err.message
});

}

});

module.exports = router;