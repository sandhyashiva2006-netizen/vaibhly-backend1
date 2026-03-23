console.log("Recruiter register loaded");

document.getElementById("registerBtn").addEventListener("click", async () => {

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const company = document.getElementById("company").value.trim();

  if (!name || !email || !password || !company) {
    alert("Please fill all fields");
    return;
  }

  try {
    const res = await fetch("/api/auth/recruiter/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        email,
        password,
        company
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Registration failed");
      return;
    }

    alert("Recruiter registered successfully ✅");
    window.location.href = "/recruiter-login.html";

  } catch (err) {
    console.error("Registration error:", err);
    alert("Server error");
  }

});
