async function loadRevenueChart(){

 const res =
 await authFetch("/api/instructor/revenue");

 const data = await res.json();

 const ctx =
 document.getElementById("revenueChart");

 new Chart(ctx,{
  type:"line",
  data:{
   labels:data.months,
   datasets:[{
    label:"Revenue",
    data:data.amounts
   }]
  }
 });

}

loadRevenueChart();