const aiService = require("../services/ai.service");

exports.askAI = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message required" });
    }

    const answer = await aiService.askAI(message);

    res.json({
      question: message,
      answer
    });

  } catch (err) {
    console.error("❌ AI CONTROLLER ERROR:", err.message);
    res.status(500).json({ error: "AI service failed" });
  }
};
