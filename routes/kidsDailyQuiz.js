const express = require("express");
const router = express.Router();

const pool = require("../config/db");

const {
  verifyToken
} = require("../middleware/auth.middleware");



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
          WHERE quiz_date = CURRENT_DATE
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

        await pool.query(
          `
          UPDATE kids_rewards
          SET

            xp =
              COALESCE(xp,0)+$1,

            coins =
              COALESCE(coins,0)+$2

          WHERE child_id = $3
          `,
          [
            xp,
            coins,
            child_id
          ]
        );

      }

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