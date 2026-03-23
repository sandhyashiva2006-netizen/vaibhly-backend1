console.log("login.js loaded");

/* ================= LOGIN ================= */

document.getElementById("loginBtn").addEventListener("click", async () => {

const email = document.getElementById("email").value.trim();
const password = document.getElementById("password").value.trim();

if (!email || !password) {
alert("Please enter email and password");
return;
}

try {

const res = await fetch("/api/auth/login", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ email, password })
});

const data = await res.json();
console.log("LOGIN RESPONSE:", data);

if (!res.ok) {
alert(data.error || "Login failed");
return;
}

// SAVE DATA
localStorage.setItem("token", data.token);
localStorage.setItem("userId", data.user.id);
localStorage.setItem("name", data.user.name);
localStorage.setItem("role", data.user.role);

// ROLE REDIRECT
if (data.user.role === "admin") {
window.location.href = "/admin/admin-dashboard.html";
}
else if (data.user.role === "recruiter") {
window.location.href = "/recruiter-dashboard.html";
}
else {
const redirect = localStorage.getItem("redirectAfterLogin");

if (redirect) {
localStorage.removeItem("redirectAfterLogin");
window.location.href = redirect;
} else {
window.location.href = "/dashboard.html";
}
}

} catch (err) {
console.error("Login error:", err);
alert("Server error");
}

});


/* ================= REGISTER ================= */

document.getElementById("registerForm").addEventListener("submit", async (e) => {

e.preventDefault();

const name = document.getElementById("regName").value;
const email = document.getElementById("regEmail").value;
const password = document.getElementById("regPassword").value;
const referral = document.getElementById("referral").value;

try {

const res = await fetch("/api/auth/register", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ name, email, password, referral })
});

const data = await res.json();

if (data.success) {

// 🔥 AUTO LOGIN AFTER REGISTER
const loginRes = await fetch("/api/auth/login", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ email, password })
});

const loginData = await loginRes.json();

localStorage.setItem("token", loginData.token);
localStorage.setItem("userId", loginData.user.id);
localStorage.setItem("name", loginData.user.name);
localStorage.setItem("role", loginData.user.role);

alert("Account created successfully!");

window.location.href = "/dashboard.html";

} else {
alert(data.error || "Registration failed");
}

} catch (err) {
console.error(err);
alert("Server error");
}

});


/* ================= GOOGLE LOGIN ================= */

function googleLogin(){
window.location.href = "http://localhost:5000/api/auth/google";
}


/* ================= PASSWORD TOGGLE ================= */

function togglePassword(id){
const input = document.getElementById(id);
input.type = input.type === "password" ? "text" : "password";
}


/* ================= TOGGLE FORMS ================= */

function showLogin(){
hideAll();
document.getElementById("loginForm").classList.remove("hidden");
document.getElementById("authTitle").innerText = "Welcome Back";
setActive(0);
}

function showRegister(){
hideAll();
document.getElementById("registerForm").classList.remove("hidden");
document.getElementById("authTitle").innerText = "Create Account";
setActive(1);
}

function showForgot(){
hideAll();
document.getElementById("forgotSection").classList.remove("hidden");
document.getElementById("authTitle").innerText = "Reset Password";
}

function hideAll(){
document.getElementById("loginForm").classList.add("hidden");
document.getElementById("registerForm").classList.add("hidden");
document.getElementById("forgotSection").classList.add("hidden");
document.getElementById("resetSection").classList.add("hidden");
}

function setActive(index){
document.querySelectorAll(".toggle-btn").forEach(btn=>btn.classList.remove("active"));
document.querySelectorAll(".toggle-btn")[index].classList.add("active");
}


/* ================= FORGOT PASSWORD ================= */

async function sendResetOtp(){

const email = document.getElementById("forgotEmail").value;

await fetch("/api/auth/forgot-password", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ email })
});

document.getElementById("forgotSection").classList.add("hidden");
document.getElementById("resetSection").classList.remove("hidden");

}


async function resetPassword(){

const email = document.getElementById("forgotEmail").value;

// ✅ FIXED OTP
const otp = [...document.querySelectorAll(".otp-box")]
.map(input => input.value)
.join("");

const newPassword = document.getElementById("newPassword").value;

const res = await fetch("/api/auth/reset-password", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ email, otp, newPassword })
});

const data = await res.json();

if(data.success){
alert("Password reset successful!");
showLogin();
}else{
alert(data.error || "Failed");
}
}