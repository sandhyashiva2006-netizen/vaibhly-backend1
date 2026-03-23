console.log("✅ admin-courses.js loaded");

const token = localStorage.getItem("token");
if (!token) {
  alert("Session expired");
  window.location.href = "/admin/admin-login.html";
}

const tableBody = document.getElementById("coursesTableBody");
const createBtn = document.getElementById("createCourseBtn");
const saveBtn = document.getElementById("saveCourseBtn");
const form = document.getElementById("createCourseForm");

/* ================= LOAD COURSES ================= */
async function loadCourses() {
  if (!tableBody) {
    console.error("❌ coursesTableBody not found in HTML");
    return;
  }

  try {
    console.log("📡 Loading courses...");

    const res = await fetch("/api/courses", {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    console.log("Courses API status:", res.status);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    const courses = await res.json();
    console.log("Courses received:", courses);

    tableBody.innerHTML = "";

    if (!Array.isArray(courses) || courses.length === 0) {
      tableBody.innerHTML =
        `<tr><td colspan="4">No courses found</td></tr>`;
      return;
    }

    courses.forEach((course, index) => {
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${index + 1}</td>
    <td>${course.title}</td>
    <td>${course.description || "-"}</td>
    <td>
      <button class="danger-btn" onclick="deleteCourse(${course.id})">
        🗑 Delete
      </button>
    </td>
  `;

  tableBody.appendChild(row);
});


  } catch (err) {
    console.error("❌ Failed to load courses", err);
    tableBody.innerHTML =
      `<tr><td colspan="4">❌ Failed to load courses</td></tr>`;
  }
}

/* ================= CREATE COURSE ================= */
createBtn.onclick = () => {
  form.style.display = "block";
};

saveBtn.onclick = async () => {
  const title = document.getElementById("courseTitle").value.trim();
  const description = document.getElementById("courseDescription").value.trim();

  if (!title) {
    alert("Course title required");
    return;
  }

  try {
    console.log("📝 Creating course:", { title, description });

    const res = await fetch("/api/courses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ title, description })
    });

    console.log("Create status:", res.status);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    alert("✅ Course created");

    document.getElementById("courseTitle").value = "";
    document.getElementById("courseDescription").value = "";
    form.style.display = "none";

    loadCourses();

  } catch (err) {
    console.error("❌ Create failed:", err);
    alert("❌ Failed to create course");
  }
};

/* ================= DELETE COURSE ================= */
async function deleteCourse(courseId) {
  if (!confirm("Are you sure you want to delete this course?")) return;

  try {
    const res = await fetch(`/api/courses/${courseId}`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + token
      }
    });

    if (!res.ok) throw new Error("Delete failed");

    alert("✅ Course deleted");
    loadCourses();

  } catch (err) {
    console.error("Delete error:", err);
    alert("❌ Failed to delete course");
  }
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", loadCourses);
