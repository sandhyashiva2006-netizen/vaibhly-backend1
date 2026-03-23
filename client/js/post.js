async function loadJobs() {

  const token = localStorage.getItem("token");

  const res = await fetch("/api/recruiter/jobs");

  const jobs = await res.json();

  const container = document.getElementById("jobsContainer");
  container.innerHTML = "";

  jobs.forEach(job => {

    const div = document.createElement("div");
    div.style.border = "1px solid #ddd";
    div.style.padding = "10px";
    div.style.margin = "10px 0";

    div.innerHTML = `
      <h3>${job.title}</h3>
      <p>${job.location}</p>
      <p>${job.salary || ""}</p>
      <p>${job.description.substring(0, 100)}...</p>
      <button data-id="${job.id}">Apply</button>
    `;

    container.appendChild(div);
  });

}

document.addEventListener("click", async (e) => {

  if (!e.target.dataset.id) return;

  const token = localStorage.getItem("token");

  const res = await fetch(`/api/recruiter/jobs/${e.target.dataset.id}/apply`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Apply failed");
    return;
  }

  alert("✅ Applied successfully");
});

loadJobs();
