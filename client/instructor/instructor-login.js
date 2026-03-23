const API = "http://localhost:5000/api";

async function loginInstructor(){

 const email =
 document.getElementById("email").value;

 const password =
 document.getElementById("password").value;

 const res = await fetch(
   `${API}/instructor/login`,
   {
     method:"POST",
     headers:{
       "Content-Type":"application/json"
     },
     body:JSON.stringify({email,password})
   }
 );

 const data = await res.json();

 if(data.token){

localStorage.setItem("token", data.token);
localStorage.setItem("role","instructor");

window.location.href =
"/instructor/instructor-dashboard.html";

 }else{
   alert(data.msg || "Login failed");
 }

}