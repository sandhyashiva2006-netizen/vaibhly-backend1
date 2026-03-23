console.log("✅ courseContent.routes LOADED");

const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");

/* ============================================================
   STUDENT: GET COURSE TREE
============================================================ */
router.get("/my-course", verifyToken, async (req, res) => {
  try {

    const courseId = Number(req.query.course_id);

    if(!courseId){
      return res.status(400).json({error:"course_id required"});
    }

    const courseRes = await pool.query(`
      SELECT id,title,description
      FROM courses
      WHERE id=$1
    `,[courseId]);

    if(!courseRes.rows.length){
      return res.json({course:null,modules:[]});
    }

    const course = courseRes.rows[0];

    // Load modules (both systems)
const modulesRes = await pool.query(`
SELECT id,title,course_id,'admin' AS type
FROM course_modules
WHERE course_id=$1

UNION

SELECT id,title,course_id,'instructor' AS type
FROM modules
WHERE course_id=$1

ORDER BY id
`,[course.id]);

for(const module of modulesRes.rows){

 const lessons = await pool.query(`
 SELECT
  id,
  title,
  content,
  video_url,
  pdf_url
 FROM lessons
 WHERE module_id=$1

 UNION

 SELECT
  id,
  title,
  content,
  video_url,
  pdf_url
 FROM course_lessons
 WHERE module_id=$1

 ORDER BY id
 `,[module.id]);

 module.lessons = lessons.rows;

}

res.json({
 course,
 modules:modulesRes.rows
});

  } catch(err){
    console.error(err);
    res.status(500).json({error:"Failed to load course content"});
  }
});

/* ============================================================
   MARK LESSON COMPLETE
============================================================ */
router.post("/mark-complete", verifyToken, async (req, res) => {
  try {

    const userId = req.user.id;
    const { lessonId } = req.body;

    if (!lessonId) {
      return res.status(400).json({ error: "lessonId required" });
    }

    await pool.query(`
      INSERT INTO lesson_progress (user_id, lesson_id, completed, completed_at)
      VALUES ($1,$2,true,NOW())
      ON CONFLICT (user_id, lesson_id)
      DO UPDATE
      SET completed = true,
          completed_at = NOW()
    `,[userId, lessonId]);

    res.json({ success:true });

  } catch(err){
    console.error("MARK COMPLETE ERROR:", err);
    res.status(500).json({ error:"Failed to save progress" });
  }
});

/* ============================================================
   COURSE COMPLETION CHECK  (Dashboard + Exams Unlock)
============================================================ */
router.get("/is-complete", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // TOTAL lessons across user's purchased courses
    const totalRes = await pool.query(`
      SELECT COUNT(DISTINCT l.id) AS total
      FROM course_lessons l
      JOIN course_modules cm ON cm.id = l.module_id
      JOIN user_courses uc ON uc.course_id = cm.course_id
      WHERE uc.user_id = $1
    `, [userId]);

    const total = Number(totalRes.rows[0].total || 0);

    // COMPLETED lessons
    const completedRes = await pool.query(`
      SELECT COUNT(DISTINCT lp.lesson_id) AS completed
      FROM lesson_progress lp
      WHERE lp.user_id = $1
        AND lp.completed = true
    `, [userId]);

    const completed = Number(completedRes.rows[0].completed || 0);

    const percent = total > 0
      ? Math.min(100, Math.round((completed / total) * 100))
      : 0;

    res.json({
      total,
      completed,
      percent,
      isComplete: percent === 100
    });

  } catch (err) {
    console.error("❌ Completion check error:", err);
    res.status(500).json({ error: "Failed to check completion" });
  }
});


/* ================= PROGRESS SUMMARY ================= */
router.get("/progress-summary", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const courseId = Number(req.query.course_id);

    if (!courseId) {
      return res.status(400).json({ error: "course_id required" });
    }

    console.log("📊 Progress summary request:", { userId, courseId });

    const result = await pool.query(`
SELECT
COUNT(DISTINCT l.id) AS total,
COUNT(DISTINCT lp.lesson_id) AS completed
FROM (
    SELECT id,module_id FROM lessons
    UNION
    SELECT id,module_id FROM course_lessons
) l
JOIN (
    SELECT id,course_id FROM modules
    UNION
    SELECT id,course_id FROM course_modules
) m ON m.id = l.module_id
LEFT JOIN lesson_progress lp
ON lp.lesson_id = l.id
AND lp.user_id = $1
WHERE m.course_id = $2
`, [userId, courseId]);

const total = Number(result.rows[0].total || 0);
const completed = Number(result.rows[0].completed || 0);

const percent = total
  ? Math.round((completed / total) * 100)
  : 0;

    const response = {
      total,
      completed,
      percent,
      isComplete: percent === 100
    };

    console.log("📊 Progress summary result:", response);

    res.json({ total, completed, percent });

  } catch (err) {
    console.error("❌ Progress summary error:", err);
    res.status(500).json({ error: "Failed to calculate progress" });
  }
});

router.get("/completed-lessons", verifyToken, async (req, res) => {
  try {

    const userId = req.user.id;
    const courseId = Number(req.query.course_id);

    const result = await pool.query(`
SELECT DISTINCT lp.lesson_id
FROM lesson_progress lp
JOIN (
    SELECT id,module_id FROM lessons
    UNION
    SELECT id,module_id FROM course_lessons
) l ON l.id = lp.lesson_id
JOIN (
    SELECT id,course_id FROM modules
    UNION
    SELECT id,course_id FROM course_modules
) m ON m.id = l.module_id
WHERE lp.user_id = $1
AND m.course_id = $2
`, [userId, courseId]);

res.json(result.rows.map(r => Number(r.lesson_id)));

  } catch(err){
    console.error("Completed lessons error:",err);
    res.status(500).json({error:"Failed to load completed lessons"});
  }
});

/* ============================================================
   LEARNING HISTORY
============================================================ */
router.get("/learning-history", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const lessons = await pool.query(`
      SELECT 
        l.title,
        lp.updated_at AS date,
        'lesson' AS type
      FROM lesson_progress lp
      JOIN lessons l ON l.id = lp.lesson_id
      WHERE lp.user_id = $1
        AND lp.completed = true
      ORDER BY lp.updated_at DESC
    `, [userId]);

    const exams = await pool.query(`
      SELECT 
        e.title,
        r.attempted_at AS date,
        'exam' AS type,
        r.status
      FROM exam_results r
      JOIN exams e ON e.id = r.exam_id
      WHERE r.user_id = $1
      ORDER BY r.attempted_at DESC
    `, [userId]);

    const history = [...lessons.rows, ...exams.rows]
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(history);

  } catch (err) {
    console.error("Learning history error:", err);
    res.status(500).json({ error: "Failed to load learning history" });
  }
});

/* ===============================
GET COURSE MODULES (STUDENT)
=============================== */
router.get("/course/:courseId/modules", async (req, res) => {

 try {

  const modules = await pool.query(`
SELECT * FROM course_modules
WHERE course_id=$1
ORDER BY position
`,[req.params.courseId]);

for(const m of modules.rows){

 const lessons = await pool.query(`
 SELECT *
 FROM course_lessons
 WHERE module_id=$1
 ORDER BY position
 `,[m.id]);

 m.lessons = lessons.rows;
}

 res.json({
 course,
 modules:modules.rows
});

 } catch(err){
  console.error(err);
  res.status(500).json({error:"Modules load failed"});
 }

});


/* ===============================
GET LESSONS
=============================== */
router.get("/module/:moduleId/lessons", async (req,res)=>{

 try{

  const lessons = await pool.query(`
   SELECT *
   FROM course_lessons
   WHERE module_id=$1
   ORDER BY position ASC
  `,[req.params.moduleId]);

  res.json(lessons.rows);

 }catch(err){
  console.error(err);
  res.status(500).json({error:"Lessons load failed"});
 }

});

module.exports = router;
