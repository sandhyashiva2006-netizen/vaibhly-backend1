console.log("admin-questions.js loaded");




  /* ================= ADMIN AUTH ================= */
document.addEventListener("DOMContentLoaded", () => {
  if (!token) {
    window.location.href = "/admin/admin-login.html";
    return;
  }

  function parseJwtSafe(token) {
    try {
      return JSON.parse(atob(token.split(".")[1]));
    } catch {
      return null;
    }
  }

  const user = parseJwtSafe(token);

  if (!user || user.role !== "admin") {
    localStorage.clear();
    window.location.href = "/admin/admin-login.html";
    return;
  }

  /* ================= ELEMENTS ================= */
  const examSelect = document.getElementById("examSelect");
  const questionsBody = document.getElementById("questionsBody");
  const logoutBtn = document.getElementById("adminLogout");

  if (!examSelect || !questionsBody) {
    console.error("Required DOM elements not found");
    return;
  }

  /* ================= LOGOUT ================= */
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.clear();
      window.location.href = "/admin/admin-login.html";
    };
  }

  /* ================= LOAD EXAMS ================= */
  fetch("/api/admin/exams-view", {
    headers: { Authorization: "Bearer " + token }
  })
    .then(res => {
      if (!res.ok) throw new Error("Failed to load exams");
      return res.json();
    })
    .then(exams => {
      examSelect.innerHTML = `<option value="">-- Select Exam --</option>`;

      exams.forEach(e => {
        const opt = document.createElement("option");
        opt.value = e.id;
        opt.textContent = e.title;
        examSelect.appendChild(opt);
      });
    })
    .catch(err => {
      console.error("Exam load error:", err);
    });

  /* ================= LOAD QUESTIONS ================= */
  examSelect.addEventListener("change", () => {
    const examId = examSelect.value;

    if (!examId) {
      questionsBody.innerHTML =
        `<tr><td colspan="3">Select an exam</td></tr>`;
      return;
    }

    questionsBody.innerHTML =
      `<tr><td colspan="3">Loading…</td></tr>`;

    fetch(`/api/admin/questions/${examId}`, {
      headers: { Authorization: "Bearer " + token }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to load questions");
        return res.json();
      })
      .then(questions => {
        questionsBody.innerHTML = "";

        if (!questions.length) {
          questionsBody.innerHTML =
            `<tr><td colspan="3">No questions found</td></tr>`;
          return;
        }

       questions.forEach(q => {
  questionsBody.innerHTML += `
    <tr>
      <td>${q.id}</td>
      <td>${q.question}</td>
      <td>${q.correct_option}</td>
      <td>
  <button class="edit-btn" onclick="editQuestion(${q.id})">Edit</button>
  <button class="danger-btn" onclick="deleteQuestion(${q.id})">Delete</button>
</td>
    </tr>
  `;
});

      })
      .catch(err => {
        console.error("Question load error:", err);
        questionsBody.innerHTML =
          `<tr><td colspan="3">Error loading questions</td></tr>`;
      });
  });

});

/* ================= ADD QUESTION ================= */
document.getElementById("addQuestionBtn").onclick = async () => {
  const examId = parseInt(document.getElementById("examSelect").value, 10);
  const question = document.getElementById("questionText").value.trim();
  const option_a = document.getElementById("optA").value.trim();
  const option_b = document.getElementById("optB").value.trim();
  const option_c = document.getElementById("optC").value.trim();
  const option_d = document.getElementById("optD").value.trim();
  const correct_option = document.getElementById("correctOpt").value;
  const msg = document.getElementById("formMsg");

  msg.innerText = "";

  if (!examId || !question || !option_a || !option_b || !option_c || !option_d || !correct_option) {
    msg.innerText = "All fields required";
    msg.style.color = "red";
    return;
  }

  const res = await fetch("/api/admin/questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      exam_id: examId,
      question,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option
    })
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.error || "Failed to add question";
    msg.style.color = "red";
    return;
  }

 msg.innerText = "Question added successfully";
msg.style.color = "green";

/* ===== INSTANTLY ADD TO TABLE (NO RE-FETCH) ===== */
const questionsBody = document.getElementById("questionsBody");

questionsBody.innerHTML += `
  <tr>
    <td>NEW</td>
    <td>${question}</td>
    <td>${correct_option}</td>
  </tr>
`;


  // Clear form
  document.getElementById("questionText").value = "";
  document.getElementById("optA").value = "";
  document.getElementById("optB").value = "";
  document.getElementById("optC").value = "";
  document.getElementById("optD").value = "";
  document.getElementById("correctOpt").value = "";

  // Reload questions
  // Reload questions (FORCE)
const examSelect = document.getElementById("examSelect");
const selectedExam = examSelect.value;

// Force refresh even if same exam selected
examSelect.value = "";
setTimeout(() => {
  examSelect.value = selectedExam;
  examSelect.dispatchEvent(new Event("change"));
}, 0);

};

/* ================= DELETE QUESTION ================= */
async function deleteQuestion(questionId) {
  if (!confirm("Are you sure you want to delete this question?")) return;

  const res = await fetch(`/api/admin/questions/${questionId}`, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Failed to delete question");
    return;
  }

  alert("Question deleted");

  // Refresh list
  document.getElementById("examSelect").dispatchEvent(new Event("change"));
}

/* ================= EDIT QUESTION ================= */
function editQuestion(id) {
  fetch(`/api/admin/questions/single/${id}`, {
    headers: { Authorization: "Bearer " + token }
  })
    .then(res => res.json())
    .then(q => {
      document.getElementById("editForm").style.display = "block";
      document.getElementById("editId").value = q.id;
      document.getElementById("editQuestion").value = q.question;
      document.getElementById("editA").value = q.option_a;
      document.getElementById("editB").value = q.option_b;
      document.getElementById("editC").value = q.option_c;
      document.getElementById("editD").value = q.option_d;
      document.getElementById("editCorrect").value = q.correct_option;
    });
}

document.getElementById("updateQuestionBtn").onclick = async () => {
  const id = document.getElementById("editId").value;

  const res = await fetch(`/api/admin/questions/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      question: document.getElementById("editQuestion").value,
      option_a: document.getElementById("editA").value,
      option_b: document.getElementById("editB").value,
      option_c: document.getElementById("editC").value,
      option_d: document.getElementById("editD").value,
      correct_option: document.getElementById("editCorrect").value
    })
  });

  if (!res.ok) {
    alert("Update failed");
    return;
  }

  alert("Question updated");
  document.getElementById("editForm").style.display = "none";

  document.getElementById("examSelect").dispatchEvent(new Event("change"));
};

function cancelEdit() {
  document.getElementById("editForm").style.display = "none";
}
