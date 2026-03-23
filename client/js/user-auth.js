console.log("👤 user-auth loaded");

/* ================= USER TOKEN ================= */
console.log("👤 user-auth loaded");

const userToken = localStorage.getItem("token");

// ✅ ONLY protect private pages
const protectedPages = [
  "/dashboard.html",
  "/profile.html",
  "/student.html"
];

if (protectedPages.includes(window.location.pathname) && !userToken) {
  window.location.replace("/login.html");
}

/* Expose token globally */
window.token = userToken;

/* ================= USER AUTH FETCH ================= */
window.userAuthFetch = async function (url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: "Bearer " + userToken
    }
  });

  if (res.status === 401) {

  alert("⚠️ Session expired. Please login again.");

  localStorage.removeItem("token");

  localStorage.setItem("redirectAfterLogin", window.location.href);

  window.location.replace("/login.html");

  throw new Error("Unauthorized");
}

  return res;
};

