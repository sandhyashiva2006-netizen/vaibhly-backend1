const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// server/services/ai.service.js

async function askAI(question) {
  console.log("🤖 MOCK AI QUESTION:", question);

  const q = question.toLowerCase();

  // Simple intelligent matching
  if (q.includes("javascript")) {
    return "JavaScript is a programming language used to create interactive websites like forms, animations, buttons, and dynamic content.";
  }

  if (q.includes("html")) {
    return "HTML is the structure of a webpage. It defines headings, text, images, and layout of a website.";
  }

  if (q.includes("css")) {
    return "CSS is used to style websites — colors, fonts, layouts, animations, and responsiveness.";
  }

  if (q.includes("react")) {
    return "React is a JavaScript library used to build fast and interactive user interfaces.";
  }

  if (q.includes("node")) {
    return "Node.js allows JavaScript to run on the server to build APIs and backend services.";
  }

  if (q.includes("course")) {
    return "You can complete lessons, track progress, attempt exams, and download certificates once you pass.";
  }

  // Default fallback response
  return "Great question! Your AI tutor is active. Real AI will be enabled soon. For now, please ask about JavaScript, HTML, CSS, React, or Node.";
}

module.exports = { askAI };


module.exports = { askAI };
