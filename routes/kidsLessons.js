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

async function checkAndUnlockBadges(
  child_id
) {

  try {

    const newlyUnlocked = [];

    // EXISTING BADGES
    const existingBadges =
      await pool.query(
        `
        SELECT badge_name
        FROM kids_badges
        WHERE child_id = $1
        `,
        [child_id]
      );

    const earned =
      existingBadges.rows.map(
        b => b.badge_name
      );

    // LESSON COUNT
    const lessonsResult =
      await pool.query(
        `
        SELECT COUNT(*)::int AS total
        FROM kids_lesson_progress
        WHERE
        child_id = $1
        AND completed = true
        `,
        [child_id]
      );

    const lessonsCompleted =
      lessonsResult.rows[0].total;

    // QUIZ COUNT
    const quizResult =
      await pool.query(
        `
        SELECT COUNT(*)::int AS total
        FROM kids_quiz_attempts
        WHERE
        child_id = $1
        AND is_correct = true
        `,
        [child_id]
      );

    const quizzesCompleted =
      quizResult.rows[0].total;

    // XP
    const xpResult =
      await pool.query(
        `
        SELECT xp
        FROM kids_rewards
WHERE child_id = $1
        `,
        [child_id]
      );

    const totalXP =
      Number(
        xpResult.rows[0]?.xp || 0
      );

    // STREAK
    const streakResult =
      await pool.query(
        `
        SELECT streak_count
        FROM kids_daily_streaks
        WHERE child_id = $1
        `,
        [child_id]
      );

    const streak =
      Number(
        streakResult.rows[0]
        ?.streak_count || 0
      );

    // RULES
    const rules =
      await pool.query(
        `
        SELECT *
        FROM kids_badge_rules
        `
      );

    for (const rule of rules.rows) {

      if (
        earned.includes(
          rule.badge_name
        )
      ) {

        continue;

      }

      let unlocked = false;

      if (
        rule.trigger_type ===
        "lessons_completed"
      ) {

        unlocked =
          lessonsCompleted >=
          rule.trigger_value;

      }

      if (
        rule.trigger_type ===
        "quizzes_completed"
      ) {

        unlocked =
          quizzesCompleted >=
          rule.trigger_value;

      }

      if (
        rule.trigger_type ===
        "xp_earned"
      ) {

        unlocked =
          totalXP >=
          rule.trigger_value;

      }

      if (
        rule.trigger_type ===
        "streak_days"
      ) {

        unlocked =
          streak >=
          rule.trigger_value;

      }

      if (unlocked) {

        const inserted =
          await pool.query(
            `
            INSERT INTO kids_badges
            (
              child_id,
              badge_name,
              badge_icon,
              badge_type,
              earned_at
            )

            VALUES
            (
              $1,
              $2,
              $3,
              'achievement',
              NOW()
            )

            RETURNING *
            `,
            [
  child_id,
  rule.badge_name,
  rule.badge_icon
]
          );

        newlyUnlocked.push(
          inserted.rows[0]
        );

      }

    }

    return newlyUnlocked;

  }

  catch (err) {

    console.error(
      "Badge unlock error:",
      err
    );

    return [];

  }

}


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
      ) AS watched_seconds,

      COALESCE(
        e.completed,
        false
      ) AS course_completed

    FROM kids_lessons l

    LEFT JOIN
    kids_lesson_progress p

    ON
    p.lesson_id = l.id

    AND
    p.child_id = $2

    LEFT JOIN
    kids_enrollments e

    ON
    e.course_id = l.course_id

    AND
    e.child_id = $2

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

      console.log(
        "🔥 COMPLETE ROUTE HIT"
      );

      console.log(
        "BODY:",
        req.body
      );

      console.log(
        "PARAMS:",
        req.params
      );

      const lessonId =
        Number(req.params.lessonId);

      const {
  child_id,
  course_id
} = req.body;

      await pool.query(
        `
        INSERT INTO
        kids_lesson_progress
        (

          child_id,
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
          child_id,
          lesson_id
        )

        DO UPDATE SET

          completed = true,

          completed_at = NOW()
        `,
        [
          child_id,
          lessonId
        ]
      );

      console.log(
        "✅ lesson progress saved"
      );

      const unlockedBadges =
        await checkAndUnlockBadges(
          child_id
        );

      const totalLessonsResult =
        await pool.query(
          `
          SELECT COUNT(*)::int AS total

          FROM kids_lessons

          WHERE course_id = (

            SELECT course_id

            FROM kids_lessons

            WHERE id = $1

          )
          `,
          [lessonId]
        );

      const completedLessonsResult =
        await pool.query(
          `
          SELECT COUNT(*)::int AS completed

          FROM kids_lesson_progress lp

          JOIN kids_lessons l

          ON l.id = lp.lesson_id

          WHERE

            lp.child_id = $1

            AND l.course_id = (

              SELECT course_id

              FROM kids_lessons

              WHERE id = $2

            )

            AND lp.completed = true
          `,
          [
            child_id,
            lessonId
          ]
        );

      

      const totalLessons =
        totalLessonsResult.rows[0]
        ?.total || 0;

      const completedLessons =
        completedLessonsResult.rows[0]
        ?.completed || 0;

      const progress =

        totalLessons === 0

          ? 0

          : Math.round(
              (
                completedLessons /
                totalLessons
              ) * 100
            );

      await pool.query(
        `
        UPDATE kids_enrollments

        SET

          completed_lessons = $1,

          total_lessons = $2,

          progress = $3,

          completed = $4

        WHERE

          child_id = $5

          AND course_id = $6
        `,
        [
          completedLessons,
          totalLessons,
          progress,
          progress >= 100,
          child_id,
          course_id
        ]
      );

console.log(
  "🏆 CERTIFICATE CHECK",
  {
    child_id,
    course_id,
    progress
  }
);

if (progress >= 100) {

  const existingCert =
    await pool.query(
      `
      SELECT id

      FROM kids_certificates

      WHERE

        child_id = $1

        AND course_id = $2
      `,
      [
        child_id,
        course_id
      ]
    );

  if (
    !existingCert.rows.length
  ) {

console.log(
  "🏆 CREATING CERTIFICATE"
);

    const certId =
      "KID-" +
      Math.random()
        .toString(36)
        .substring(2,10)
        .toUpperCase();

    await pool.query(
      `
      INSERT INTO
      kids_certificates
      (

        child_id,
        course_id,
        certificate_id

      )

      VALUES
      (
        $1,
        $2,
        $3
      )
      `,
      [
        child_id,
        course_id,
        certId
      ]
    );

  console.log(
      "🏆 CERTIFICATE CREATED",
      certId
    );

  }

}

      console.log({
        progress,
        completedLessons,
        totalLessons
      });

await updateDailyQuestProgress(

  child_id,

  "lesson_complete",

  1

);

await updateWeeklyChallengeProgress(
  child_id,
  "lesson",
  1
);

      return res.json({

        success: true,

        unlockedBadges,

        progress,

        completedLessons,

        totalLessons

      });

    }

    catch (err) {

      console.error(
        "LESSON COMPLETE ERROR:",
        err
      );

      return res.status(500).json({

        success: false,

        message: err.message

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

const {
  child_id
} = req.body;

      await pool.query(

        `
      INSERT INTO kids_lesson_progress
(
  child_id,
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
  child_id,
  lesson_id
)

DO UPDATE SET

  watched_seconds = $3,

  updated_at = NOW()
        `,

        [
  child_id,
  lessonId,
  watched_seconds
]

      );

await updateDailyQuestProgress(

  child_id,

  "watch_time",

  watched_seconds

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

      const childId =
  parseInt(
    req.query.child_id,
    10
  );

if (
  Number.isNaN(childId)
) {

  return res.status(400)
  .json({

    success:false,

    message:
      "Invalid child id"

  });

}

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
          p.child_id = $2

          AND
          p.completed = true
          `,

          [
  courseId,
  childId
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

      const childId =
        parseInt(
          req.body.child_id,
          10
        );

      if (
        Number.isNaN(childId)
      ) {

        return res.status(400)
        .json({

          success:false,

          message:
            "Invalid child id"

        });

      }

      const today =
        new Date()
        .toISOString()
        .split("T")[0];

      const existing =
        await pool.query(
          `
          SELECT *

          FROM kids_daily_streaks

          WHERE child_id = $1
          `,
          [childId]
        );

      let newStreak = 1;

      if (
        existing.rows.length === 0
      ) {

        await pool.query(
          `
          INSERT INTO
          kids_daily_streaks
          (
            child_id,
            streak_count,
            last_activity_date
          )

          VALUES
          (
            $1,
            $2,
            $3
          )
          `,
          [
            childId,
            1,
            today
          ]
        );

      }

      else {

        const streakData =
          existing.rows[0];

        const lastDate =
          new Date(
            streakData.last_activity_date
          );

        const currentDate =
          new Date(today);

        const diffDays =
          Math.floor(
            (
              currentDate -
              lastDate
            ) /
            (
              1000 *
              60 *
              60 *
              24
            )
          );

        newStreak =
          streakData.streak_count;

        if (
          diffDays === 1
        ) {

          newStreak += 1;

        }

        else if (
          diffDays > 1
        ) {

          newStreak = 1;

        }

        await pool.query(
          `
          UPDATE kids_daily_streaks

          SET

            streak_count = $1,

            last_activity_date = $2

          WHERE child_id = $3
          `,
          [
            newStreak,
            today,
            childId
          ]
        );

      }

      return res.json({

        success:true,

        streak:newStreak

      });

    }

    catch (err) {

      console.error(
        "UPDATE STREAK ERROR:",
        err
      );

      return res.status(500)
      .json({

        success:false,

        message:
          err.message

      });

    }

  }
);

router.post(

  "/reward-lesson",

  verifyToken,

  async (req, res) => {

    console.log(
      "🔥 REWARD ROUTE HIT"
    );

    console.log(
      req.body
    );

    try {

      const {

  xp,
  coins,
  child_id

} = req.body;

console.log({
  xp,
  coins,
  child_id
});

await pool.query(

  `
  INSERT INTO kids_rewards
  (

    child_id,
    xp,
    coins

  )

  VALUES
  (
    $1,
    $2,
    $3
  )

  ON CONFLICT (child_id)

  DO UPDATE SET

    xp =
      kids_rewards.xp + EXCLUDED.xp,

    coins =
      kids_rewards.coins + EXCLUDED.coins,

    updated_at = NOW()
  `,

  [
    child_id,
    xp,
    coins
  ]

);

const updated =
  await pool.query(

    `
    SELECT *

    FROM kids_rewards

    WHERE child_id = $1
    `,

    [child_id]

  );

console.log(
  "✅ UPDATED REWARDS:",
  updated.rows[0]
);

return res.json({

  success: true,

  rewards:
    updated.rows[0]

});

    }

    catch (err) {

      console.error(
        "REWARD ROUTE ERROR:",
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

      

      const {

  selected_option,

  child_id

} = req.body;

console.log({

  selected_option,

  child_id,

  body: req.body

});

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
          child_id = $1
          AND quiz_id = $2
          `,
          [
  child_id,
  quizId
]
        );

      if (
        alreadyAttempted.rows.length
      ) {

await checkAndUnlockBadges(
  child_id
);

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
  child_id,
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
  child_id,
  quizId,
  selected_option,
  isCorrect,
  earnedXP,
  earnedCoins
]
      );

      if (isCorrect) {

await updateDailyQuestProgress(

  child_id,

  "quiz_answer",

  1

);

await updateWeeklyChallengeProgress(
  child_id,
  "quiz",
  1
);

        const existingRewards =
          await pool.query(
            `
            SELECT *
            FROM kids_rewards
            WHERE child_id = $1
            `,
            [child_id]
          );

        if (
          !existingRewards.rows.length
        ) {

          await pool.query(
            `
            INSERT INTO
kids_rewards
(

  child_id,
  xp,
  coins

)

VALUES
(
  $1,
  $2,
  $3
)

ON CONFLICT (child_id)

DO UPDATE SET

  xp =
    kids_rewards.xp + EXCLUDED.xp,

  coins =
    kids_rewards.coins + EXCLUDED.coins
            `,
            [
  child_id,
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

            WHERE child_id = $3
            `,
            [
  earnedXP,
  earnedCoins,
  child_id
]
          );

        }

      }

if (earnedXP > 0) {

  await updateWeeklyChallengeProgress(
    child_id,
    "xp",
    earnedXP
  );

}

// =====================================
// UPDATE LEARNING PROFILE
// =====================================

const profile =
  await pool.query(
    `
    SELECT *
    FROM kids_learning_profile
    WHERE child_id = $1
    `,
    [child_id]
  );

let totalCorrect = 0;
let totalWrong = 0;

if (profile.rows.length) {

  totalCorrect =
    Number(
      profile.rows[0]
      .total_correct || 0
    );

  totalWrong =
    Number(
      profile.rows[0]
      .total_wrong || 0
    );

}

if (isCorrect) {

  totalCorrect++;

}

else {

  totalWrong++;

}

const totalAnswered =
  totalCorrect +
  totalWrong;

let accuracy = 0;

if (totalAnswered > 0) {

  accuracy =
    Math.round(

      (
        totalCorrect /
        totalAnswered
      ) * 100

    );

}

let skillLevel =
  "beginner";

if (accuracy >= 80) {

  skillLevel =
    "advanced";

}

else if (accuracy >= 50) {

  skillLevel =
    "intermediate";

}

await pool.query(
  `
  INSERT INTO
  kids_learning_profile
  (

    child_id,
    skill_level,
    total_correct,
    total_wrong,
    accuracy_percent

  )

  VALUES
  (
    $1,
    $2,
    $3,
    $4,
    $5
  )

  ON CONFLICT (child_id)

  DO UPDATE SET

    skill_level = $2,

    total_correct = $3,

    total_wrong = $4,

    accuracy_percent = $5,

    updated_at = NOW()
  `,
  [

    child_id,

    skillLevel,

    totalCorrect,

    totalWrong,

    accuracy

  ]
);

      // LEVEL CHECK

      const rewardsResult =
        await pool.query(
          `
          SELECT xp
          FROM kids_rewards
WHERE child_id = $1
          `,
          [child_id]
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

const unlockedBadges =
  await checkAndUnlockBadges(
    child_id
  );

console.log({
  child_id,
  earnedXP,
  earnedCoins
});


      return res.json({

        success: true,

unlockedBadges,

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

      console.error(
  "QUIZ SUBMIT ERROR:",
  err
);

      return res.status(500).json({

        success: false

      });

    }

  }
);

async function updateWeeklyChallengeProgress(
  child_id,
  challengeType,
  amount = 1
) {

  try {

    const challenges =
      await pool.query(
        `
        SELECT *
        FROM kids_weekly_challenges
        WHERE
          challenge_type = $1
          AND is_active = true
        `,
        [challengeType]
      );

    for (const challenge of challenges.rows) {

      const existing =
        await pool.query(
          `
          SELECT *
          FROM kids_weekly_challenge_progress
          WHERE
            child_id = $1
            AND challenge_id = $2
          `,
          [
            child_id,
            challenge.id
          ]
        );

      let progress = amount;

      if (
        existing.rows.length
      ) {

        progress =
          Number(
            existing.rows[0]
            .progress_value || 0
          ) + amount;

      }

      const completed =
        progress >=
        challenge.target_value;

      await pool.query(
        `
        INSERT INTO
        kids_weekly_challenge_progress
        (
          child_id,
          challenge_id,
          progress_value,
          completed
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4
        )

        ON CONFLICT
        (
          child_id,
          challenge_id
        )

        DO UPDATE SET

          progress_value = $3,

          completed = $4,

          updated_at = NOW()
        `,
        [
          child_id,
          challenge.id,
          progress,
          completed
        ]
      );

    }

  }

  catch(err) {

    console.error(
      "WEEKLY CHALLENGE ERROR:",
      err
    );

  }

}

// =====================================
// LEARNING PROFILE
// =====================================

router.get(

  "/learning-profile/:childId",

  verifyToken,

  async (req, res) => {

    try {

      const childId =
  parseInt(
    req.params.childId,
    10
  );

if (
  Number.isNaN(childId)
) {

  return res.status(400)
  .json({

    success:false,

    message:
      "Invalid child id"

  });

}

      const result =
        await pool.query(
          `
          SELECT *
          FROM kids_learning_profile
          WHERE child_id = $1
`,
[childId]
        );

      return res.json({

        success: true,

        profile:
          result.rows[0] || null

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500)
      .json({

        success:false

      });

    }

  }
);

// =====================================
// ADMIN CREATE QUIZ
// =====================================

router.post(
  "/admin/kids-quizzes",

  verifyToken,

  async (req, res) => {

    try {

      const {

        lesson_id,
        question,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        xp_reward,
        coin_reward

      } = req.body;

      const result =
        await pool.query(
          `
          INSERT INTO kids_quizzes
          (
            lesson_id,
            question,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_option,
            xp_reward,
            coin_reward
          )

          VALUES
          (
            $1,$2,$3,$4,$5,$6,$7,$8,$9
          )

          RETURNING *
          `,
          [

            Number(lesson_id),

            question,

            option_a,

            option_b,

            option_c,

            option_d,

            correct_option,

            Number(xp_reward || 15),

            Number(coin_reward || 10)

          ]
        );

      return res.json({

        success: true,

        quiz:
          result.rows[0]

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
// ENROLL COURSE
// =====================================

router.post(
  "/enroll",

  verifyToken,

  async (req, res) => {

    try {

      const {
        child_id,
        course_id
      } = req.body;

      if (
        !child_id ||
        !course_id
      ) {

        return res.status(400)
        .json({

          success:false,

          message:
            "child_id and course_id required"

        });

      }

      const existing =
        await pool.query(
          `
          SELECT id
          FROM kids_enrollments
          WHERE
          child_id = $1
          AND course_id = $2
          `,
          [
            child_id,
            course_id
          ]
        );

      if (
        existing.rows.length
      ) {

        return res.json({

          success:true,

          alreadyEnrolled:true

        });

      }

      await pool.query(
        `
        INSERT INTO
        kids_enrollments
        (
          child_id,
          course_id,
          completed
        )

        VALUES
        (
          $1,
          $2,
          false
        )
        `,
        [
          child_id,
          course_id
        ]
      );

      return res.json({

        success:true

      });

    }

    catch (err) {

      console.error(
        "Enroll course error:",
        err
      );

      return res.status(500)
      .json({

        success:false,

        message:
          err.message

      });

    }

  }
);

// =====================================
// COMPLETE COURSE
// =====================================

router.post(
  "/complete-course",

  verifyToken,

  async (req, res) => {

    try {

      const {
        child_id,
        course_id
      } = req.body;

      const existing =
        await pool.query(
          `
          SELECT completed
          FROM kids_enrollments
          WHERE
          child_id = $1
          AND course_id = $2
          `,
          [
            child_id,
            course_id
          ]
        );

      if (
        existing.rows[0]
        ?.completed
      ) {

        return res.json({

          success: true,

          alreadyCompleted: true

        });

      }

      await pool.query(
        `
        UPDATE kids_enrollments

        SET completed = true

        WHERE
        child_id = $1
        AND course_id = $2
        `,
        [
          child_id,
          course_id
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

// =====================================
// GET LEVEL DATA
// =====================================

router.get(
  "/level-data",

  verifyToken,

  async (req, res) => {

    try {

const childId =
  parseInt(
    req.query.child_id,
    10
  );

if (
  Number.isNaN(childId)
) {

  return res.status(400)
  .json({

    success:false,

    message:
      "Invalid child id"

  });

}
      const rewards =
        await pool.query(
          `
          SELECT xp
          FROM kids_rewards
WHERE child_id = $1
          `,
          [childId]
        );

      const totalXP =
        Number(
          rewards.rows[0]?.xp || 0
        );

      const currentLevel =
        await pool.query(
          `
          SELECT *
          FROM kids_levels
          WHERE required_xp <= $1
          ORDER BY required_xp DESC
          LIMIT 1
          `,
          [totalXP]
        );

      const nextLevel =
        await pool.query(
          `
          SELECT *
          FROM kids_levels
          WHERE required_xp > $1
          ORDER BY required_xp ASC
          LIMIT 1
          `,
          [totalXP]
        );

      const level =
        currentLevel.rows[0];

      const next =
        nextLevel.rows[0];

      let progress = 100;

      if (next) {

        const currentXP =
          totalXP -
          level.required_xp;

        const neededXP =
          next.required_xp -
          level.required_xp;

        progress =
          Math.round(
            (
              currentXP /
              neededXP
            ) * 100
          );

      }

      return res.json({

        success: true,

        xp: totalXP,

        currentLevel:
          level.level_number,

        currentLevelXP:
          level.required_xp,

        nextLevel:
          next?.level_number || null,

        nextLevelXP:
          next?.required_xp || null,

        progress

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
// LEADERBOARD
// =====================================

router.get(
  "/leaderboard",

  verifyToken,

  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
          SELECT

            kp.id,
            kp.child_name AS name,
            kp.avatar,

            COALESCE(
              kr.xp,
              0
            ) AS xp,

            COALESCE(
              kr.coins,
              0
            ) AS coins,

            COALESCE(
              ds.streak_count,
              0
            ) AS streak

          FROM kids_profiles kp

          LEFT JOIN
          kids_rewards kr

          ON kr.child_id = kp.id

          LEFT JOIN
          kids_daily_streaks ds

          ON ds.child_id = kp.id

          ORDER BY xp DESC

          LIMIT 10
          `
        );

      return res.json({

        success: true,

        leaderboard:
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
// SHOP ITEMS
// =====================================

router.get(
  "/shop-items",

  verifyToken,

  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
          SELECT *
          FROM kids_shop_items
          ORDER BY item_price ASC
          `
        );

      return res.json({

        success: true,

        items:
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
// PURCHASE ITEM
// =====================================

router.post(
  "/purchase-item",

  verifyToken,

  async (req, res) => {

    try {

      const userId =
        req.user.id;

      const {
  item_id,
  child_id
} = req.body;

      const item =
        await pool.query(
          `
          SELECT *
          FROM kids_shop_items
          WHERE id = $1
          `,
          [item_id]
        );

      if (
        !item.rows.length
      ) {

        return res.status(404)
        .json({

          success: false

        });

      }

      const shopItem =
        item.rows[0];

      const rewards =
        await pool.query(
          `
          SELECT coins
          FROM kids_rewards
WHERE child_id = $1
          `,
          [child_id]
        );

      const coins =
        Number(
          rewards.rows[0]?.coins || 0
        );

      if (
        coins <
        shopItem.item_price
      ) {

        return res.json({

          success: false,

          message:
            "Not enough coins"

        });

      }

      const existing =
        await pool.query(
          `
          SELECT id
          FROM kids_purchases
          WHERE child_id = $1
          AND item_id = $2
          `,
          [
            child_id,
            item_id
          ]
        );

      if (
        existing.rows.length
      ) {

        return res.json({

          success: false,

          message:
            "Already purchased"

        });

      }

      await pool.query(
        `
        INSERT INTO kids_purchases
        (child_id, item_id)
        VALUES ($1, $2)
        `,
        [
          child_id,
          item_id
        ]
      );

      await pool.query(
        `
        UPDATE kids_rewards
        SET coins =
          coins - $1
        WHERE child_id = $2
        `,
        [
  shopItem.item_price,
  child_id
]
      );

      return res.json({

        success: true

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500)
      .json({

        success: false

      });

    }

  }
);

// =====================================
// GET ACTIVE CUSTOMIZATION
// =====================================

router.get(
  "/active-items",

  verifyToken,

  async (req, res) => {

    try {

      const childId =
        parseInt(
          req.query.child_id,
          10
        );

      if (
        Number.isNaN(childId)
      ) {

        return res.status(400)
        .json({

          success:false,

          message:
            "Invalid child id"

        });

      }

      const result =
        await pool.query(
          `
          SELECT *

          FROM kids_active_items

          WHERE child_id = $1

          LIMIT 1
          `,
          [childId]
        );

      return res.json({

        success:true,

        active:

          result.rows[0] || null

      });

    }

    catch (err) {

      console.error(
        "ACTIVE ITEMS ERROR:",
        err
      );

      return res.status(500)
      .json({

        success:false,

        message:
          err.message

      });

    }

  }
);

// =====================================
// APPLY SHOP ITEM
// =====================================

router.post(
  "/apply-item",

  verifyToken,

  async (req, res) => {

    try {

      const userId =
        req.user.id;

      const {
  item_id,
  child_id
} = req.body;

      const item =
        await pool.query(
          `
          SELECT *
          FROM kids_shop_items
          WHERE id = $1
          `,
          [item_id]
        );

      if (
        !item.rows.length
      ) {

        return res.status(404)
        .json({

          success:false

        });

      }

      const shopItem =
        item.rows[0];

      const purchased =
        await pool.query(
          `
          SELECT id
          FROM kids_purchases
          WHERE child_id = $1
          AND item_id = $2
          `,
          [
  child_id,
  item_id
]
        );

      if (
        !purchased.rows.length
      ) {

        return res.json({

          success:false,

          message:
            "Purchase item first"

        });

      }

      let field =
        "active_theme";

      if (
        shopItem.item_type ===
        "avatar_frame"
      ) {

        field =
          "active_frame";

      }

      if (
        shopItem.item_type ===
        "pet"
      ) {

        field =
          "active_pet";

      }

if (
  shopItem.item_type ===
  "avatar_accessory"
) {
  field =
    "active_accessory";
}

await pool.query(
  `
  INSERT INTO kids_active_items
  (
    user_id,
    child_id,
    ${field}
  )

  VALUES
  (
    $1,
    $2,
    $3
  )

  ON CONFLICT (user_id)

  DO UPDATE SET

    child_id = $2,

    ${field} = $3,

    updated_at = NOW()
  `,
  [
    userId,
    child_id,
    shopItem.item_value
  ]
);

      return res.json({

        success:true

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500)
      .json({

        success:false

      });

    }

  }
);

// =====================================
// PARENT ANALYTICS
// =====================================

router.get(
  "/parent-analytics/:childId",

  verifyToken,

  async (req, res) => {

    try {

      const childId =
  parseInt(
    req.query.child_id,
    10
  );

if (
  Number.isNaN(childId)
) {

  return res.status(400)
  .json({

    success:false,

    message:
      "Invalid child id"

  });

}

      // TOTAL XP + COINS
      const rewards =
        await pool.query(
          `
          SELECT
            xp,
            coins
          FROM kids_rewards
WHERE child_id = $1
          `,
          [childId]
        );

      // LESSONS COMPLETED
      const lessons =
        await pool.query(
          `
          SELECT COUNT(*) AS total
          FROM kids_lesson_progress
          WHERE child_id = $1
          AND completed = true
          `,
          [childId]
        );

      // QUIZ ACCURACY
      const quizzes =
        await pool.query(
          `
          SELECT

            COUNT(*) AS total,

            SUM(
              CASE
                WHEN is_correct = true
                THEN 1
                ELSE 0
              END
            ) AS correct

          FROM kids_quiz_attempts

          WHERE child_id = $1
          `,
          [childId]
        );

      // WATCH TIME
      const watchTime =
        await pool.query(
          `
          SELECT
            SUM(watched_seconds)
            AS total_watch_time

          FROM kids_lesson_progress

          WHERE child_id = $1
          `,
          [childId]
        );

      // STREAK
      const streak =
        await pool.query(
          `
          SELECT streak_count
          FROM kids_daily_streaks
          WHERE child_id = $1
          `,
          [childId]
        );

      const totalQuiz =
        Number(
          quizzes.rows[0]
          ?.total || 0
        );

      const correctQuiz =
        Number(
          quizzes.rows[0]
          ?.correct || 0
        );

      let accuracy = 0;

      if (totalQuiz > 0) {

        accuracy =
          Math.round(
            (
              correctQuiz /
              totalQuiz
            ) * 100
          );

      }

      return res.json({

        success:true,

        analytics: {

          xp:
            rewards.rows[0]?.xp || 0,

          coins:
            rewards.rows[0]?.coins || 0,

          completedLessons:
            lessons.rows[0]?.total || 0,

          accuracy,

          streak:
            streak.rows[0]
            ?.streak_count || 0,

          watchTime:
            watchTime.rows[0]
            ?.total_watch_time || 0

        }

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500)
      .json({

        success:false

      });

    }

  }
);

// =====================================
// DAILY QUESTS
// =====================================

router.get(

  "/daily-quests",

  verifyToken,

  async (req, res) => {

    try {

const childId =
  parseInt(
    req.query.child_id,
    10
  );

if (
  Number.isNaN(childId)
) {

  return res.status(400)
  .json({

    success:false,

    message:
      "Invalid child id"

  });

}
      const result =
        await pool.query(
          `
          SELECT

            q.*,

            COALESCE(
              uq.progress_count,
              0
            ) AS progress_count,

            COALESCE(
              uq.completed,
              false
            ) AS completed,

            COALESCE(
              uq.claimed,
              false
            ) AS claimed

          FROM kids_daily_quests q

          LEFT JOIN
          kids_user_quests uq

          ON uq.quest_id = q.id

          AND uq.child_id = $1

          AND uq.created_date = CURRENT_DATE

          WHERE q.is_active = true

          ORDER BY q.id ASC
          `,
          [childId]
        );

      return res.json({

        success: true,

        quests:
          result.rows

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500)
      .json({

        success: false

      });

    }

  }
);

// =====================================
// CONTINUE WATCHING
// =====================================

router.get(

  "/continue-watching/:childId",

  verifyToken,

  async (req, res) => {

    try {

      const childId =
  parseInt(
    req.params.childId,
    10
  );

if (
  Number.isNaN(childId)
) {

  return res.status(400)
  .json({

    success:false,

    message:
      "Invalid child id"

  });

}

      const result =
        await pool.query(
          `
          SELECT

            lp.lesson_id,

            lp.watched_seconds,

            l.title
              AS lesson_title,

            l.video_file,

            c.id
              AS course_id,

            c.title
              AS course_title

          FROM kids_lesson_progress lp

          JOIN kids_lessons l

          ON l.id = lp.lesson_id

          JOIN kids_courses c

          ON c.id = l.course_id

          WHERE lp.child_id = $1

          ORDER BY lp.updated_at DESC

          LIMIT 1
          `,
          [childId]
        );

      return res.json({

        success: true,

        item:
          result.rows[0] || null

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500)
      .json({

        success:false

      });

    }

  }
);

// =====================================
// SMART RECOMMENDATIONS
// =====================================

router.get(

  "/recommended-courses",

  verifyToken,

  async (req, res) => {

    try {

      const childId =
  parseInt(
    req.query.child_id,
    10
  );

if (
  Number.isNaN(childId)
) {

  return res.status(400)
  .json({

    success:false,

    message:
      "Invalid child id"

  });

}

      const result =
        await pool.query(
          `
          SELECT

  c.id,
  c.title,
  c.thumbnail,

  COUNT(
    DISTINCT l.id
  )::int
  AS total_lessons,

  COUNT(
    DISTINCT CASE

      WHEN lp.completed = true

      THEN lp.lesson_id

    END
  )::int
  AS completed_lessons

FROM kids_courses c

LEFT JOIN kids_lessons l

ON l.course_id = c.id

LEFT JOIN kids_enrollments e

ON
e.course_id = c.id

AND e.child_id = $1

LEFT JOIN kids_lesson_progress lp

ON
lp.lesson_id = l.id

AND lp.child_id = $1

GROUP BY

  c.id,
  c.title,
  c.thumbnail

ORDER BY c.id DESC

LIMIT 6
          `,
          [childId]
        );

      return res.json({

        success: true,

        courses:
          result.rows

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500)
      .json({

        success:false

      });

    }

  }
);

// =====================================
// KIDS DASHBOARD
// =====================================

router.get(

  "/dashboard",

  verifyToken,

  async (req, res) => {

    try {

      const childId =
  parseInt(
    req.query.child_id,
    10
  );

if (
  Number.isNaN(childId)
) {

  return res.status(400)
  .json({

    success:false,

    message:
      "Invalid child id"

  });

}

      // CHILD
      const child =
        await pool.query(
          `
          SELECT *
          FROM kids_profiles
          WHERE id = $1
          `,
          [childId]
        );

if (
  child.rows.length === 0
) {

  return res.status(404)
  .json({

    success:false,

    message:
      "Child profile not found"

  });

}

      // REWARDS
      const rewards =
        await pool.query(
          `
          SELECT

  COALESCE(
    xp,
    0
  ) AS xp,

  COALESCE(
    coins,
    0
  ) AS coins

FROM kids_rewards

WHERE child_id = $1
          `,
          [childId]
        );

      // COURSES
      const coursesResult =
        await pool.query(
          `
          SELECT

  c.id AS course_id,

  c.title,

  c.subject,

  c.path,

  e.progress,

  e.completed_lessons,

  e.total_lessons,

  e.completed

FROM kids_enrollments e

JOIN kids_courses c

ON c.id = e.course_id

WHERE e.child_id = $1

ORDER BY e.id DESC
          `,
          [childId]
        );

      // BADGES
      const badges =
        await pool.query(
          `
          SELECT *
          FROM kids_badges
          WHERE child_id = $1
          ORDER BY earned_at DESC
          `,
          [childId]
        );

      // TODAY ACTIVITY
      const todayActivity =
{

  lessons_completed:
    await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM kids_lesson_progress
      WHERE
      child_id = $1
      AND completed = true
      `,
      [childId]
    ).then(
      r => r.rows[0].total
    ),

  quizzes_completed:
    await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM kids_quiz_attempts
      WHERE child_id = $1
      `,
      [childId]
    ).then(
      r => r.rows[0].total
    ),

  streak:
    await pool.query(
      `
      SELECT
        COALESCE(
          streak_count,
          0
        ) AS streak
      FROM kids_daily_streaks
      WHERE child_id = $1
      `,
      [childId]
    ).then(
      r => r.rows[0]?.streak || 0
    )

};

const rewardsResult =
  await pool.query(
    `
    SELECT

      COALESCE(
        xp,
        0
      ) AS xp,

      COALESCE(
        coins,
        0
      ) AS coins

    FROM kids_rewards

    WHERE child_id = $1
    `,
    [childId]
  );



      return res.json({

        success:true,

        child:
          child.rows[0],

        rewards:
          rewards.rows[0] || {

            xp:0,
            coins:0

          },



analytics: {

  my_courses:
    coursesResult.rows.length,

lessons_today:

  coursesResult.rows.reduce(

    (sum, course) =>

      sum +
      Number(
        course.completed_lessons || 0
      ),

    0

  ),

  quizzes_today:
    Number(
      todayActivity
      .quizzes_completed || 0
    ),

  coins_today:
    Number(
      rewardsResult.rows[0]
      ?.coins || 0
    ),

  total_xp:
    Number(
      rewardsResult.rows[0]
      ?.xp || 0
    ),

  total_coins:
    Number(
      rewardsResult.rows[0]
      ?.coins || 0
    )

},

        todayActivity,

        courses:
          coursesResult.rows,

        badges:
          badges.rows

      });

    }

    catch (err) {

  console.error(
    "KIDS DASHBOARD ERROR:",
    err
  );

  return res.status(500)
  .json({

    success:false,

    message:
      err.message,

    stack:
      err.stack

  });

}

  }
);

router.get(
  "/my-collection",
  verifyToken,
  async (req, res) => {

    try {

      const childId =
        parseInt(
          req.query.child_id,
          10
        );

      if (
        Number.isNaN(childId)
      ) {

        return res.status(400)
        .json({
          success:false
        });

      }

      const pets =
        await pool.query(
          `
          SELECT
            s.item_name
          FROM kids_purchases p
          JOIN kids_shop_items s
          ON s.id = p.item_id
          WHERE
            p.child_id = $1
            AND s.item_type = 'pet'
          `,
          [childId]
        );

      const frames =
        await pool.query(
          `
          SELECT
            s.item_name
          FROM kids_purchases p
          JOIN kids_shop_items s
          ON s.id = p.item_id
          WHERE
            p.child_id = $1
            AND s.item_type = 'avatar_frame'
          `,
          [childId]
        );

      const themes =
        await pool.query(
          `
          SELECT
            s.item_name
          FROM kids_purchases p
          JOIN kids_shop_items s
          ON s.id = p.item_id
          WHERE
            p.child_id = $1
            AND s.item_type = 'theme'
          `,
          [childId]
        );

      const badges =
        await pool.query(
          `
          SELECT
            badge_name
          FROM kids_badges
          WHERE child_id = $1
          ORDER BY earned_at DESC
          `,
          [childId]
        );

      return res.json({

        success:true,

        pets:
          pets.rows,

        frames:
          frames.rows,

        themes:
          themes.rows,

        badges:
          badges.rows

      });

    }

    catch(err) {

      console.error(
        "MY COLLECTION ERROR:",
        err
      );

      return res.status(500)
      .json({

        success:false

      });

    }

  }
);

async function updateDailyQuestProgress(

  child_id,
  type,
  amount = 1

) {

  try {

    const quests =
      await pool.query(
        `
        SELECT *

        FROM kids_daily_quests

        WHERE

  quest_type = $1

          AND is_active = true
        `,
        [type]
      );

    for (const quest of quests.rows) {

      const existing =
        await pool.query(
          `
          SELECT *

          FROM kids_user_quests

          WHERE

            child_id = $1

            AND quest_id = $2

            AND created_date = CURRENT_DATE
          `,
          [
            child_id,
            quest.id
          ]
        );

      let progress = amount;

      if (
        existing.rows.length
      ) {

        progress =

          Number(
            existing.rows[0]
            .progress_count || 0
          ) + amount;

      }

      const completed =

        progress >=
        quest.target_count;

      await pool.query(
        `
        INSERT INTO
        kids_user_quests
        (

          child_id,
          quest_id,
          progress_count,
          completed,
          claimed,
          created_date

        )

        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          false,
          CURRENT_DATE
        )

        ON CONFLICT
        (
          child_id,
          quest_id,
          created_date
        )

        DO UPDATE SET

          progress_count = $3,

          completed = $4
        `,
        [

          child_id,

          quest.id,

          progress,

          completed

        ]
      );

    }

  }

  catch (err) {

    console.error(
      "QUEST UPDATE ERROR:",
      err
    );

  }

}

router.post(

  "/claim-quest",

  verifyToken,

  async (req, res) => {

    try {

      const {

        child_id,
        quest_id

      } = req.body;

      const questResult =
        await pool.query(
          `
          SELECT *

          FROM kids_daily_quests

          WHERE id = $1
          `,
          [quest_id]
        );

      if (
        !questResult.rows.length
      ) {

        return res.status(404)
        .json({

          success:false

        });

      }

      const quest =
        questResult.rows[0];

      const progress =
        await pool.query(
          `
          SELECT *

          FROM kids_user_quests

          WHERE

            child_id = $1

            AND quest_id = $2

            AND created_date = CURRENT_DATE
          `,
          [
            child_id,
            quest_id
          ]
        );

      if (
        !progress.rows.length
      ) {

        return res.json({

          success:false,

          message:
            "Quest not started"

        });

      }

      const userQuest =
        progress.rows[0];

      if (
        userQuest.claimed
      ) {

        return res.json({

          success:false,

          message:
            "Already claimed"

        });

      }

      if (
        !userQuest.completed
      ) {

        return res.json({

          success:false,

          message:
            "Quest incomplete"

        });

      }

      await pool.query(
        `
        UPDATE kids_user_quests

        SET claimed = true

        WHERE id = $1
        `,
        [userQuest.id]
      );

      await pool.query(
        `
        INSERT INTO kids_rewards
        (

          child_id,
          xp,
          coins

        )

        VALUES
        (
          $1,
          $2,
          $3
        )

        ON CONFLICT (child_id)

        DO UPDATE SET

          xp =
            kids_rewards.xp + EXCLUDED.xp,

          coins =
            kids_rewards.coins + EXCLUDED.coins,

          updated_at = NOW()
        `,
        [

          child_id,

          quest.reward_xp,

          quest.reward_coins

        ]
      );

      return res.json({

        success:true,

        xp:
          quest.reward_xp,

        coins:
          quest.reward_coins

      });

    }

    catch (err) {

      console.error(err);

      return res.status(500)
      .json({

        success:false

      });

    }

  }
);


module.exports = router;