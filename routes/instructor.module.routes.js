const express = require("express");
const router = express.Router();

const pool = require("../config/db");

const { verifyToken } =
require("../middleware/auth.middleware");

const {
 allowInstructor
} = require("../middleware/role.middleware");


/* ===============================
GET MODULES
=============================== */
router.get(
"/instructor/modules",
verifyToken,
allowInstructor,
async(req,res)=>{

 try{

  const modules =
  await pool.query(`
   SELECT *
   FROM course_modules
   WHERE course_id=$1
   ORDER BY position,id
  `,
  [req.query.course_id]);

  res.json(modules.rows);

 }catch(err){
  console.error(err);
  res.status(500).json({error:"Load modules failed"});
 }

});


/* ===============================
CREATE MODULE
=============================== */
router.post(
"/instructor/modules",
verifyToken,
allowInstructor,
async(req,res)=>{

 const {course_id,title} = req.body;

 const result =
 await pool.query(`
 INSERT INTO course_modules
 (course_id,title)
 VALUES($1,$2)
 RETURNING *
 `,
 [course_id,title]);

 res.json(result.rows[0]);
});


/* ===============================
DELETE MODULE
=============================== */
router.delete(
"/instructor/modules/:id",
verifyToken,
allowInstructor,
async(req,res)=>{

 await pool.query(
 `DELETE FROM course_modules
  WHERE id=$1`,
 [req.params.id]
 );

 res.json({message:"Deleted"});
});


/* ===============================
REORDER MODULES
=============================== */
router.post(
"/instructor/modules/reorder",
verifyToken,
allowInstructor,
async(req,res)=>{

 const {items}=req.body;

 for(const item of items){
  await pool.query(
   `UPDATE course_modules
    SET position=$1
    WHERE id=$2`,
   [item.position,item.id]
  );
 }

 res.json({success:true});
});

module.exports = router;