console.log("✅ admin-lessons.js loaded");

/* ================= AUTH ================= */
const token = localStorage.getItem("token");
if (!token) {
  alert("Session expired");
  window.location.href = "/admin/admin-login.html";
}

fetch("/api/admin/analytics", {
  headers: { Authorization: "Bearer " + window.ADMIN_TOKEN }
});

/* ================= ELEMENTS ================= */
const courseSelect = document.getElementById("courseSelect");
const moduleSelect = document.getElementById("moduleSelect");
const lessonBody = document.getElementById("lessonTableBody");
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("lessonFile");

/* ================= LOAD COURSES ================= */
async function loadCourses() {
  try {
    const res = await fetch("/api/courses", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) throw new Error("Courses API failed");

    const courses = await res.json();

    courseSelect.innerHTML = `<option value="">-- Select Course --</option>`;

    courses.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.title;
      courseSelect.appendChild(opt);
    });

  } catch (err) {
    console.error("❌ Load courses error:", err);
    alert("Failed to load courses");
  }
}

/* ================= LOAD MODULES ================= */
async function loadModules(courseId) {
  if (!courseId) return;

  try {
    const res = await fetch(`/api/modules/course/${courseId}`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) throw new Error("Modules API failed");

    const modules = await res.json();

    moduleSelect.innerHTML = `<option value="">-- Select Module --</option>`;

    modules.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.title;
      moduleSelect.appendChild(opt);
    });

  } catch (err) {
    console.error("❌ Load modules error:", err);
    alert("Failed to load modules");
  }
}

/* ================= LOAD LESSONS ================= */
async function loadLessons(moduleId) {
  if (!moduleId) return;

  try {
    const res = await fetch(`/api/lessons/module/${moduleId}`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) throw new Error("Lessons API failed");

    const lessons = await res.json();
    lessonBody.innerHTML = "";

    if (!lessons.length) {
      lessonBody.innerHTML = `<tr><td colspan="5">No lessons yet</td></tr>`;
      return;
    }

    lessons.forEach((l, index) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${l.title}</td>
        <td>${l.content_type}</td>
        <td>${l.content_url || "-"}</td>
        <td>
          <button class="danger-btn" onclick="deleteLesson(${l.id})">🗑</button>
        </td>
      `;

      lessonBody.appendChild(row);
    });

  } catch (err) {
    console.error("❌ Load lessons error:", err);
    alert("Failed to load lessons");
  }
}

/* ================= UPLOAD FILE ================= */
uploadBtn.onclick = async () => {
  const file = fileInput.files[0];
  if (!file) return alert("Select a file first");

  const formData = new FormData();
  formData.append("file", file);

  try {
    uploadBtn.innerText = "Uploading...";

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData
    });

    if (!res.ok) throw new Error("Upload failed");

    const data = await res.json();
    document.getElementById("lessonUrl").value = data.url;
    alert("✅ File uploaded successfully");

  } catch (err) {
    console.error("❌ Upload failed:", err);
    alert("Upload failed");
  } finally {
    uploadBtn.innerText = "⬆ Upload File";
  }
};

/* ================= CREATE LESSON ================= */
document.getElementById("createLessonBtn").onclick = async () => {
  const moduleId = moduleSelect.value;
  const title = document.getElementById("lessonTitle").value.trim();
  const type = document.getElementById("lessonType").value;
  const url = document.getElementById("lessonUrl").value.trim();

  if (!moduleId) return alert("Select module");
  if (!title) return alert("Lesson title required");

  try {
    const res = await fetch("/api/lessons", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        module_id: moduleId,
        title,
        content_type: type,
        content_url: url
      })
    });

    if (!res.ok) throw new Error("Create failed");

    document.getElementById("lessonTitle").value = "";
    document.getElementById("lessonUrl").value = "";

    loadLessons(moduleId);

  } catch (err) {
    console.error("❌ Create lesson failed:", err);
    alert("Failed to create lesson");
  }
};

/* ================= DELETE LESSON ================= */
async function deleteLesson(id) {
  if (!confirm("Delete this lesson?")) return;

  try {
    const res = await fetch(`/api/lessons/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) throw new Error("Delete failed");

    loadLessons(moduleSelect.value);

  } catch (err) {
    console.error("❌ Delete failed:", err);
    alert("Failed to delete lesson");
  }
}

/* ================= EVENTS ================= */
courseSelect.onchange = () => loadModules(courseSelect.value);
moduleSelect.onchange = () => loadLessons(moduleSelect.value);

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", loadCourses);
