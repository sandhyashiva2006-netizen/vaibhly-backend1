const token = localStorage.getItem("token");
const name = localStorage.getItem("name");

if (!token) {
  alert("Please login first");
  window.location.href = "login.html";
}


// Show student name
document.getElementById("studentName").innerText = "Hello, " + name;

// Load courses
fetch("http://localhost:5000/api/courses", {
  headers: {
    Authorization: "Bearer " + token
  }
})
  .then(res => res.json())
  .then(courses => {
    const ul = document.getElementById("courselist");
    ul.innerHTML = "";

    courses.forEach(c => {
      const li = document.createElement("li");
      li.innerHTML = `<a href="course.html?id=${c.id}">${c.title}</a>`;
      ul.appendChild(li);
    });
  })
  .catch(err => {
    console.error(err);
    alert("Failed to load courses");
  });


// Logout
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}

<script src="js/dashboard.js"></script>
