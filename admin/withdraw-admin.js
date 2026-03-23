async function loadWithdrawRequests(){

 const res = await authFetch("/api/admin/withdraw-requests");
 const data = await res.json();

 const tbody =
 document.getElementById("withdrawTable");

 tbody.innerHTML="";

 data.forEach(w=>{

 tbody.innerHTML += `
<tr>

<td>${w.name}</td>

<td>₹${Number(w.amount).toFixed(2)}</td>

<td>
${w.bank_name || "-"}<br>
${w.account_number || ""}
</td>

<td>${w.upi_id || "-"}</td>

<td>
<span class="badge ${w.status}">
${w.status}
</span>
</td>

<td>

<button class="approve"
onclick="approve(${w.id})">
Approve
</button>

<button class="paidbtn"
onclick="markPaid(${w.id})">
Mark Paid
</button>

</td>

</tr>
`;

 });

}

async function approve(id){

 await authFetch("/api/admin/approve-withdraw",{
 method:"POST",
 headers:{
 "Content-Type":"application/json"
 },
 body:JSON.stringify({id})
 });

 loadWithdrawRequests();

}

async function markPaid(id){

 await authFetch("/api/admin/mark-paid",{
 method:"POST",
 headers:{
 "Content-Type":"application/json"
 },
 body:JSON.stringify({id})
 });

 loadWithdrawRequests();

}

loadWithdrawRequests();