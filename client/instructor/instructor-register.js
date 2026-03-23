const API = "http://localhost:5000/api";

async function registerInstructor(){

 const name =
 document.getElementById("name").value;

 const username =
 document.getElementById("username").value;

 const email =
 document.getElementById("email").value;

 const password =
 document.getElementById("password").value;

 const res = await fetch(
   "http://localhost:5000/api/instructor/register",
   {
     method:"POST",
     headers:{
       "Content-Type":"application/json"
     },
     body:JSON.stringify({
       name,
       username,
       email,
       password
     })
   }
 );

 const data = await res.json();

 if(res.ok){
   alert("Registration Successful ✅");
   window.location.href="instructor-login.html";
 }else{
   alert(data.error);
 }

}