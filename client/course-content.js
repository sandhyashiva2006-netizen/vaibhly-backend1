const token = localStorage.getItem("token");
if (!token) window.location.href = "login.html";

/* ================= LOAD COURSE ================= */
fetch("/api/course-content/my-course", {
  headers: {
    Authorization: "Bearer " + token
  }
})
  .then(res => res.json())
  .then(data => {
    console.log("COURSE DATA:", data);

    document.getElementById("courseTitle").innerText = data.course;

    const modulesDiv = document.getElementById("modulesList");
    modulesDiv.innerHTML = "";

    data.modules.forEach(m => {
      const mDiv = document.createElement("div");
      mDiv.className = "module";
      mDiv.innerHTML = `<h4>${m.title}</h4>`;

      m.lessons.forEach(l => {
        const lDiv = document.createElement("div");
        lDiv.className = "lesson";
        lDiv.innerText = l.title;
        lDiv.onclick = () => loadLesson(l);
        mDiv.appendChild(lDiv);
      });

      modulesDiv.appendChild(mDiv);
    });
  })
  .catch(err => {
    console.error("Course load error:", err);
    alert("Failed to load course content");
  });

/* ================= LOAD LESSON ================= */
function loadLesson(lesson) {
  const area = document.getElementById("lessonArea");

  // 🎥 VIDEO
  if (lesson.content_type === "video") {
    area.innerHTML = `
      <h2>${lesson.title}</h2>
      <iframe width="100%" height="420"
        src="${lesson.content}"
        frameborder="0"
        allowfullscreen></iframe>
    `;
  }

  // 📄 PDF
  else if (lesson.content_type === "pdf") {
    area.innerHTML = `
      <h2>${lesson.title}</h2>
      <p>
        📄 <a href="${lesson.content}" target="_blank"
             style="color:#2563eb; font-weight:600; font-size:16px;">
          Click here to open PDF notes
        </a>
      </p>
    `;
  }

  // 📝 TEXT
  else {
    area.innerHTML = `
      <h2>${lesson.title}</h2>
      <p style="font-size:16px; line-height:1.7; color:#111827;">
        ${lesson.content || "⚠️ No content available for this lesson."}
      </p>
    `;
  }

  // ✅ Mark lesson completed (safe call)
  markLessonCompleted(lesson.id);
}

/* ================= SAVE PROGRESS ================= */
function markLessonCompleted(lessonId) {
  fetch("/api/course-content/mark-complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ lessonId })
  }).catch(err => console.warn("Progress save failed:", err));
}

/* ================= NAVIGATION ================= */
function goBack() {
  window.location.href = "dashboard.html";
}
