console.log("✅ admin-modules.js loaded");

/* ================= AUTH GUARD ================= */
if (!requireAdmin()) {
  alert("Access denied");
  window.location.href = "/admin/admin-login.html";
}

/* ================= ELEMENTS ================= */
const courseSelect = document.getElementById("courseSelect");
const modulesBody  = document.getElementById("modulesTableBody");
const createBtn    = document.getElementById("createModuleBtn");
const titleInput   = document.getElementById("moduleTitle");
const logoutBtn    = document.getElementById("adminLogout");

/* ================= LOGOUT ================= */
if (logoutBtn) {
  logoutBtn.onclick = () => {
    localStorage.clear();
    window.location.href = "/admin/admin-login.html";
  };
}

/* ================= LOAD COURSES ================= */
async function loadCourses() {
  try {
    console.log("📡 Loading courses...");

    const res = await fetch("/api/courses", {
      headers: { Authorization: "Bearer " + window.token }
    });

    if (!res.ok) throw new Error("Courses API failed");

    const courses = await res.json();
    console.log("✅ Courses received:", courses);

    courseSelect.innerHTML =
      `<option value="">-- Select Course --</option>`;

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
  if (!courseId) {
    modulesBody.innerHTML =
      `<tr><td colspan="3">Select a course</td></tr>`;
    return;
  }

  try {
    console.log("📡 Loading modules for course:", courseId);

    const res = await fetch(`/api/modules/course/${courseId}`, {
      headers: { Authorization: "Bearer " + window.token }
    });

    if (!res.ok) throw new Error("Modules API failed");

    const modules = await res.json();
    console.log("✅ Modules received:", modules);

    modulesBody.innerHTML = "";

    if (!modules.length) {
      modulesBody.innerHTML =
        `<tr><td colspan="3">No modules yet</td></tr>`;
      return;
    }

    modules.forEach((m, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${m.title}</td>
        <td>
          <button class="btn-danger" onclick="deleteModule(${m.id})">
            Delete
          </button>
        </td>
      `;
      modulesBody.appendChild(tr);
    });

  } catch (err) {
    console.error("❌ Load modules error:", err);
    modulesBody.innerHTML =
      `<tr><td colspan="3">Failed to load modules</td></tr>`;
  }
}

/* ================= CREATE MODULE ================= */
createBtn.onclick = async () => {
  const title = titleInput.value.trim();
  const courseId = courseSelect.value;

  if (!courseId) return alert("Select a course first");
  if (!title) return alert("Module title required");

  try {
    const res = await fetch("/api/modules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + window.token
      },
      body: JSON.stringify({ title, course_id: courseId })
    });

    if (!res.ok) throw new Error("Create failed");

    titleInput.value = "";
    loadModules(courseId);

  } catch (err) {
    console.error("❌ Create module failed:", err);
    alert("Failed to create module");
  }
};

/* ================= DELETE MODULE ================= */
async function deleteModule(id) {
  if (!confirm("Delete this module?")) return;

  try {
    const res = await fetch(`/api/modules/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + window.token }
    });

    if (!res.ok) throw new Error("Delete failed");

    loadModules(courseSelect.value);

  } catch (err) {
    console.error("❌ Delete module failed:", err);
    alert("Failed to delete module");
  }
}

/* ================= EVENTS ================= */
courseSelect.onchange = () => {
  loadModules(courseSelect.value);
};

/* ================= INIT ================= */
loadCourses();
