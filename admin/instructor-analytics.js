document.addEventListener("DOMContentLoaded", async () => {

 const token = localStorage.getItem("token");

 try {

  const res = await fetch("/api/admin/instructor-analytics", {
   headers: { Authorization: "Bearer " + token }
  });

  const data = await res.json();

  document.getElementById("totalInstructors").innerText =
   data.totalInstructors || 0;

  document.getElementById("totalCourses").innerText =
   data.totalCourses || 0;

  document.getElementById("totalRevenue").innerText =
   Number(data.revenue || 0).toFixed(2);

 } catch(err) {

  console.error("Instructor analytics error:", err);

 }

});