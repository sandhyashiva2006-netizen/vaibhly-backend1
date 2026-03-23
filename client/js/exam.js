console.log("📘 Exam.js loaded");

const token = localStorage.getItem("token");
const examId = localStorage.getItem("examId");

if (!token || !examId) {
  alert("Invalid exam session");
  window.location.href = "dashboard.html";
  throw new Error("Invalid exam");
}

let examDuration = 600; // 10 minutes
let timerInterval;

function startTimer() {
  const timerEl = document.getElementById("examTimer");
  if (!timerEl) return;

  timerInterval = setInterval(() => {
    const minutes = Math.floor(examDuration / 60);
    const seconds = examDuration % 60;

    timerEl.innerText =
      `Time Left: ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    examDuration--;

    if (examDuration < 0) {
      clearInterval(timerInterval);
      alert("⏰ Time's up! Submitting exam.");
      submitExam();
    }
  }, 1000);
}

let currentQuestionIndex = 0;
let examQuestions = [];
let selectedAnswers = {};

/* ================= LOAD EXAM ================= */
async function loadExam() {
  try {
    const res = await fetch(`http://localhost:5000/api/exams/${examId}/questions`, {
  headers: {
    Authorization: "Bearer " + localStorage.getItem("token")
  }
});

    const data = await res.json();

    if (!data.success || !data.questions?.length) {
      alert("No questions found");
      return;
    }

    examQuestions = data.questions;
    currentQuestionIndex = 0;

    renderQuestion();
startTimer();

  } catch (err) {
    console.error("❌ Load exam error:", err);
    alert("Failed to load exam");
  }
}

/* ================= RENDER QUESTION ================= */
function renderQuestion() {
  const container = document.getElementById("questionContainer");
  const navContainer = document.getElementById("questionNavigation");

  if (!examQuestions.length) {
    container.innerHTML = "<p>No questions available.</p>";
    return;
  }

  const question = examQuestions[currentQuestionIndex];

  container.innerHTML = `
    <h3>Question ${currentQuestionIndex + 1} of ${examQuestions.length}</h3>
    <p>${question.question}</p>
    ${question.options.map((opt, i) => `
      <label style="display:block; margin:8px 0;">
        <input type="radio"
          name="answer"
          value="${i}"
          ${selectedAnswers[question.id] === i ? "checked" : ""}
        />
        ${opt}
      </label>
    `).join("")}
  `;

  container.querySelectorAll("input[name='answer']").forEach(radio => {
    radio.addEventListener("change", (e) => {
      selectedAnswers[question.id] = Number(e.target.value);
    });
  });

  renderNavigation();
}

/* ================= NAVIGATION ================= */
function renderNavigation() {
  const nav = document.getElementById("questionNavigation");

  nav.innerHTML = `
    <button id="prevBtn" ${currentQuestionIndex === 0 ? "disabled" : ""}>
      ⬅ Previous
    </button>

    ${currentQuestionIndex === examQuestions.length - 1
      ? `<button id="submitBtn">✅ Submit Exam</button>`
      : `<button id="nextBtn">Next ➡</button>`}
  `;

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const submitBtn = document.getElementById("submitBtn");

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
      }
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentQuestionIndex < examQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
      }
    };
  }

  if (submitBtn) {
    submitBtn.onclick = submitExam;
  }
}

/* ================= SUBMIT ================= */
async function submitExam() {


  if (Object.keys(selectedAnswers).length < examQuestions.length) {
    alert("⚠ Please answer all questions before submitting.");
    return;
  }


  try {
    console.log("📤 Submitting:", {
      exam_id: Number(examId),
      answers: selectedAnswers
    });

    const res = await fetch("/api/exams/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        exam_id: Number(examId),   // ✅ use examId, NOT req
        answers: selectedAnswers
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.error || "Submission failed");
      return;
    }

    alert(
  `🎉 Exam Completed!\n\n` +
  `Score: ${data.percentage}%\n` +
  `Correct Answers: ${data.score}/${data.total}\n` +
  `Status: ${data.status}`
);

if (data.status === "PASSED") {

  if (!data.certificateId) {
    alert("Certificate not generated yet");
    window.location.href = "/dashboard.html";
    return;
  }

  window.location.href =
    "/certificate.html?id=" + data.certificateId;

} 

else {

  window.location.href = "/dashboard.html";

}

  } catch (err) {
    console.error("❌ Submit error:", err);
    alert("Exam submission failed");
  }
}


/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {
  loadExam();
});
