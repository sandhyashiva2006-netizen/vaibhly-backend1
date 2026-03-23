async function adminLogin() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/api/auth/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!res.ok) {
    document.getElementById("error").innerText = data.error;
    return;
  }

  localStorage.setItem("adminToken", data.token);
  window.location.href = "dashboard.html";
}
