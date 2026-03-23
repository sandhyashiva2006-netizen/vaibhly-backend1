console.log("🔐 admin auth loaded");

(function () {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/admin/admin-login.html";
    return;
  }

  // expose globally (safe)
  window.ADMIN_TOKEN = token;
})();
