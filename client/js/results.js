const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

fetch("/api/student/results", {
  headers: {
    Authorization: "Bearer " + token
  }
})
  .then(res => res.json())
  .then(data => {
    const table = document.getElementById("resultsTable");

    if (data.length === 0) {
      table.innerHTML = "<tr><td colspan='4'>No results found</td></tr>";
      return;
    }

    data.forEach(r => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${r.exam_name}</td>
        <td>${r.score}</td>
        <td>${r.total_marks}</td>
        <td>${r.status}</td>
      `;
      table.appendChild(row);
    });
  })
  .catch(() => alert("Failed to load results"));
