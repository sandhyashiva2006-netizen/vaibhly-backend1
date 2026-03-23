console.log("🎓 certificate.js loaded");

const params = new URLSearchParams(window.location.search);
let certificateId = params.get("id");
const token = localStorage.getItem("token");

/* ================= DOM ELEMENTS ================= */
const studentNameEl = document.getElementById("studentName");
const examNameEl    = document.getElementById("examName");
const courseNameEl  = document.getElementById("courseName");
const scoreTextEl   = document.getElementById("scoreText");
const certIdEl      = document.getElementById("certId");
const qrBox         = document.getElementById("qr");

/* ================= SAFE FETCH ================= */
async function safeFetch(url) {
  const res = await fetch(url, {
    headers: token ? { Authorization: "Bearer " + token } : {}
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Request failed");
  }

  return res.json();
}

/* ================= LOAD CERTIFICATE ================= */
async function loadCertificate() {

  try {

    let cert = null;

    /* ===== If ID present → verify API ===== */
    if (certificateId) {

      const data = await safeFetch(`/api/certificates/verify/${certificateId}`);

if (!data.valid || !data.certificate) {

  console.warn("Certificate not found for:", certificateId);

  // fallback → load latest certificate instead
  const latest = await safeFetch(`/api/certificates/latest`);

  cert = latest;
  certificateId = cert.certificate_id;

} else {

  cert = data.certificate;

}

    }

    /* ===== Otherwise → latest certificate ===== */
    else {

      const data = await safeFetch(`/api/certificates/latest`);
      cert = data;
      certificateId = cert.certificate_id;

    }

   /* ===== Fill certificate fields ===== */

document.getElementById("studentName").innerText =
  cert.student_name || "";

document.getElementById("certId").innerText =
  cert.certificate_id || "";

/* ===== Certificate wording ===== */

// 🔥 PRIORITIZE COURSE NAME FIRST

if (cert.course_title) {

  const certTextEl = document.getElementById("certificateText");
const certTitleEl = document.getElementById("certificateTitle");

// 🔥 PRIORITIZE COURSE NAME
if (cert.course_title) {

  if (certTextEl) {
    certTextEl.innerText = "has successfully completed the course";
  }

  if (certTitleEl) {
    certTitleEl.innerText = cert.course_title;
  }

} else if (cert.exam_title) {

  if (certTextEl) {
    certTextEl.innerText = "has successfully passed the assessment";
  }

  if (certTitleEl) {
    certTitleEl.innerText = cert.exam_title;
  }

}

}

// FORMAT DATE
const issueDateEl = document.getElementById("issueDate");

if (issueDateEl && cert.issued_at) {

  const date = new Date(cert.issued_at);

  issueDateEl.innerText = date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

} else if (issueDateEl) {

  issueDateEl.innerText = "—";

}


else if (cert.exam_title) {

  document.getElementById("certificateText").innerText =
    "has successfully passed the assessment";

  document.getElementById("certificateTitle").innerText =
    cert.exam_title;

}


    /* ================= BIND DATA ================= */

    studentNameEl.textContent = cert.student_name || "-";

    if (courseNameEl) {
      courseNameEl.textContent = cert.course_title || "";
    }

    if (examNameEl) {
      examNameEl.textContent = cert.exam_title || "";
    }

    certIdEl.textContent = certificateId;

    /* ===== Score percentage ===== */

    if (
      typeof cert.score === "number" &&
      typeof cert.total_questions === "number" &&
      cert.total_questions > 0
    ) {

      const percent = Math.round(
        (cert.score / cert.total_questions) * 100
      );

      scoreTextEl.textContent = `Score: ${percent}%`;

    } else {

      scoreTextEl.textContent = "";

    }

    /* ================= QR CODE ================= */

    const verifyUrl =
      location.origin + "/verify.html?id=" + certificateId;

    qrBox.innerHTML = "";

    new QRCode(qrBox, {
      text: verifyUrl,
      width: 110,
      height: 110,
      correctLevel: QRCode.CorrectLevel.H
    });

    console.log("🎓 Loaded certificate:", cert);

  } catch (err) {

    console.error("❌ Certificate load failed:", err);
    alert("Failed to load certificate");

  }

}

/* ================= DOWNLOAD ================= */

function downloadCert() {

  if (!certificateId) {
    alert("Certificate ID missing");
    return;
  }

  window.open(
    `/api/certificates/download/${certificateId}`,
    "_blank"
  );

}

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", loadCertificate);