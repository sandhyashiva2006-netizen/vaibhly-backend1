document.getElementById("postJobBtn").addEventListener("click", async () => {

  const token = localStorage.getItem("token");

  const title = document.getElementById("title").value.trim();
  const location = document.getElementById("location").value.trim();
  const salary = document.getElementById("salary").value.trim();
  const description = document.getElementById("description").value.trim();

  if (!title || !location || !description) {
    alert("Fill required fields");
    return;
  }

  const res = await fetch("/api/recruiter/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
      title,
      location,
      salary,
      description
    })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Failed");
    return;
  }

  alert("✅ Job posted successfully!");
  window.location.href = "/recruiter-dashboard.html";
});

/* ================= PREVIEW LOGIC ================= */

const previewBtn = document.getElementById("previewBtn");
const previewModal = document.getElementById("previewModal");
const previewContent = document.getElementById("previewContent");
const closePreview = document.getElementById("closePreview");
const editBackBtn = document.getElementById("editBackBtn");
const confirmPostBtn = document.getElementById("confirmPostBtn");

previewBtn.addEventListener("click", () => {

  const jobData = {
    title: document.getElementById("title").value,
    company: document.querySelector("[name='company_name']").value,
    location: document.getElementById("location").value,
    type: document.querySelector("[name='job_type']").value,
    experience: document.querySelector("[name='experience_level']").value,
    salaryMin: document.querySelector("[name='salary_min']").value,
    salaryMax: document.querySelector("[name='salary_max']").value,
    description: document.getElementById("description").value,
    skills: document.getElementById("skillsHidden").value,
    remote: document.querySelector("[name='remote']").checked
  };

  previewContent.innerHTML = `
    <div class="job-preview-title">
      ${jobData.title || "Untitled Job"}
    </div>

    <div class="job-preview-meta">
      ${jobData.company || "Company Name"} • 
      ${jobData.location || "Location"} • 
      ${jobData.type} • 
      ${jobData.experience}
      ${jobData.remote ? " • Remote" : ""}
    </div>

    <div class="job-preview-section">
      <h4>Salary</h4>
      <p>
        ${jobData.salaryMin || "-"} 
        ${jobData.salaryMax ? " - " + jobData.salaryMax : ""}
      </p>
    </div>

    <div class="job-preview-section">
      <h4>Skills Required</h4>
      <p>${jobData.skills || "No skills added"}</p>
    </div>

    <div class="job-preview-section">
      <h4>Description</h4>
      <p style="white-space: pre-line;">
        ${jobData.description || "No description provided."}
      </p>
    </div>
  `;

  previewModal.classList.remove("hidden");

});

closePreview.addEventListener("click", () => {
  previewModal.classList.add("hidden");
});

editBackBtn.addEventListener("click", () => {
  previewModal.classList.add("hidden");
});

confirmPostBtn.addEventListener("click", () => {
  previewModal.classList.add("hidden");
  document.getElementById("postJobBtn").click();
});