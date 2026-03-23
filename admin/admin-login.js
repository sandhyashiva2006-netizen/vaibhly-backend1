console.log("🔐 admin-login.js loaded");

const loginBtn = document.getElementById("loginBtn");
const errorEl = document.getElementById("error");

if (!loginBtn) {
  console.error("❌ loginBtn not found in DOM");
}

/* ================= LOGIN HANDLER ================= */
loginBtn.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    errorEl.innerText = "Email and password required";
    return;
  }

  try {
    console.log("🔑 Attempting admin login...");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    console.log("Login response:", data);

    if (!res.ok) {
      errorEl.innerText = data.error || "Login failed";
      return;
    }

    // ✅ Save token + role
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.user.role);

    console.log("✅ Login success, redirecting...");

    // ✅ Redirect to admin dashboard
    window.location.href = "/admin/admin.html";

  } catch (err) {
    console.error("❌ Login error:", err);
    errorEl.innerText = "Server error. Try again.";
  }
});
