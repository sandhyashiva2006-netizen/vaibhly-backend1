const box = document.getElementById("resultBox");

async function verify() {
  const id = document.getElementById("certInput").value.trim();

  if (!id) return alert("Enter certificate ID");

  box.innerHTML = "🔍 Verifying...";

  try {
    const res = await fetch(`/api/certificates/verify/${id}`);
    const data = await res.json();

    if (!res.ok || !data.valid) {
      box.innerHTML = `
        <div class="result-card result-error">
          <div class="result-title">❌ Invalid Certificate</div>
          <p>This certificate ID does not exist or is revoked.</p>
        </div>
      `;
      return;
    }

    const cert = data.certificate;

    box.innerHTML = `
      <div class="result-card result-success">
        <div class="result-title">✅ Certificate Verified</div>
        <p><b>Student:</b> ${cert.student_name}</p>
        <p><b>Exam:</b> ${cert.exam_name}</p>
        <p><b>Score:</b> ${Math.round((cert.score / cert.total_questions) * 100)}%</p>
        <p><b>Issued:</b> ${new Date(cert.attempted_at).toLocaleDateString()}</p>
        <p><b>Certificate ID:</b> ${cert.certificate_id}</p>
      </div>
    `;

  } catch (err) {
    console.error(err);
    box.innerHTML = `
      <div class="result-card result-error">
        <div class="result-title">❌ Server Error</div>
        <p>Unable to verify certificate at the moment.</p>
      </div>
    `;
  }
}
