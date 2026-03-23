console.log("🧾 Orders page loaded");


async function loadOrders() {
  try {
    const res = await fetch("/api/store/my-orders", {
      headers: {
        Authorization: "Bearer " + window.token
      }
    });

    const orders = await res.json();
    const container = document.getElementById("ordersContainer");

    if (!orders.length) {
      container.innerHTML = `
        <div class="empty">
          No purchases yet. Visit the store to buy courses 🚀
        </div>
      `;
      return;
    }

    let html = `
      <table>
        <tr>
          <th>Course</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
    `;

    orders.forEach(o => {
      html += `
        <tr>
          <td>${o.course_name}</td>
          <td>₹ ${o.total_amount}</td>
          <td class="status">${o.status}</td>
          <td>${new Date(o.created_at).toLocaleString()}</td>
        </tr>
      `;
    });

    html += `</table>`;
    container.innerHTML = html;

  } catch (err) {
    console.error("Orders load error:", err);
    alert("Failed to load orders");
  }
}

loadOrders();
