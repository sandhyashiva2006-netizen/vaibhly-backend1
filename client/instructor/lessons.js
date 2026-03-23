async function createSection(){

 const title =
 document.getElementById("sectionTitle").value;

 const courseId =
 document.getElementById("courseId").value;

 await fetch(`${API}/instructor/section`,{
  method:"POST",
  headers:{
   "Content-Type":"application/json",
   Authorization:`Bearer ${token}`
  },
  body:JSON.stringify({
   course_id:courseId,
   title
  })
 });

 alert("Section created");
}

async function uploadLesson(){

 const formData = new FormData();

 formData.append(
  "section_id",
  document.getElementById("sectionId").value
 );

 formData.append(
  "title",
  document.getElementById("lessonTitle").value
 );

 formData.append(
  "video",
  document.getElementById("video").files[0]
 );

 await fetch(`${API}/instructor/lesson`,{
  method:"POST",
  headers:{
   Authorization:`Bearer ${token}`
  },
  body:formData
 });

 alert("Lesson uploaded");
}