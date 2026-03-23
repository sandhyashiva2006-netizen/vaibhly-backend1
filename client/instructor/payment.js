async function loadPaymentDetails(){

 const res = await authFetch("/api/instructor/payment-details");
 const data = await res.json();

 if(!data) return;

 document.getElementById("viewHolder").innerText =
 data.account_holder_name || "-";

 document.getElementById("viewBank").innerText =
 data.bank_name || "-";

 document.getElementById("viewAccount").innerText =
 data.account_number || "-";

 document.getElementById("viewIfsc").innerText =
 data.ifsc_code || "-";

 document.getElementById("viewUpi").innerText =
 data.upi_id || "-";

}

function editPayment(){

 document.getElementById("paymentView").style.display="none";
 document.getElementById("paymentForm").style.display="block";

}

async function savePaymentDetails(){

 const body={
  account_holder_name:
  document.getElementById("holder").value,

  bank_name:
  document.getElementById("bank").value,

  account_number:
  document.getElementById("account").value,

  ifsc_code:
  document.getElementById("ifsc").value,

  upi_id:
  document.getElementById("upi").value
 };

 const res = await authFetch(
 "/api/instructor/payment-details",
 {
  method:"POST",
  headers:{
   "Content-Type":"application/json"
  },
  body:JSON.stringify(body)
 });

 const data=await res.json();

 alert(data.message || data.error);

 loadPaymentDetails();

 document.getElementById("paymentForm").style.display="none";
 document.getElementById("paymentView").style.display="block";

}

loadPaymentDetails();