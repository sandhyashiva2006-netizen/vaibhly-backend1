const timeline = document.getElementById("historyTimeline");
const token = localStorage.getItem("token");

async function loadHistory() {
  try {
    const res = await fetch("/api/progress/history", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) throw new Error("Failed");

    const data = await res.json();
    timeline.innerHTML = "";

    if (!data.length) {
      timeline.innerHTML = "<p>No learning history yet.</p>";
      return;
    }

    data.forEach(item => {
      const card = document.createElement("div");
      card.className = "history-card";

      card.innerHTML = `
        <div class="history-info">
          <div class="history-icon">📘</div>
          <div>
            <div class="history-title">${item.lesson_title}</div>
            <div class="history-date">${new Date(item.completed_at).toLocaleString()}</div>
          </div>
        </div>
        <div class="status-done">Completed</div>
      `;

      timeline.appendChild(card);
    });

  } catch (err) {
    console.error("History load error:", err);
    timeline.innerHTML = "❌ Failed to load learning history.";
  }
}

loadHistory();
