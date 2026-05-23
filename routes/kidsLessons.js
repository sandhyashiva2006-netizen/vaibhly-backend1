const express =
  require("express");

const router =
  express.Router();

const multer =
  require("multer");

const path =
  require("path");

const fs =
  require("fs");

const pool =
  require("../config/db");

const {
  verifyToken,
  isAdmin
} = require(
  "../middleware/auth.middleware"
);

const {
  createClient
} = require(
  "@supabase/supabase-js"
);

const supabase =
  createClient(

    process.env.SUPABASE_URL,

    process.env.SUPABASE_KEY

  );

console.log(
  "SUPABASE URL:",
  process.env.SUPABASE_URL
);

console.log(
  "SUPABASE KEY:",
  process.env.SUPABASE_KEY?.slice(0, 20)
);

const storage =
  multer.diskStorage({

    destination:
      (req, file, cb) => {

        const dir =
          "uploads";

        if (
          !fs.existsSync(dir)
        ) {

          fs.mkdirSync(
            dir,
            { recursive: true }
          );

        }

        cb(null, dir);

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

async function uploadPdfToSupabase(
  file
) {

  const fileBuffer =
    fs.readFileSync(
      file.path
    );

  const fileName =
    file.filename;

  const {
    data,
    error
  } = await supabase
    .storage
    .from("vaibhlykidspdfs")
    .upload(

      fileName,

      fileBuffer,

      {

        upsert: true,

        contentType:
          "application/pdf"

      }

    );

  console.log(
    "SUPABASE RESULT:",
    data
  );

  console.log(
    "SUPABASE ERROR:",
    error
  );

if (error) {

  console.error(
    "SUPABASE FULL ERROR:",
    JSON.stringify(
      error,
      null,
      2
    )
  );

  throw new Error(
    JSON.stringify(error)
  );

}

  const {
    data: publicData
  } = supabase
    .storage
    .from("vaibhlykidspdfs")
    .getPublicUrl(
      fileName
    );

fs.unlinkSync(file.path);

  return publicData.publicUrl;

}

/**
 * GET LESSONS BY COURSE
 */

router.get(
  "/lessons/:courseId",
verifyToken,
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

  COALESCE(
    p.completed,
    false
  ) AS completed,

  COALESCE(
    p.watched_seconds,
    0
  ) AS watched_seconds

FROM kids_lessons l

LEFT JOIN
kids_lesson_progress p

ON
p.lesson_id = l.id

AND
p.child_id = $2

WHERE l.course_id = $1

ORDER BY l.lesson_order ASC
          `,
          [
  courseId,
  Number(req.query.child_id || 0)
]
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
    name: "video_file",
    maxCount: 1
  },

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

  pdfUrl =
    await uploadPdfToSupabase(
      pdfFile
    );

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

router.post(
  "/lessons/:lessonId/complete",

  verifyToken,

  async (req, res) => {

    try {

      const lessonId =
        Number(req.params.lessonId);

      const userId =
        req.user.id;

      await pool.query(

        `
        INSERT INTO kids_lesson_progress
        (
          user_id,
          lesson_id,
          completed,
          completed_at
        )

        VALUES
        (
          $1,
          $2,
          true,
          NOW()
        )

        ON CONFLICT
        (
          user_id,
          lesson_id
        )

        DO UPDATE SET

          completed = true,

          completed_at = NOW()
        `,

        [
          userId,
          lessonId
        ]

      );

      return res.json({

        success: true

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500).json({

        success: false

      });

    }

  }
);

router.post(
  "/lessons/:lessonId/progress",

  verifyToken,

  async (req, res) => {

    try {

      const lessonId =
        Number(req.params.lessonId);

      const userId =
        req.user.id;

      const {
        watched_seconds
      } = req.body;

      await pool.query(

        `
        INSERT INTO kids_lesson_progress
        (
          user_id,
          lesson_id,
          watched_seconds
        )

        VALUES
        (
          $1,
          $2,
          $3
        )

        ON CONFLICT
        (
          user_id,
          lesson_id
        )

        DO UPDATE SET

          watched_seconds = $3
        `,

        [
          userId,
          lessonId,
          watched_seconds
        ]

      );

      return res.json({

        success: true

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500).json({

        success: false

      });

    }

  }
);

router.get(
  "/course-progress/:courseId",

  verifyToken,

  async (req, res) => {

    try {

      const courseId =
        Number(req.params.courseId);

      const userId =
        req.user.id;

      const totalLessons =
        await pool.query(

          `
          SELECT COUNT(*)

          FROM kids_lessons

          WHERE course_id = $1
          `,

          [courseId]

        );

      const completedLessons =
        await pool.query(

          `
          SELECT COUNT(*)

          FROM kids_lesson_progress p

          JOIN kids_lessons l

          ON l.id = p.lesson_id

          WHERE
          l.course_id = $1

          AND
          p.user_id = $2

          AND
          p.completed = true
          `,

          [
            courseId,
            userId
          ]

        );

      const total =
        Number(
          totalLessons.rows[0]
          .count
        );

      const completed =
        Number(
          completedLessons.rows[0]
          .count
        );

      const progress =
        total === 0
          ? 0
          : Math.round(
              (
                completed /
                total
              ) * 100
            );

      return res.json({

        success: true,

        progress,

        completed,

        total

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500).json({

        success: false

      });

    }

  }
);

router.post(
  "/update-streak",

  verifyToken,

  async (req, res) => {

    try {

      const userId =
        req.user.id;

      const today =
        new Date();

      const todayStr =
        today
        .toISOString()
        .split("T")[0];

      const existing =
        await pool.query(

          `
          SELECT *

          FROM kids_daily_streaks

          WHERE user_id = $1
          `,

          [userId]

        );

      // FIRST TIME
      if (
        !existing.rows.length
      ) {

        await pool.query(

          `
          INSERT INTO
          kids_daily_streaks
          (
            user_id,
            streak_count,
            last_activity_date
          )

          VALUES
          (
            $1,
            1,
            $2
          )
          `,

          [
            userId,
            todayStr
          ]

        );

        return res.json({

          success: true,

          streak: 1

        });

      }

      const streakData =
        existing.rows[0];

      const lastDate =
        new Date(
          streakData
          .last_activity_date
        );

      const diffDays =
        Math.floor(

          (
            today - lastDate
          )

          /

          (
            1000 *
            60 *
            60 *
            24
          )

        );

      let newStreak =
        streakData
        .streak_count;

      // NEXT DAY
      if (diffDays === 1) {

        newStreak++;

      }

      // MISSED DAYS
      else if (
        diffDays > 1
      ) {

        newStreak = 1;

      }

      // SAME DAY
      else {

        return res.json({

          success: true,

          streak:
            newStreak

        });

      }

      await pool.query(

        `
        UPDATE
        kids_daily_streaks

        SET

          streak_count = $1,

          last_activity_date = $2

        WHERE user_id = $3
        `,

        [
          newStreak,
          todayStr,
          userId
        ]

      );

      return res.json({

        success: true,

        streak:
          newStreak

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500).json({

        success: false

      });

    }

  }
);

router.post(
  "/reward-lesson",

  verifyToken,

  async (req, res) => {

    try {

      const userId =
        req.user.id;

      const {

        xp,
        coins

      } = req.body;

      const existing =
        await pool.query(

          `
          SELECT *

          FROM kids_rewards

          WHERE user_id = $1
          `,

          [userId]

        );

      // FIRST TIME
      if (
        !existing.rows.length
      ) {

        await pool.query(

          `
          INSERT INTO
          kids_rewards
          (
            user_id,
            xp,
            coins
          )

          VALUES
          (
            $1,
            $2,
            $3
          )
          `,

          [
            userId,
            xp,
            coins
          ]

        );

      }

      else {

        await pool.query(

          `
          UPDATE kids_rewards

          SET

            xp = xp + $1,

            coins = coins + $2,

            updated_at = NOW()

          WHERE user_id = $3
          `,

          [
            xp,
            coins,
            userId
          ]

        );

      }

      const updated =
        await pool.query(

          `
          SELECT *

          FROM kids_rewards

          WHERE user_id = $1
          `,

          [userId]

        );

      return res.json({

        success: true,

        rewards:
          updated.rows[0]

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500).json({

        success: false

      });

    }

  }
);

// =====================================
// GET QUIZ BY LESSON
// =====================================

router.get(
  "/lessons/:lessonId/quiz",

  verifyToken,

  async (req, res) => {

    try {

      const lessonId =
        Number(req.params.lessonId);

      const result =
        await pool.query(
          `
          SELECT
            id,
            question,
            option_a,
            option_b,
            option_c,
            option_d,
            xp_reward,
            coin_reward
          FROM kids_quizzes
          WHERE lesson_id = $1
          ORDER BY id ASC
          `,
          [lessonId]
        );

      return res.json({

        success: true,

        quizzes:
          result.rows

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500).json({

        success: false

      });

    }

  }
);

// =====================================
// SUBMIT QUIZ
// =====================================

router.post(
  "/quiz/:quizId/submit",

  verifyToken,

  async (req, res) => {

    try {

      const quizId =
        Number(req.params.quizId);

      const userId =
        req.user.id;

      const {
        selected_option
      } = req.body;

      const quizResult =
        await pool.query(
          `
          SELECT *
          FROM kids_quizzes
          WHERE id = $1
          `,
          [quizId]
        );

      if (
        !quizResult.rows.length
      ) {

        return res.status(404).json({

          success: false,

          message:
            "Quiz not found"

        });

      }

      const quiz =
        quizResult.rows[0];

      const alreadyAttempted =
        await pool.query(
          `
          SELECT id
          FROM kids_quiz_attempts
          WHERE
          user_id = $1
          AND quiz_id = $2
          `,
          [
            userId,
            quizId
          ]
        );

      if (
        alreadyAttempted.rows.length
      ) {

        return res.json({

          success: true,

          alreadyAttempted: true

        });

      }

      const isCorrect =
        selected_option ===
        quiz.correct_option;

      const earnedXP =
        isCorrect
          ? Number(
              quiz.xp_reward || 0
            )
          : 0;

      const earnedCoins =
        isCorrect
          ? Number(
              quiz.coin_reward || 0
            )
          : 0;

      await pool.query(
        `
        INSERT INTO kids_quiz_attempts
        (
          user_id,
          quiz_id,
          selected_option,
          is_correct,
          earned_xp,
          earned_coins
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
        `,
        [
          userId,
          quizId,
          selected_option,
          isCorrect,
          earnedXP,
          earnedCoins
        ]
      );

      if (isCorrect) {

        const existingRewards =
          await pool.query(
            `
            SELECT *
            FROM kids_rewards
            WHERE user_id = $1
            `,
            [userId]
          );

        if (
          !existingRewards.rows.length
        ) {

          await pool.query(
            `
            INSERT INTO
            kids_rewards
            (
              user_id,
              xp,
              coins
            )

            VALUES
            (
              $1,
              $2,
              $3
            )
            `,
            [
              userId,
              earnedXP,
              earnedCoins
            ]
          );

        }

        else {

          await pool.query(
            `
            UPDATE kids_rewards

            SET

              xp = xp + $1,

              coins = coins + $2,

              updated_at = NOW()

            WHERE user_id = $3
            `,
            [
              earnedXP,
              earnedCoins,
              userId
            ]
          );

        }

      }

      // LEVEL CHECK

      const rewardsResult =
        await pool.query(
          `
          SELECT xp
          FROM kids_rewards
          WHERE user_id = $1
          `,
          [userId]
        );

      const totalXP =
        Number(
          rewardsResult.rows[0]?.xp || 0
        );

      const levelResult =
        await pool.query(
          `
          SELECT level_number
          FROM kids_levels
          WHERE required_xp <= $1
          ORDER BY required_xp DESC
          LIMIT 1
          `,
          [totalXP]
        );

      return res.json({

        success: true,

        correct:
          isCorrect,

        earnedXP,

        earnedCoins,

        totalXP,

        level:
          levelResult.rows[0]
          ?.level_number || 1

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500).json({

        success: false

      });

    }

  }
);

module.exports = router;