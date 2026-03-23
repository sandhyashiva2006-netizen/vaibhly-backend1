console.log("✅ instructor.lesson.routes LOADED");

const express = require("express");
const router = express.Router();

const pool = require("../config/db");

const upload =
require("../config/upload");

const cloudinary =
require("../config/cloudinary");

const {
 verifyToken,
 isInstructor
} = require("../middleware/auth.middleware");

const { uploadVideo, uploadPdf } = require("../config/upload");

/* ===============================
GET LESSONS
=============================== */
router.get(
"/instructor/lessons",
verifyToken,
isInstructor,
async(req,res)=>{

 const lessons = await pool.query(`
 SELECT *
 FROM course_lessons
 WHERE module_id=$1
 ORDER BY position,id
 `,
 [req.query.module_id]);

 res.json(lessons.rows);
});


/* ===============================
CREATE LESSON
=============================== */
router.post(
"/instructor/lessons",
verifyToken,
isInstructor,
async(req,res)=>{

 const {
  module_id,
  title,
  content
 } = req.body;

 const result = await pool.query(`
 INSERT INTO course_lessons
 (module_id,title,content)
 VALUES($1,$2,$3)
 RETURNING *
 `,
 [module_id,title,content]);

 res.json(result.rows[0]);
});


/* ===============================
DELETE LESSON
=============================== */
router.delete(
"/instructor/lessons/:id",
verifyToken,
isInstructor,
async(req,res)=>{

 await pool.query(
 `DELETE FROM course_lessons WHERE id=$1`,
 [req.params.id]
 );

 res.json({success:true});
});

router.post(
"/instructor/lessons/:id/video",
verifyToken,
isInstructor,
upload.single("video"),
async(req,res)=>{

 try{

  if(!req.file)
   return res.status(400)
   .json({error:"No file uploaded"});

  const videoUrl =
"/uploads/"+req.file.filename;

  await pool.query(`
   UPDATE course_lessons
   SET video_url=$1
   WHERE id=$2
  `,
  [videoUrl,req.params.id]);

  res.json({
   video_url:videoUrl
  });

 }catch(err){
  console.error(err);
  res.status(500)
  .json({error:"Upload failed"});
 }

});

router.post(
"/instructor/lessons/:id/pdf",
verifyToken,
isInstructor,
upload.single("pdf"),
async(req,res)=>{

 try{

  if(!req.file)
   return res.status(400)
   .json({error:"No pdf"});

  const pdfUrl =
"/uploads/"+req.file.filename;

  await pool.query(`
   UPDATE course_lessons
   SET pdf_url=$1
   WHERE id=$2
  `,
  [pdfUrl,req.params.id]);

  res.json({
   pdf_url:pdfUrl
  });

 }catch(err){
  console.error(err);
  res.status(500)
  .json({error:"PDF upload failed"});
 }

});

router.delete(
"/instructor/lessons/:id/video",
verifyToken,
isInstructor,
async(req,res)=>{

 await pool.query(`
 UPDATE course_lessons
 SET video_url=NULL
 WHERE id=$1
 `,
 [req.params.id]);

 res.json({success:true});
});

router.delete(
"/instructor/lessons/:id/pdf",
verifyToken,
isInstructor,
async(req,res)=>{

 await pool.query(`
 UPDATE course_lessons
 SET pdf_url=NULL
 WHERE id=$1
 `,
 [req.params.id]);

 res.json({success:true});
});

module.exports = router;