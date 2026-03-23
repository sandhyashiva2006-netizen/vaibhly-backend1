// ======================
// LOAD WALLET
// ======================

async function loadWallet(){

 try{

  const res =
  await authFetch("/api/instructor/wallet");

  const data = await res.json();

  document.getElementById("walletBalance").innerText =
"₹"+Number(data.balance || 0).toFixed(2);

 }catch(err){
  console.error("Wallet error:",err);

  document.getElementById(
   "walletBalance"
  ).innerText="₹0";
 }

}


/* ===============================
TRANSACTIONS
=============================== */

async function loadTransactions(){

 try{

  const res =
  await authFetch(
   "/api/instructor/transactions"
  );

  const tx = await res.json();

  const tbody =
  document.getElementById("transactions");

  tbody.innerHTML="";

  tx.forEach(t=>{

   transactions.innerHTML += `
<div class="list-item">
<b>${t.course_title || "Course"}</b><br>
₹${t.amount} • ${new Date(t.created_at).toLocaleDateString()}
</div>
`;
  });

 }catch(err){
  console.error(err);
 }

}

function logout(){
 localStorage.removeItem("token");
 window.location.href="instructor-login.html";
}

/* ===============================
INIT
=============================== */

loadWallet();
loadTransactions();


