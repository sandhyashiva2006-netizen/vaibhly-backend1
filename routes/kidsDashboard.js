const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const {
  verifyToken
} = require("../middleware/auth.middleware");

/**
 * GET /api/kids/parent-dashboard
 * Parent dashboard summary
 */
router.get("/parent-dashboard", verifyToken, async (req, res) => {
  try {
    const parentId = req.user.id;

    const profilesResult = await pool.query(
      `SELECT id, child_name, class_level, avatar, created_at
       FROM kids_profiles
       WHERE parent_id = $1
       ORDER BY id DESC`,
      [parentId]
    );

    const children = profilesResult.rows;



    if (children.length === 0) {
      return res.json({
        success: true,
        hasChildren: false,
        children: [],
        selectedChild: null,
        summary: {
          courses: 0,
          lessonsCompleted: 0,
          badges: 0,
          averageProgress: 0,
        },
        courses: [],
        badges: [],
      });
    }

    const selectedChildId = req.query.child_id || children[0].id;

    const selectedChild = children.find(
      (c) => Number(c.id) === Number(selectedChildId)
    ) || children[0];

    const coursesResult = await pool.query(
  `
  SELECT
    ke.course_id,

    kc.title,
    kc.subject,
    kc.path,

    COALESCE(ke.progress, 0)::int AS progress,

    COALESCE(
      ke.completed_lessons,
      0
    )::int AS completed_lessons,

    COALESCE(
      ke.total_lessons,
      2
    )::int AS total_lessons

  FROM kids_enrollments ke

  INNER JOIN kids_courses kc
    ON kc.id = ke.course_id

  WHERE ke.child_id = $1

  ORDER BY ke.id DESC
  `,
  [selectedChild.id]
);

    const badgesResult = await pool.query(
      `SELECT id, badge_name, badge_icon, badge_type, earned_at
       FROM kids_badges
       WHERE child_id = $1
       ORDER BY earned_at DESC
       LIMIT 8`,
      [selectedChild.id]
    );

    const lessonsCompletedResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM kids_lesson_progress
       WHERE child_id = $1 AND completed = true`,
      [selectedChild.id]
    );

    const summary = {
  courses: coursesResult.rows.length,
      lessonsCompleted: lessonsCompletedResult.rows[0]?.count || 0,
      badges: badgesResult.rows.length,
      averageProgress:
        coursesResult.rows.length > 0
          ? Math.round(
              coursesResult.rows.reduce(
                (sum, item) => sum + Number(item.progress || 0),
                0
              ) / coursesResult.rows.length
            )
          : 0,
    };

console.log(
  "🔥 DASHBOARD COURSES:",
  coursesResult.rows
);

    res.json({
      success: true,
      hasChildren: true,
      children,
      selectedChild,
      summary,
      courses: coursesResult.rows,
      badges: badgesResult.rows,
    });
  } catch (err) {
    console.error("Parent dashboard error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load parent dashboard",
    });
  }
});

/**
 * GET /api/kids/dashboard?child_id=1
 * Kids dashboard
 */
router.get("/dashboard", verifyToken, async (req, res) => {
  try {
    const parentId = req.user.id;
    const childId = req.query.child_id;

    if (!childId) {
      return res.status(400).json({
        success: false,
        message: "child_id is required",
      });
    }

    const childResult = await pool.query(
      `SELECT id, child_name, class_level, avatar
       FROM kids_profiles
       WHERE id = $1 AND parent_id = $2`,
      [childId, parentId]
    );

    if (childResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Child profile not found",
      });
    }

    const child = childResult.rows[0];

    const coursesResult = await pool.query(
  `
  SELECT
    e.id AS enrollment_id,

    e.progress::int,
    e.completed_lessons::int,
    e.total_lessons::int,

    c.id AS course_id,
    c.title,
    c.description,
    c.class_level,
    c.subject,
    c.path,
    c.thumbnail

  FROM kids_enrollments e

  JOIN kids_courses c
    ON c.id = e.course_id

  WHERE
    e.parent_id = $1
    AND e.child_id = $2

  ORDER BY e.enrolled_at DESC
  `,
  [parentId, childId]
);

    const badgesResult = await pool.query(
      `SELECT id, badge_name, badge_icon, badge_type, earned_at
       FROM kids_badges
       WHERE child_id = $1
       ORDER BY earned_at DESC
       LIMIT 8`,
      [childId]
    );

    const todayActivityResult = await pool.query(
      `SELECT lessons_completed, quizzes_completed, coins_earned
       FROM kids_daily_activity
       WHERE child_id = $1 AND activity_date = CURRENT_DATE`,
      [childId]
    );

    const todayActivity =
      todayActivityResult.rows[0] || {
        lessons_completed: 0,
        quizzes_completed: 0,
        coins_earned: 0,
      };

    const nextCourse = coursesResult.rows[0] || null;

    res.json({
      success: true,
      child,
      courses: coursesResult.rows,
      badges: badgesResult.rows,
      todayActivity,
      mission: {
        title: nextCourse ? nextCourse.title : "Start your first mission",
        subtitle: nextCourse
          ? "Continue your learning adventure"
          : "Choose a kids course and begin",
        progress: nextCourse ? Number(nextCourse.progress || 0) : 0,
      },
    });
  } catch (err) {
    console.error("Kids dashboard error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load kids dashboard",
    });
  }
});

module.exports = router;