async function loadCourseAnalytics(){

 try{

 const res =
 await authFetch("/api/instructor/course-analytics");

 const data = await res.json();

 if(!Array.isArray(data)){
  console.error("Invalid analytics data:",data);
  return;
 }

 const div =
 document.getElementById("courseAnalytics");

 div.innerHTML="";

 let totalStudents = 0;

 data.forEach(c=>{

  totalStudents += Number(c.students || 0);

  div.innerHTML += `
  <div class="list-item">
  <b>${c.title}</b><br>
  👨‍🎓 Students: ${c.students}<br>
  💰 Revenue: ₹${Number(c.revenue).toFixed(2)}
  </div>
  `;

 });

 document.getElementById("studentCount").innerText =
 totalStudents;

 }catch(err){

 console.error("Course analytics error:",err);

 }

}

loadCourseAnalytics();