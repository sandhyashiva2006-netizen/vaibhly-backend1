async function loadWithdrawHistory(){

 const res =
 await authFetch("/api/instructor/withdraw-history");

 const data = await res.json();

 const tbody =
 document.getElementById("withdrawHistory");

 tbody.innerHTML="";

 data.forEach(w=>{

 tbody.innerHTML+=`
 <tr>
 <td>₹${w.amount}</td>
 <td>${w.status}</td>
 <td>${new Date(w.created_at)
   .toLocaleDateString()}</td>
 </tr>`;

 });

}

loadWithdrawHistory();