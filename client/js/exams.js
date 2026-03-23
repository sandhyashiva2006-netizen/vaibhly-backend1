console.log("exam.js loaded");

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const examId = localStorage.getItem("examId");

  console.log("Token:", token);
  console.log("Exam ID:", examId);

  if (!token || !examId) {
    alert("Session expired. Please start exam again.");
    window.location.href = "dashboard.html";
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:5000/api/exams/${examId}/questions`,
      {
        headers: {
          Authorization: "Bearer " + token
        }
      }
    );

    if (!response.ok) {
      throw new Error("Failed to load questions");
    }

    const questions = await response.json();
    console.log("Questions received:", questions);

    const container = document.getElementById("questionBox");
    container.innerHTML = "";

    questions.forEach((q, index) => {
      container.innerHTML += `
        <div>
          <p><b>${index + 1}. ${q.question}</b></p>
          <label><input type="radio" name="q${q.id}" value="A"> ${q.option_a}</label><br>
          <label><input type="radio" name="q${q.id}" value="B"> ${q.option_b}</label><br>
          <label><input type="radio" name="q${q.id}" value="C"> ${q.option_c}</label><br>
          <label><input type="radio" name="q${q.id}" value="D"> ${q.option_d}</label><br>
        </div><hr>
      `;
    });

  } catch (err) {
    console.error("Error loading exam:", err);
    alert("Unable to load questions");
  }
});

function submitExam() {
  alert("Submit logic will be added next");
}