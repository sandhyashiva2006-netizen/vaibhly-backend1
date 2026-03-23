console.log("✅ admin-exams.js loaded");

/* ================= AUTH ================= */
if (!window.token) {
  alert("Session expired");
  window.location.href = "/admin/admin-login.html";
}

/* ================= ELEMENTS ================= */
const courseSelect   = document.getElementById("courseSelect");
const examTableBody  = document.getElementById("examTableBody");
const createBtn      = document.getElementById("createExamBtn");
const examTitleInput = document.getElementById("examTitle");

/* ================= LOAD COURSES ================= */
async function loadCourses() {
  try {
    const res = await fetch("/api/courses", {
      headers: { Authorization: "Bearer " + window.token }
    });

    const courses = await res.json();
    courseSelect.innerHTML = `<option value="">-- Select Course --</option>`;

    courses.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.title;
      courseSelect.appendChild(opt);
    });

  } catch (err) {
    console.error("Load courses error:", err);
  }
}

/* ================= LOAD EXAMS ================= */
async function loadExams() {
  try {
    const res = await fetch("/api/admin/exams-view", {
      headers: { Authorization: "Bearer " + window.token }
    });

    if (!res.ok) throw new Error("API failed");

    const exams = await res.json();
    console.log("✅ Exams:", exams);

    examTableBody.innerHTML = "";

    if (!exams.length) {
      examTableBody.innerHTML =
        `<tr><td colspan="6">No exams found</td></tr>`;
      return;
    }

    exams.forEach((e, i) => {
      const tr = document.createElement("tr");

      const title = e.title || "-";
      const total = Number(e.total_questions || 0);
      const active = e.active === true;

      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${title}</td>
        <td>${total}</td>
        <td>
          <span class="${active ? "badge-green" : "badge-gray"}">
            ${active ? "ACTIVE" : "INACTIVE"}
          </span>
        </td>
        <td>
          <button onclick="toggleExam(${e.id})">🔁</button>
          <button class="danger-btn" onclick="deleteExam(${e.id})">🗑</button>
        </td>
      `;

      examTableBody.appendChild(tr);
    });

  } catch (err) {
    console.error("❌ Failed to load exams", err);
    examTableBody.innerHTML =
      `<tr><td colspan="6">Failed to load exams</td></tr>`;
  }
}

/* ================= CREATE EXAM ================= */
createBtn.onclick = async () => {
  const title    = examTitleInput.value.trim();
  const courseId = courseSelect.value;

  if (!courseId) return alert("Select course first");
  if (!title) return alert("Exam title required");

  try {
    const res = await fetch("/api/admin/exams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + window.token
      },
      body: JSON.stringify({ title, course_id: courseId })
    });

    if (!res.ok) throw new Error("Create failed");

    examTitleInput.value = "";
    loadExams();

  } catch (err) {
    alert("❌ Failed to create exam");
    console.error(err);
  }
};

document.getElementById("createExamBtn").addEventListener("click", async () => {

  const title = examTitleInput.value.trim();
  const courseId = courseSelect.value;

  if (!courseId) return alert("Select course first");
  if (!title) return alert("Exam title required");

  try {

    const res = await fetch("/api/admin/exams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + window.token
      },
      body: JSON.stringify({
        title,
        course_id: courseId
      })
    });

    if (!res.ok) throw new Error("Create failed");

    examTitleInput.value = "";

    loadExams();

  } catch (err) {
    console.error(err);
    alert("Failed to create exam");
  }

});

/* ================= DELETE ================= */
async function deleteExam(id) {
  if (!confirm("Delete this exam?")) return;

  try {
    const res = await fetch(`/api/admin/exams/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + window.token }
    });

    if (!res.ok) throw new Error("Delete failed");

    loadExams();

  } catch (err) {
    alert("❌ Delete failed");
    console.error(err);
  }
}

/* ================= TOGGLE ================= */
async function toggleExam(id) {
  if (!window.token) {
    alert("Session expired. Please login again.");
    window.location.href = "/admin/admin-login.html";
    return;
  }

  try {
    const res = await fetch(`/api/exams/${id}/toggle`, {

      method: "PATCH",
      headers: {
        Authorization: "Bearer " + window.token
      }
    });

    if (!res.ok) {
      const msg = await res.text();
      console.error("Toggle API error:", msg);
      throw new Error("Toggle failed");
    }

    loadExams();

  } catch (err) {
    alert("❌ Toggle failed");
    console.error(err);
  }
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {
  loadCourses();
  loadExams();
});
