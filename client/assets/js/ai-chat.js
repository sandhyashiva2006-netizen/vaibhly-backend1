function askAI() {
  const question = document.getElementById("aiQuestion").value;

  if (!question) return;

  fetch("/api/ai/ask.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: USER_ID,
      course_id: COURSE_ID,
      lesson_id: getLessonId(),
course_id: getCourseId(),
user_id: getUserId(),
,
      question: question
    })
  })
  .then(res => res.json())
  .then(data => {
    document.getElementById("aiMessages").innerHTML += `
      <p><b>You:</b> ${question}</p>
      <p><b>AI:</b> ${data.answer}</p>
    `;
    document.getElementById("aiQuestion").value = "";
  });
}
