async function loadCandidates(query = "") {

  const token = localStorage.getItem("token");

  const res = await fetch("/api/recruiter/candidates", {
    headers: {
      "Authorization": "Bearer " + token
    }
  });

  const candidates = await res.json();

  const container = document.getElementById("results");
  container.innerHTML = "";

  candidates
    .filter(c =>
      c.name?.toLowerCase().includes(query.toLowerCase()) ||
      c.bio?.toLowerCase().includes(query.toLowerCase())
    )
    .forEach(c => {

      const div = document.createElement("div");
      div.innerHTML = `
        <h4>${c.name}</h4>
        <p>${c.bio || ""}</p>
        <button onclick="viewProfile('${c.username}')">
          View Profile
        </button>
        <hr>
      `;

      container.appendChild(div);
    });

}

function viewProfile(username) {
  window.location.href = `/profile.html?u=${username}`;
}

document.getElementById("searchBtn").addEventListener("click", () => {
  loadCandidates(searchInput.value);
});

loadCandidates();

async function viewResume(userId) {

  const token = localStorage.getItem("token");

  const res = await fetch(`/api/recruiter/candidate/${userId}/resume`, {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await res.json();

  alert("Resume Summary:\n\n" + JSON.stringify(data.data, null, 2));
}
