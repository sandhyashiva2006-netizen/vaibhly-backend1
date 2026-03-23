console.log("🔐 auth-global loaded");

/* ================= TOKEN ================= */
window.token = localStorage.getItem("token");

/* ================= REQUIRE ADMIN ================= */
window.requireAdmin = function () {
  if (!window.token) {
    console.warn("⛔ No token – redirecting to admin login");
    window.location.replace("/admin/admin-login.html");
    return false;
  }
  return true;
};

/* ================= AUTH FETCH ================= */
window.authFetch = async function (url, options = {}) {

  // ✅ always get latest token
  const token = localStorage.getItem("token") || "";

  if (!token) throw new Error("No token");

  const res = await fetch(url, {
    ...options,
    headers: {
  ...(options.headers || {}),
  Authorization: "Bearer " + token
}
  });

  if (res.status === 401) {
    console.warn("⛔ Unauthorized – redirecting");
    localStorage.clear();
    window.location.replace("/admin/admin-login.html");
    throw new Error("Unauthorized");
  }

  return res;
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => console.log("✅ Service Worker registered"))
      .catch(err => console.error("SW failed", err));
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(reg => {
        console.log("✅ EduNexa SW registered");
        console.log("Scope:", reg.scope);
      })
      .catch(err => {
        console.error("❌ EduNexa SW registration failed", err);
      });
  });
}

/* ================= LOGOUT ================= */
window.bindLogout = function (selector, redirect = "/admin/admin-login.html") {
  const btn = document.querySelector(selector);
  if (!btn) return;

  btn.onclick = () => {
    console.log("🚪 Admin logout");
    localStorage.clear();
    window.location.replace(redirect);
  };
};
