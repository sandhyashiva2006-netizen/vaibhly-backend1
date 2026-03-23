console.log("🌍 Public courses loaded");

async function loadPublicCourses() {
  try {
    const res = await fetch("/api/public/courses");
    const courses = await res.json();

    const grid = document.getElementById("courseGrid");
    grid.innerHTML = "";

    if (!courses.length) {
      grid.innerHTML = "<p>No courses available.</p>";
      return;
    }

    courses.forEach(course => {
      const card = document.createElement("div");
      card.className = "card";

      card.onclick = () => {
        window.location.href = `/course.html?id=${course.id}`;
      };

      card.innerHTML = `
        <div class="thumb">📘</div>
        <div class="content">
          <div class="title">${course.title}</div>
          <div class="desc">${course.description || ""}</div>
          <div class="price">₹ ${course.price}</div>
          <button class="btn">View Details</button>
        </div>
      `;

      grid.appendChild(card);
    });

  } catch (err) {
    console.error("Public course load failed:", err);
    document.getElementById("courseGrid").innerHTML =
      "<p>Failed to load courses.</p>";
  }
}

loadPublicCourses();
