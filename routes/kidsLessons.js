const express = require("express");
const router = express.Router();

const multer =
  require("multer");

const path =
  require("path");

const cloudinary =
  require("../config/cloudinary");

const pool =
  require("../config/db");

const {
  verifyToken,
  isAdmin
} = require(
  "../middleware/auth.middleware"
);

/* =====================================
   TEMP FILE STORAGE
===================================== */

const storage =
  multer.diskStorage({

    destination:
      (req, file, cb) => {

        cb(
          null,
          "uploads/"
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
  multer({
    storage
  });

/* =====================================
   CLOUDINARY PDF UPLOAD
===================================== */

async function uploadPdfToCloudinary(
  filePath
) {

  return await cloudinary
    .uploader
    .upload(

      filePath,

      {

        folder:
          "vaibhly-kids",

        resource_type:
          "raw"

      }

    );

}

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
  l.id,
  l.course_id,
  l.title,
  l.description,
  l.video_file,
  l.pdf_file,
  l.notes,
  l.lesson_order,
  l.created_at,
  false AS completed

FROM kids_lessons l

WHERE l.course_id = $1

ORDER BY l.lesson_order ASC
          `,
          [courseId]
        );

console.log(
  "LESSONS:",
  result.rows
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
      name: "pdfFile",
      maxCount: 1
    }
  ]),

  async (req, res) => {

    try {
console.log(
  "FILES:",
  req.files
);
      const {
        course_id,
        title,
        description,
        notes,
        lesson_order
      } = req.body;

     const videoUrl =
  req.body.video_file || "";

const pdfFile =
  req.files?.pdfFile?.[0];

let pdfUrl = null;


if (pdfFile) {

  const uploadedPdf =
    await uploadPdfToCloudinary(
      pdfFile.path
    );

  pdfUrl =
    uploadedPdf.secure_url;

}

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

      videoUrl,

      pdfUrl,

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