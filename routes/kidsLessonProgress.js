const express = require("express");
const router = express.Router();
const db = require("../db");



// =====================================
// MARK LESSON COMPLETE
// =====================================

router.post("/complete", async (req, res) => {
  try {
    const {
      user_id,
      course_id,
      module_id,
      lesson_id
    } = req.body;

    await db.query(
      `
      INSERT INTO kids_lesson_progress
      (
        user_id,
        course_id,
        module_id,
        lesson_id,
        completed,
        completed_at
      )
      VALUES ($1,$2,$3,$4,true,NOW())

      ON CONFLICT (user_id, lesson_id)
      DO UPDATE SET
      completed = true,
      completed_at = NOW()
      `,
      [
        user_id,
        course_id,
        module_id,
        lesson_id
      ]
    );

    res.json({
      success: true
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false
    });
  }
});



// =====================================
// GET COURSE PROGRESS
// =====================================

router.get("/:userId/:courseId", async (req, res) => {
  try {

    const { userId, courseId } = req.params;

    const result = await db.query(
      `
      SELECT *
      FROM kids_lesson_progress
      WHERE user_id = $1
      AND course_id = $2
      `,
      [userId, courseId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false
    });
  }
});



module.exports = router;