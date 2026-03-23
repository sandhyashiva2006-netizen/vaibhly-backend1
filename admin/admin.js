window.token = localStorage.getItem("token");
window.role  = (localStorage.getItem("role") || "").toLowerCase();

console.log("admin.js loaded");

fetch("/api/admin/analytics", {
  headers: { Authorization: "Bearer " + window.token }
});


const payload = JSON.parse(atob(token.split(".")[1]));

if (payload.role !== "admin") {
  localStorage.clear();
  window.location.href = "/admin/admin-login.html";
  throw new Error("Not admin");
}


  
  /* ---------- ADMIN EXAMS VIEW ---------- */
  fetch("/api/admin/exams-view", {
    headers: { Authorization: "Bearer " + window.token }
  })
    .then(res => {
      console.log("Exams API status:", res.status);
      if (!res.ok) throw new Error("API failed");
      return res.json();
    })
    .then(exams => {
      console.log("Exams received:", exams);

      const body = document.getElementById("examTableBody");
      if (!body) {
        console.error("examTableBody not found in DOM");
        return;
      }

      body.innerHTML = "";

      if (!exams.length) {
        body.innerHTML = `<tr><td colspan="4">No exams found</td></tr>`;
        return;
      }

      exams.forEach(exam => {
        body.innerHTML += `
          <tr>
            <td>${exam.id}</td>
            <td>${exam.title}</td>
            <td>${exam.total_questions}</td>
            <td>${exam.active ? "Active" : "Inactive"}</td>
          </tr>
        `;
      });
    })
    .catch(err => {
      console.error("Admin exams fetch error:", err);
    });



async function loadAdminAnalytics() {
  try {
    const res = await fetch("/api/admin/analytics", {
      headers: { Authorization: "Bearer " + window.token }
    });

    if (!res.ok) throw new Error("Analytics API failed");

    const data = await res.json();
    console.log("📊 Admin Analytics:", data);

    document.getElementById("aStudents").innerText = data.totalStudents;
    document.getElementById("aCourses").innerText = data.totalCourses;
    document.getElementById("aExams").innerText = data.totalExams;
    document.getElementById("aCertificates").innerText = data.totalCertificates;
    document.getElementById("aCompletion").innerText = data.completionRate + "%";
    document.getElementById("aPassRate").innerText = data.passRate + "%";

  } catch (err) {
    console.error("❌ Failed to load admin analytics", err);
  }
}

function logout() {
  localStorage.clear();
  window.location.replace("/admin/admin-login.html");
}

loadAdminAnalytics();

