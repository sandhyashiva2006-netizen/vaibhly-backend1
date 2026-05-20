const express = require("express");
const router = express.Router();

const pool = require("../config/db");

/**
 * GET ALL COURSES
 */

router.get(
  "/courses",
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
          SELECT *
          FROM kids_courses
          ORDER BY id ASC
          `
        );

      return res.json(
        result.rows
      );

    }

    catch (err) {

      console.error(
        "Kids courses error:",
        err
      );

      return res.status(500).json({
        success: false
      });

    }

  }
);

/**
 * GET SINGLE COURSE
 */

router.get(
  "/courses/:id",
  async (req, res) => {

    try {

      const courseId =
        Number(req.params.id);

      const result =
        await pool.query(
          `
          SELECT *
          FROM kids_courses
          WHERE id = $1
          `,
          [courseId]
        );

      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          success: false,
          message:
            "Course not found"
        });

      }

      const course =
        result.rows[0];

      // DEMO LESSONS
      const lessons = [

        {
          id: 1,
          title:
            `${course.subject} Introduction`
        },

        {
          id: 2,
          title:
            `${course.subject} Practice`
        },

        {
          id: 3,
          title:
            `${course.subject} Quiz`
        }

      ];

      return res.json({

        success: true,

        course,

        lessons

      });

    }

    catch (err) {

      console.error(
        "Single course error:",
        err
      );

      return res.status(500).json({
        success: false
      });

    }

  }
);

module.exports = router;