const API_URL = "http://localhost:5000/api";
const token = localStorage.getItem("token");

let appliedJobs = [];

async function fetchAppliedJobs(){

const token = localStorage.getItem("token");

if(!token) return;

const res = await fetch("http://localhost:5000/api/student/applied", {
headers: {
"Authorization": `Bearer ${token}`
}
});

appliedJobs = await res.json();

}

// =======================
// LOAD JOBS
// =======================

async function loadJobs() {

  const container =
    document.getElementById("studentJobsSection");

  if (!container) return;

  const res = await fetch(`${API_URL}/student/jobs`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const jobs = await res.json();

  container.innerHTML = jobs.map(job => `
    <div class="dashboard-card">

      <h3>${job.title}</h3>
      <p>${job.company || ""}</p>

      <button
        ${job.applied ? "disabled" : ""}
        onclick="applyJob(${job.id})"
      >
        ${job.applied ? "Applied" : "Apply"}
      </button>

    </div>
  `).join("");
}



// =======================
// APPLY JOB
// =======================

async function applyJob(jobId) {

  await fetch(`${API_URL}/student/apply/${jobId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  loadJobs();
  loadApplications();
}



// =======================
// LOAD APPLICATIONS
// =======================

async function loadApplications() {

  const container =
    document.getElementById(
      "studentApplicationsSection"
    );

  if (!container) return;

  const res = await fetch(
    `${API_URL}/student/my-applications`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const apps = await res.json();

  container.innerHTML = apps.map(app => `
    <div class="dashboard-card">

      <h4>${app.title}</h4>
      <p>Status: ${app.stage}</p>
      <p>AI Score: ${app.ai_score}</p>

    </div>
  `).join("");
}



// =======================
// AUTO LOAD
// =======================

document.addEventListener("DOMContentLoaded", () => {
  loadJobs();
  loadApplications();
});