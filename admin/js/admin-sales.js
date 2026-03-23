console.log("📊 admin-sales.js loaded");

/* ================= LOAD SUMMARY ================= */
async function loadSummary() {
  try {
    const res = await fetch("/api/sales/summary", {
      headers: {
        Authorization: "Bearer " + window.token
      }
    });

    if (!res.ok) throw new Error("Unauthorized");

    const data = await res.json();

    document.getElementById("totalRevenue").innerText =
      "₹" + (data.total?.revenue || 0);

    document.getElementById("totalOrders").innerText =
      data.total?.orders || 0;

    document.getElementById("todayRevenue").innerText =
      "₹" + (data.today?.revenue || 0);

    document.getElementById("todayOrders").innerText =
      data.today?.orders || 0;

  } catch (err) {
    console.warn("⚠️ Sales summary blocked (unauthorized)");
  }
}

/* ================= LOAD ORDERS ================= */
async function loadOrders() {
  try {
    const res = await fetch("/api/sales/orders", {
      headers: {
        Authorization: "Bearer " + window.token
      }
    });

    if (!res.ok) throw new Error("Unauthorized");

    const orders = await res.json();
    const body = document.getElementById("ordersBody");

    body.innerHTML = "";

    if (!orders.length) {
      body.innerHTML = "<tr><td colspan='7'>No orders yet</td></tr>";
      return;
    }

    orders.forEach((o, i) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${o.student_name}</td>
        <td>${o.course_name}</td>
        <td>₹${o.total_amount}</td>
        <td>${o.status}</td>
        <td>${new Date(o.created_at).toLocaleDateString()}</td>
        <td>
          ${
            o.invoice_file
              ? `<a href="/invoices/${o.invoice_file}" target="_blank">Download</a>`
              : "-"
          }
        </td>
      `;

      body.appendChild(tr);
    });

  } catch (err) {
    console.warn("⚠️ Orders blocked (unauthorized)");
  }
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {
  loadSummary();
  loadOrders();
});
