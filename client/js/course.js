const params = new URLSearchParams(window.location.search);
const courseId = params.get("id");


async function loadCourse() {
  try {
    const res = await fetch(`/api/store/courses/${courseId}`);
    const course = await res.json();

    document.getElementById("thumb").src =
      course.thumbnail || "https://via.placeholder.com/800x300";

    document.getElementById("title").innerText = course.title;
    document.getElementById("desc").innerText = course.description || "";
    document.getElementById("price").innerText = `₹ ${course.price || 0}`;

  } catch (err) {
    alert("Failed to load course");
  }
}

async function buyCourse() {
  if (!token) {
    alert("Please login first");
    return;
  }

  if (!confirm("Confirm purchase? (Fake payment)")) return;

  try {
    const res = await fetch(`/api/store/buy/${courseId}`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + window.token
      }
    });

    const data = await res.json();

    if (data.success) {
      alert("🎉 Purchase successful! Course added to dashboard.");
      window.location.href = "dashboard.html";
    } else {
      alert(data.error || "Purchase failed");
    }

  } catch (err) {
    alert("Purchase error");
  }
}

loadCourse();
