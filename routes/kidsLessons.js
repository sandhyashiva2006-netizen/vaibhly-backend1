const express = require("express");
const router = express.Router();

const pool = require("../config/db");

const {
  verifyToken,
  isAdmin
} = require("../middleware/auth.middleware");

/**
 * GET LESSONS BY COURSE
 */

router.get(
  "/lessons/:courseId",
  async (req, res) => {

console.log(
      "✅ LESSON ROUTE HIT:",
      req.params.courseId
    );

    try {

      const courseId =
        Number(req.params.courseId);

      const result =
        await pool.query(
          `
          SELECT *
          FROM kids_lessons
          WHERE course_id = $1
          ORDER BY lesson_order ASC
          `,
          [courseId]
        );

      return res.json({
        success: true,
        lessons: result.rows
      });

    }

    catch (err) {

  console.error(
    "❌ GET kids lessons FULL ERROR:",
    err
  );

  return res.status(500).json({

    success: false,

    message:
      err.message,

    error:
      err

  });

}

  }
);

/**
 * ADMIN CREATE LESSON
 */

router.post(
  "/admin/kids-lessons",
  verifyToken,
  isAdmin,
  async (req, res) => {

    try {

      const {
        course_id,
        title,
        description,
        video_url,
        notes,
        lesson_order
      } = req.body;

      if (
        !course_id ||
        !title
      ) {

        return res.status(400).json({
          success: false,
          message:
            "course_id and title required"
        });

      }

      const result =
        await pool.query(
          `
          INSERT INTO kids_lessons
          (
            course_id,
            title,
            description,
            video_url,
            notes,
            lesson_order
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )

          RETURNING *
          `,
          [
            Number(course_id),
            title,
            description || "",
            video_url || "",
            notes || "",
            Number(lesson_order || 1)
          ]
        );

      return res.json({
        success: true,
        lesson: result.rows[0]
      });

    }

    catch (err) {

      console.error(
        "CREATE lesson error:",
        err
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to create lesson"
      });

    }

  }
);

/**
 * ADMIN DELETE LESSON
 */

router.delete(
  "/admin/kids-lessons/:id",
  verifyToken,
  isAdmin,
  async (req, res) => {

    try {

      const lessonId =
        Number(req.params.id);

      await pool.query(
        `
        DELETE FROM kids_lessons
        WHERE id = $1
        `,
        [lessonId]
      );

      return res.json({
        success: true
      });

    }

    catch (err) {

      console.error(
        "DELETE lesson error:",
        err
      );

      return res.status(500).json({
        success: false
      });

    }

  }
);

module.exports = router;