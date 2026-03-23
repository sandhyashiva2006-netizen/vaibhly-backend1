const express = require("express");
const router = express.Router();
const OpenAI = require("openai");
const { verifyToken } = require("../middleware/auth.middleware");
console.log("🔑 OPENAI KEY EXISTS:", !!process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * TEMPORARY PLACEHOLDER QUIZ ROUTE
 * (AI billing will be added later)
 */
router.post("/quiz", verifyToken, async (req, res) => {
  return res.json({
    questions: [
      {
        question: "AI quiz will be available once billing is enabled.",
        options: [
          "Enable billing to activate",
          "This is a placeholder",
          "Quiz generation is ready",
          "All of the above"
        ],
        correct_answer: "All of the above"
      }
    ]
  });
});



module.exports = router;
