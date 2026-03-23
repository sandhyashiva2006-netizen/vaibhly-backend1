const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/login.html";
}

const card = document.getElementById("summaryCard");

async function loadSummary() {
  try {
    // 🔹 Get latest exam result
    const resultRes = await fetch("/api/exams/results", {
      headers: { Authorization: "Bearer " + token }
    });
    const results = await resultRes.json();
    const latest = results[0];

    // 🔹 Get certificate
    const certRes = await fetch("/api/certificates/latest", {
      headers: { Authorization: "Bearer " + token }
    });
    const cert = await certRes.json();

    card.innerHTML = `
      <div style="padding:20px;border:1px solid #ddd;border-radius:12px;">
        <h3>📘 Course: ${cert.course_name || "-"}</h3>
        <p>📝 Exam: ${latest.exam_name}</p>
        <p>🎯 Score: ${latest.score} / ${latest.total_questions}</p>
        <p>🏆 Status: ${latest.status}</p>
        <p>🆔 Certificate ID: ${cert.certificate_id}</p>
      </div>
    `;

  } catch (err) {
    console.error("Summary load error:", err);
    card.innerHTML = "❌ Failed to load summary";
  }
}

function downloadCert() {
  window.open(`/api/certificates/download/${document.querySelector("p:last-child").innerText.split(":")[1].trim()}`);
}

function goDashboard() {
  window.location.href = "/dashboard.html";
}

loadSummary();
