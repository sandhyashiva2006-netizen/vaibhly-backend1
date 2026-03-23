console.log("✅ dashboard.js loaded");

/* ================= AUTH ================= */
if (!window.token) {
  alert("Session expired");
  window.location.href = "/admin/admin-login.html";
}

/* ================= DOM ================= */
const examTableBody = document.getElementById("examTableBody");

/* ================= LOAD ANALYTICS ================= */
async function loadAnalytics() {
  try {
    const res = await fetch("/api/admin/analytics", {
      headers: {
        Authorization: "Bearer " + window.token
      }
    });

    if (!res.ok) throw new Error("Analytics API failed");

    const data = await res.json();
    console.log("📊 Admin Analytics:", data);

    document.getElementById("aStudents").innerText     = data.totalStudents;
    document.getElementById("aCourses").innerText      = data.totalCourses;
    document.getElementById("aExams").innerText        = data.totalExams;
    document.getElementById("aCertificates").innerText= data.totalCertificates;
    document.getElementById("aCompletion").innerText  = data.completionRate + "%";
    document.getElementById("aPassRate").innerText     = data.passRate + "%";

  } catch (err) {
    console.error("❌ Failed to load analytics", err);
  }
}

/* ================= LOAD EXAMS (ADMIN) ================= */
async function loadAdminExams() {
  try {
    console.log("📡 Loading admin exams...");

    const res = await fetch("/api/admin/exams-view", {
      headers: {
        Authorization: "Bearer " + window.token
      }
    });

    if (!res.ok) throw new Error("Admin exams API failed");

    const exams = await res.json();
    console.log("✅ Admin exams:", exams);

    examTableBody.innerHTML = "";

    if (!exams.length) {
      examTableBody.innerHTML =
        `<tr><td colspan="4">No exams found</td></tr>`;
      return;
    }

    exams.forEach(exam => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${exam.id}</td>
        <td>${exam.title}</td>
        <td>${exam.total_questions}</td>
        <td>${exam.active ? "✅ Active" : "❌ Inactive"}</td>
      `;

      examTableBody.appendChild(tr);
    });

  } catch (err) {
    console.error("❌ Failed to load admin exams", err);
    examTableBody.innerHTML =
      `<tr><td colspan="4">Failed to load exams</td></tr>`;
  }
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {
  loadAnalytics();
  loadAdminExams();
});
