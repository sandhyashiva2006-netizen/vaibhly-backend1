console.log("admin.js loaded");

document.addEventListener("DOMContentLoaded", () => {

  const token = localStorage.getItem("token");

  if (!token) {
    alert("Session expired");
    window.location.href = "login.html";
    return;
  }

  const resetBtn = document.getElementById("resetBtn");
  const userIdInput = document.getElementById("userId");
  const examIdInput = document.getElementById("examId");
  const msg = document.getElementById("resultMsg");

  if (!resetBtn || !userIdInput || !examIdInput) {
    console.error("Admin inputs not found in DOM");
    return;
  }

  // RESET BUTTON
  resetBtn.addEventListener("click", async () => {
    const userId = userIdInput.value.trim();
    const examId = examIdInput.value.trim();

    if (!userId || !examId) {
      msg.style.color = "red";
      msg.innerText = "Please enter both Student ID and Exam ID";
      return;
    }

    try {
      const res = await fetch(
        "http://localhost:5000/api/exams/admin/reset-exam",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify({
            user_id: Number(userId),
            exam_id: Number(examId)
          })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        msg.style.color = "red";
        msg.innerText = data.error || "Reset failed";
        return;
      }

      msg.style.color = "green";
      msg.innerText = "✅ Exam reset successfully";

    } catch (err) {
      console.error(err);
      msg.style.color = "red";
      msg.innerText = "Server error";
    }
  });
});

// LOGOUT
function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}
