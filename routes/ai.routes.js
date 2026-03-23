const express = require("express");
const router = express.Router();
const OpenAI = require("openai");
const { verifyToken } = require("../middleware/auth.middleware");

console.log("🔑 OPENAI KEY EXISTS:", !!process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ================= MOCK AI ================= */
function improveText(text) {
  if (!text || text.trim().length < 3) {
    return "Professional content will appear here once details are added.";
  }

  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^\w|\.\s+\w)/g, m => m.toUpperCase()) +
    " Demonstrated strong ownership, impact, and professional execution.";
}

router.post("/ask", verifyToken, async (req, res) => {
  try {
    console.log("🔑 OPENAI_API_KEY:", process.env.OPENAI_API_KEY);
console.log("📦 OpenAI client:", typeof openai);


    const { message, context } = req.body;


    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are EduNexa AI Tutor." },
        { role: "user", content: context + "\n\nQuestion: " + message }
      ]
    });

    return res.json({
      reply: completion.choices[0].message.content
    });

  } catch (err) {
  if (err.status === 429) {
    return res.json({
      reply: "⚠️ AI usage limit reached. Please try again later."
    });
  }

  return res.status(500).json({
    reply: "AI service temporarily unavailable."
  });
}


});

module.exports = router;
