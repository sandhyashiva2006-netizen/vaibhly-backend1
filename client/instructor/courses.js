API="http://localhost:5000/api";
token = localStorage.getItem("token");

function authFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  });
}

async function uploadCourse(){

 const title =
 document.getElementById("title").value;

 const description =
 document.getElementById("description").value;

 const price =
 document.getElementById("price").value;

 if(!title || !price){
   alert("Please enter course title and price");
   return;
 }

 try{

 const res = await authFetch(
  "/api/instructor/course",
  {
   method:"POST",
   headers:{
    "Content-Type":"application/json"
   },
   body:JSON.stringify({
    title,
    description,
    price
   })
  }
 );

 const data = await res.json();

 alert(data.message || "Course created");

 loadCourses();

 }catch(err){

 console.error("Create course error:",err);
 alert("Failed to create course");

 }

}


async function loadCourses(){
console.log("LOADING INSTRUCTOR COURSES");

 try{

  const container = document.getElementById("myCourses");

  // If page does not contain course list, exit safely
  if(!container){
    return;
  }

  const res = await fetch("/api/instructor/courses", {
  headers: {
    Authorization: "Bearer " + localStorage.getItem("token")
  }
})

  const courses = await res.json();

  if(!Array.isArray(courses)){
   console.warn("Invalid courses");
   return;
  }

  container.innerHTML = "";

  courses.forEach(c => {

   container.innerHTML += `
   <div class="card">

     <h4>${c.title}</h4>
     <p>₹${c.price}</p>

     <button onclick="openBuilder(${c.id})">
       ⚙ Course Builder
     </button>

     <button onclick="deleteCourse(${c.id})">
       🗑 Delete
     </button>

   </div>
   `;

  });

 }catch(err){
  console.error("Courses load failed:",err);
 }

}


function openBuilder(courseId){

 localStorage.setItem(
   "builderCourseId",
   courseId
 );

 window.location.href =
 "/instructor/instructor-course-builder.html";
}


async function deleteCourse(id){

 if(!confirm("Delete course?")) return;

 await authFetch(
   `/api/instructor/course/${id}`,
   {method:"DELETE"}
 );

 loadCourses();
}


loadCourses();

