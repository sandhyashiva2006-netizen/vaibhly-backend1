const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const {
  verifyToken
} = require("../middleware/auth.middleware");

/**
 * POST /api/kids/enroll
 */
router.post("/enroll", verifyToken, async (req, res) => {
  try {
    const parentId = req.user.id;
    const { child_id, course_id } = req.body;

    if (!child_id || !course_id) {
      return res.status(400).json({
        success: false,
        message: "child_id and course_id are required",
      });
    }

    // verify child belongs to parent
    const childCheck = await pool.query(
      `SELECT id FROM kids_profiles WHERE id = $1 AND parent_id = $2`,
      [child_id, parentId]
    );

    if (childCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Child profile not found",
      });
    }

    // verify course exists
    const courseCheck = await pool.query(
      `SELECT id FROM kids_courses WHERE id = $1`,
      [course_id]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Kids course not found",
      });
    }

    // avoid duplicate enrollment
    const existing = await pool.query(
      `SELECT id FROM kids_enrollments
       WHERE parent_id = $1 AND child_id = $2 AND course_id = $3`,
      [parentId, child_id, course_id]
    );

    if (existing.rows.length > 0) {
      return res.json({
        success: true,
        message: "Course already added",
        enrollment: existing.rows[0],
      });
    }

    const result = await pool.query(
      `INSERT INTO kids_enrollments
       (parent_id, child_id, course_id, progress, enrolled_at)
       VALUES ($1, $2, $3, 0, NOW())
       RETURNING *`,
      [parentId, child_id, course_id]
    );

    res.json({
      success: true,
      message: "Course added successfully",
      enrollment: result.rows[0],
    });
  } catch (err) {
    console.error("Kids enroll error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to enroll kids course",
    });
  }
});

/**
 * POST /api/kids/lesson-complete
 * Mark lesson complete
 */
router.post("/lesson-complete", verifyToken, async (req, res) => {
  try {
    const parentId = req.user.id;
    const { child_id, course_id, lesson_id } = req.body;

    if (!child_id || !course_id || !lesson_id) {
      return res.status(400).json({
        success: false,
        message: "child_id, course_id and lesson_id are required",
      });
    }

    const childCheck = await pool.query(
      `SELECT id FROM kids_profiles WHERE id = $1 AND parent_id = $2`,
      [child_id, parentId]
    );

    if (childCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Invalid child profile",
      });
    }

    await pool.query(
      `INSERT INTO kids_lesson_progress 
       (child_id, course_id, lesson_id, completed, completed_at)
       VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP)
       ON CONFLICT (child_id, lesson_id)
       DO UPDATE SET completed = true, completed_at = CURRENT_TIMESTAMP`,
      [child_id, course_id, lesson_id]
    );

    const totalLessonsResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM kids_lessons WHERE course_id = $1`,
      [course_id]
    );

    const completedLessonsResult = await pool.query(
      `SELECT COUNT(*)::int AS completed
       FROM kids_lesson_progress
       WHERE child_id = $1 AND course_id = $2 AND completed = true`,
      [child_id, course_id]
    );

    const total = totalLessonsResult.rows[0]?.total || 0;
    const completed = completedLessonsResult.rows[0]?.completed || 0;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    await pool.query(
      `UPDATE kids_enrollments
       SET progress = $1
       WHERE child_id = $2 AND course_id = $3`,
      [progress, child_id, course_id]
    );

    await pool.query(
      `INSERT INTO kids_daily_activity 
       (child_id, activity_date, lessons_completed, quizzes_completed, coins_earned)
       VALUES ($1, CURRENT_DATE, 1, 0, 5)
       ON CONFLICT (child_id, activity_date)
       DO UPDATE SET 
          lessons_completed = kids_daily_activity.lessons_completed + 1,
          coins_earned = kids_daily_activity.coins_earned + 5`,
      [child_id]
    );

    if (progress >= 100) {
      await pool.query(
        `INSERT INTO kids_badges (child_id, badge_name, badge_icon, badge_type)
         VALUES ($1, 'Course Champion', '🏆', 'course')
         ON CONFLICT DO NOTHING`,
        [child_id]
      );
    } else if (completed === 1) {
      await pool.query(
        `INSERT INTO kids_badges (child_id, badge_name, badge_icon, badge_type)
         VALUES ($1, 'First Lesson Hero', '⭐', 'lesson')`,
        [child_id]
      );
    }

    res.json({
      success: true,
      message: "Lesson completed",
      progress,
      completed,
      total,
    });
  } catch (err) {
    console.error("Lesson complete error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to mark lesson complete",
    });
  }
});

/**
 * GET /api/kids/course-lessons/:courseId?child_id=1
 */
router.get("/course-lessons/:courseId", verifyToken, async (req, res) => {
  try {
    const parentId = req.user.id;
    const courseId = req.params.courseId;
    const childId = req.query.child_id;

    if (!childId) {
      return res.status(400).json({
        success: false,
        message: "child_id is required",
      });
    }

    const childCheck = await pool.query(
      `SELECT id FROM kids_profiles WHERE id = $1 AND parent_id = $2`,
      [childId, parentId]
    );

    if (childCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Invalid child profile",
      });
    }

    const lessons = await pool.query(
      `SELECT 
          l.id,
          l.course_id,
          l.title,
          l.lesson_type,
          l.video_url,
          l.notes,
          l.sort_order,
          COALESCE(lp.completed, false) AS completed
       FROM kids_lessons l
       LEFT JOIN kids_lesson_progress lp 
          ON lp.lesson_id = l.id 
         AND lp.child_id = $2
       WHERE l.course_id = $1
       ORDER BY l.sort_order ASC, l.id ASC`,
      [courseId, childId]
    );

    res.json({
      success: true,
      lessons: lessons.rows,
    });
  } catch (err) {
    console.error("Course lessons error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load lessons",
    });
  }
});

router.post(
  "/complete-lesson",
  verifyToken,
  async (req, res) => {

    try {

      const {
        child_id,
        course_id,
        lesson_index
      } = req.body;

      await pool.query(
        `
        UPDATE kids_enrollments
        SET
          completed_lessons =
            GREATEST(
              completed_lessons,
              $1
            ),

          progress =
            LEAST(
              100,
              ($1::float / total_lessons) * 100
            )

        WHERE
          child_id = $2
          AND course_id = $3
        `,
        [
          lesson_index,
          child_id,
          course_id
        ]
      );

      res.json({
        success: true
      });

    }

    catch (err) {

      console.error(err);

      res.status(500).json({
        success: false
      });

    }

  }
);

module.exports = router;