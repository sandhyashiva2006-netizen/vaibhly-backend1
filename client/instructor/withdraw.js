API="http://localhost:5000/api";
token=
localStorage.getItem("instructorToken");

async function requestWithdraw(){

 const amount =
 document.getElementById("amount").value;

 const res = await fetch(
 `${API}/instructor/withdraw`,
 {
  method:"POST",
  headers:{
   "Content-Type":"application/json",
   Authorization:`Bearer ${token}`
  },
  body:JSON.stringify({amount})
 });

 const data=await res.json();
 alert(data.message || data.error);
}