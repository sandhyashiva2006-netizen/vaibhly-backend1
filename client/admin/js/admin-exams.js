const token = localStorage.getItem("adminToken");
if (!token) window.location.href = "login.html";

/* ================= LOAD EXAMS ================= */
async function loadExams() {
  const res = await fetch("/api/exams", {
    headers: { Authorization: "Bearer " + token }
  });

  const exams = await res.json();
  const select = document.getElementById("examSelect");
  select.innerHTML = `<option value="">Select Exam</option>`;

  exams.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = `${e.title} (Course ${e.course_id})`;
    select.appendChild(opt);
  });
}

/* ================= ADD EXAM ================= */
async function addExam() {
  const title = document.getElementById("examTitle").value;
  const course_id = document.getElementById("courseId").value;

  const res = await fetch("/api/exams/admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ title, course_id })
  });

  if (!res.ok) return alert("Failed to create exam");

  document.getElementById("examTitle").value = "";
  document.getElementById("courseId").value = "";
  loadExams();
}

/* ================= LOAD QUESTIONS ================= */
async function loadQuestions() {
  const examId = document.getElementById("examSelect").value;
  if (!examId) return;

  const res = await fetch(`/api/exams/${examId}/questions`, {
    headers: { Authorization: "Bearer " + token }
  });

  const questions = await res.json();
  const list = document.getElementById("questionList");
  list.innerHTML = "";

  questions.forEach(q => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${q.question}
      <button onclick="deleteQuestion(${q.id})">Delete</button>
    `;
    list.appendChild(li);
  });
}

/* ================= ADD QUESTION ================= */
async function addQuestion() {
  const exam_id = document.getElementById("examSelect").value;

  const body = {
    exam_id,
    question: question.value,
    option_a: a.value,
    option_b: b.value,
    option_c: c.value,
    option_d: d.value,
    correct_option: correct.value
  };

  const res = await fetch("/api/exams/admin/question", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) return alert("Failed to add question");

  question.value = a.value = b.value = c.value = d.value = "";
  loadQuestions();
}

/* ================= DELETE QUESTION ================= */
async function deleteQuestion(id) {
  const res = await fetch(`/api/exams/admin/question/${id}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token }
  });

  if (!res.ok) return alert("Delete failed");
  loadQuestions();
}

loadExams();
