console.log("✅ admin-coupons.js loaded");

const token = localStorage.getItem("token");
if (!token) {
  alert("Session expired");
  window.location.href = "/admin/admin-login.html";
}

const tbody = document.getElementById("couponBody");

/* ================= LOAD COUPONS ================= */
async function loadCoupons() {
  try {
    const res = await fetch("/api/coupons/list", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) throw new Error("API failed");

    const coupons = await res.json();
    tbody.innerHTML = "";

    if (!coupons.length) {
      tbody.innerHTML = `<tr><td colspan="6">No coupons created</td></tr>`;
      return;
    }

    coupons.forEach((c, i) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${i + 1}</td>
        <td><strong>${c.code}</strong></td>
        <td>${c.discount_type}</td>
        <td>${c.discount_value}</td>
        <td>${c.used_count || 0}/${c.max_uses}</td>
        <td>${c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</td>
      `;

      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("Load coupons error:", err);
    tbody.innerHTML = `<tr><td colspan="6">❌ Failed to load coupons</td></tr>`;
  }
}

/* ================= CREATE COUPON ================= */
async function createCoupon() {
  const code = document.getElementById("codeInput").value.trim();
  const discount_type = document.getElementById("typeInput").value;
  const discount_value = Number(document.getElementById("valueInput").value);

  if (!code || !discount_value) {
    alert("Enter coupon code and discount value");
    return;
  }

  try {
    const res = await fetch("/api/coupons/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        code,
        discount_type,
        discount_value
      })
    });

    if (!res.ok) throw new Error("Create failed");

    document.getElementById("codeInput").value = "";
    document.getElementById("valueInput").value = "";

    loadCoupons();
    alert("✅ Coupon created successfully");

  } catch (err) {
    alert("❌ Failed to create coupon");
    console.error(err);
  }
}

/* ================= LOGOUT ================= */
function logout() {
  localStorage.clear();
  window.location.href = "/admin/admin-login.html";
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", loadCoupons);
