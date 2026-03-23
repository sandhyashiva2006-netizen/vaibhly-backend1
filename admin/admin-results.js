console.log("admin-results.js loaded");



if (!token) {
  window.location.href = "/admin/admin-login.html";
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
}

/* ================= LOGOUT ================= */
const logoutBtn = document.getElementById("adminLogout");
if (logoutBtn) {
  logoutBtn.onclick = () => {
    localStorage.clear();
    window.location.href = "/admin/admin-login.html";
  };
}

/* ================= LOAD SUMMARY ================= */
fetch("/api/admin/results/summary", {
  headers: { Authorization: "Bearer " + token }
})
  .then(res => res.json())
  .then(data => {
    document.getElementById("totalStudents").innerText = data.totalStudents;
    document.getElementById("totalExams").innerText = data.totalExams;
    document.getElementById("totalAttempts").innerText = data.totalAttempts;
    document.getElementById("avgScore").innerText = `${data.avgScore}%`;
  });

/* ================= LOAD EXAM RESULTS ================= */
fetch("/api/admin/results/exams", {
  headers: { Authorization: "Bearer " + token }
})
  .then(res => res.json())
  .then(rows => {
    const body = document.getElementById("examResultsBody");
    body.innerHTML = "";

    rows.forEach(r => {
      body.innerHTML += `
        <tr>
          <td>${r.exam}</td>
          <td>${r.attempts}</td>
          <td>${r.avg_score || 0}%</td>
          <td>${r.passed}</td>
          <td>${r.failed}</td>
        </tr>
      `;
    });
  });
