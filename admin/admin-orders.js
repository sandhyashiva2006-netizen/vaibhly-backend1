console.log("🧾 admin-orders.js loaded");

const token = window.ADMIN_TOKEN;
const tbody = document.getElementById("ordersBody");

async function loadOrders() {
  try {
    const res = await fetch("/api/sales/orders", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) throw new Error("API failed");

    const orders = await res.json();
    tbody.innerHTML = "";

    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="7">No orders yet</td></tr>`;
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
          ${o.invoice_file
            ? `<a href="/invoices/${o.invoice_file}" target="_blank">Download</a>`
            : "-"
          }
        </td>
      `;

      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("Orders load error:", err);
    tbody.innerHTML = `<tr><td colspan="7">❌ Failed to load orders</td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded", loadOrders);
