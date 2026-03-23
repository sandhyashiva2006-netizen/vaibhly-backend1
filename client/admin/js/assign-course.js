const token = localStorage.getItem("adminToken");
if (!token) window.location.href = "login.html";

async function assignCourse() {
  const student_id = studentId.value;
  const course_id = courseId.value;

  const res = await fetch("/api/admin/assign-course", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ student_id, course_id })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Assignment failed");
    return;
  }

  alert("Course assigned successfully");
}
