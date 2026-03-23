console.log("🔐 admin-auth loaded");

// 🚫 Do NOT protect the login page
if (window.location.pathname.includes("admin-login.html")) {
  console.log("✅ Login page detected — skipping auth guard");
} else {
  (function () {
    const token = localStorage.getItem("token");

    // Prevent infinite reload loops
    if (sessionStorage.getItem("adminRedirecting")) return;

    if (!token) {
      console.warn("⛔ No token — redirecting to admin login");

      sessionStorage.setItem("adminRedirecting", "true");
      window.location.replace("/admin/admin-login.html");

      // Stop JS execution
      throw new Error("Admin access blocked");
    }

    // Expose token globally
    window.token = token;
  })();
}

// ✅ Safe logout function (available everywhere)
window.adminLogout = function () {
  localStorage.clear();
  sessionStorage.clear();
  window.location.replace("/admin/admin-login.html");
};
