const express = require("express");
const router = express.Router();
const multer =
  require("multer");

const path =
  require("path");

const pool = require("../config/db");

const {
  verifyToken,
  isAdmin
} = require("../middleware/auth.middleware");

const uploadDir =
  path.join(
    __dirname,
    "..",
    "uploads",
    "kids-lessons"
  );


/* MULTER STORAGE */

const storage =
  multer.diskStorage({

    destination:
  (req, file, cb) => {

    const fs =
      require("fs");

    if (
      !fs.existsSync(uploadDir)
    ) {

      fs.mkdirSync(
        uploadDir,
        { recursive: true }
      );

    }

    cb(
      null,
      uploadDir
    );

  },

    filename:
      (req, file, cb) => {

        cb(
          null,
          Date.now() +
          path.extname(
            file.originalname
          )
        );

      }

  });

const upload =
  multer({ storage });

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
          SELECT
            id,
            course_id,
            title,
            description,
            video_file,
            pdf_file,
            notes,
            lesson_order,
            created_at

          FROM kids_lessons

          WHERE course_id = $1

          ORDER BY lesson_order ASC
          `,
          [courseId]
        );

      return res.json({

        success: true,

        lessons:
          result.rows

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

  upload.fields([
    {
      name: "videoFile",
      maxCount: 1
    },
    {
      name: "pdfFile",
      maxCount: 1
    }
  ]),

  async (req, res) => {

    try {

      const {
        course_id,
        title,
        description,
        notes,
        lesson_order
      } = req.body;

      const videoFile =
        req.files?.videoFile?.[0];

      const pdfFile =
        req.files?.pdfFile?.[0];

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

console.log("VIDEO:", videoFile);
console.log("PDF:", pdfFile);

      const result =
  await pool.query(
    `
    INSERT INTO kids_lessons
    (
      course_id,
      title,
      description,
      video_file,
      pdf_file,
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
      $6,
      $7
    )

    RETURNING *
    `,
    [

      Number(course_id),

      title,

      description || "",

      videoFile
      ? `/uploads/kids-lessons/${videoFile.filename}`
      : null,

      pdfFile
      ? `/uploads/kids-lessons/${pdfFile.filename}`
      : null,

      notes || "",

      Number(lesson_order || 1)

    ]
  );

      return res.json({

        success: true,

        lesson:
          result.rows[0]

      });

    }

    catch (err) {

      console.error(
        "❌ CREATE LESSON ERROR:",
        err
      );

      return res.status(500).json({

        success: false,

        message:
          err.message

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

router.put(
  "/admin/kids-lessons/:id",

  verifyToken,

  async (req, res) => {

    try {

      const lessonId =
        Number(req.params.id);

      const {
        title
      } = req.body;

      const result =
        await pool.query(
          `
          UPDATE kids_lessons
          SET title = $1
          WHERE id = $2
          RETURNING *
          `,
          [
            title,
            lessonId
          ]
        );

      return res.json({

        success: true,

        lesson:
          result.rows[0]

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500).json({
        success: false,
        message:
          err.message
      });

    }

  }
);

module.exports = router;