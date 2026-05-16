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

const result = await pool.query(`
SELECT 
  rm.id,
  rm.student_id,
  rm.recruiter_id,
  rm.message,
  rm.type,
  rm.created_at,

  u.username AS student_name,
  u.email AS student_email

FROM resume_messages rm

LEFT JOIN users u
ON u.id = rm.student_id

WHERE rm.recruiter_id = $1

ORDER BY rm.created_at DESC
`,
[recruiterId]);

res.json(result.rows);

}catch(err){

console.error("Recruiter inbox load error:",err);

res.status(500).json({
error:"Failed to load recruiter inbox"
});

}

});

module.exports = router;