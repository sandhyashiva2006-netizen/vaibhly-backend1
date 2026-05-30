const express = require("express");
const router = express.Router();

const pool = require("../config/db");

const {
  verifyToken
} = require("../middleware/auth.middleware");

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

router.get(
  "/today",
  verifyToken,
  async (req, res) => {

    try {

      const childId =
        Number(req.query.child_id);

      const quizResult =
        await pool.query(
          `
          SELECT *
FROM kids_daily_quizzes
WHERE quiz_date <= CURRENT_DATE
ORDER BY quiz_date DESC
LIMIT 1
          `
        );

      if (
        !quizResult.rows.length
      ) {

        return res.json({
          success: false,
          message:
            "No daily quiz found"
        });

      }

      const quiz =
        quizResult.rows[0];

      const attempt =
        await pool.query(
          `
          SELECT id
FROM kids_daily_quiz_attempts
WHERE
  child_id = $1
  AND daily_quiz_id = $2
  AND DATE(attempted_at) = CURRENT_DATE
          `,
          [
            childId,
            quiz.id
          ]
        );

      return res.json({

        success: true,

        alreadyAttempted:
          attempt.rows.length > 0,

        quiz

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
  "/submit",
  verifyToken,
  async (req,res) => {

    try {

      const {
        child_id,
        quiz_id,
        answer
      } = req.body;

      const quizResult =
        await pool.query(
          `
          SELECT *
          FROM kids_daily_quizzes
          WHERE id = $1
          `,
          [quiz_id]
        );

      if (
        !quizResult.rows.length
      ) {

        return res.status(404).json({
          success:false
        });

      }

      const quiz =
        quizResult.rows[0];

      const correct =

  String(answer)
    .toUpperCase()
    .trim()

===

  String(
    quiz.correct_answer
  )
    .toUpperCase()
    .trim();

      const xp =
        correct
          ? quiz.xp_reward
          : 0;

      const coins =
        correct
          ? quiz.coin_reward
          : 0;

      const existingAttempt =
  await pool.query(
    `
    SELECT id
FROM kids_daily_quiz_attempts
WHERE
  child_id = $1
  AND daily_quiz_id = $2
  AND DATE(attempted_at) = CURRENT_DATE
    `,
    [
      child_id,
      quiz_id
    ]
  );

if (
  existingAttempt.rows.length
) {

  return res.json({

    success: false,

    message:
      "Quiz already completed"

  });

}

await pool.query(
  `
  INSERT INTO
  kids_daily_quiz_attempts
  (
    child_id,
    daily_quiz_id,
    selected_answer,
    is_correct,
    xp_earned,
    coins_earned
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
    quiz_id,
    answer,
    correct,
    xp,
    coins
  ]
);

if (correct) {

  await updateDailyQuestProgress(
    child_id,
    "quiz_answer",
    1
  );

}

if (correct) {

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
        kids_rewards.xp +
        EXCLUDED.xp,

      coins =
        kids_rewards.coins +
        EXCLUDED.coins,

      updated_at = NOW()
    `,
    [
      child_id,
      xp,
      coins
    ]
  );

}

await updateWeeklyChallengeProgress(
  child_id,
  "quiz",
  1
);

await updateWeeklyChallengeProgress(
  child_id,
  "xp",
  xp
);

await checkAndUnlockBadges(
  child_id
);

      await pool.query(
        `
        INSERT INTO kids_daily_activity
        (
          child_id,
          activity_date,
          lessons_completed,
          quizzes_completed,
          coins_earned
        )

        VALUES
        (
          $1,
          CURRENT_DATE,
          0,
          1,
          $2
        )

        ON CONFLICT
        (
          child_id,
          activity_date
        )

        DO UPDATE SET

          quizzes_completed =
            kids_daily_activity
            .quizzes_completed + 1,

          coins_earned =
            kids_daily_activity
            .coins_earned + $2
        `,
        [
          child_id,
          coins
        ]
      );

      return res.json({

        success:true,

        correct,

        xp,

        coins

      });

    }

    catch(err) {

      console.error(err);

      return res.status(500).json({
        success:false
      });

    }

  }
);

module.exports = router;