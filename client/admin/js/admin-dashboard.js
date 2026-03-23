const token = localStorage.getItem("adminToken");

if (!token) {
  window.location.href = "login.html";
}

async function loadDashboard() {
  const res = await fetch("/api/admin/dashboard", {
    headers: {
      Authorization: "Bearer " + token
    }
  });

  if (!res.ok) {
    alert("Unauthorized");
    localStorage.removeItem("adminToken");
    window.location.href = "login.html";
    return;
  }

  const data = await res.json();

  document.getElementById("students").innerText = data.totalStudents;
  document.getElementById("courses").innerText = data.totalCourses;
  document.getElementById("exams").innerText = data.totalExams;
}

function logout() {
  localStorage.removeItem("adminToken");
  window.location.href = "login.html";
}

loadDashboard();
