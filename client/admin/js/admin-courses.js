const token = localStorage.getItem("adminToken");

if (!token) {
  window.location.href = "login.html";
}

/* ================= LOAD COURSES ================= */
async function loadCourses() {
  const res = await fetch("/api/courses", {
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const courses = await res.json();
  const table = document.getElementById("courseTable");
  table.innerHTML = "";

  courses.forEach(c => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${c.id}</td>
      <td>${c.title}</td>
      <td>
        <button onclick="deleteCourse(${c.id})">Delete</button>
      </td>
    `;
    table.appendChild(row);
  });
}

/* ================= ADD COURSE ================= */
async function addCourse() {
  const title = document.getElementById("title").value;
  const description = document.getElementById("description").value;

  if (!title) {
    alert("Title required");
    return;
  }

  const res = await fetch("/api/courses/admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ title, description })
  });

  if (!res.ok) {
    alert("Failed to add course");
    return;
  }

  document.getElementById("title").value = "";
  document.getElementById("description").value = "";

  loadCourses();
}

/* ================= DELETE COURSE ================= */
async function deleteCourse(id) {
  if (!confirm("Delete this course?")) return;

  const res = await fetch(`/api/courses/admin/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + token
    }
  });

  if (!res.ok) {
    alert("Delete failed");
    return;
  }

  loadCourses();
}

loadCourses();
