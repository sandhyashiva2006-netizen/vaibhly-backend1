console.log("PLAYER SCRIPT STARTED");
console.log("🎓 Player loaded");

let totalLessonsCount = 0;
let completedLessons = [];
let currentLessonIds = [];

const urlParams = new URLSearchParams(window.location.search);
let courseId = urlParams.get("course_id");

if (!courseId) {
  console.error("Course ID missing");
  alert("Invalid course");
}

// Fallback if URL missing
if (!courseId) {
  courseId = localStorage.getItem("activeCourseId");
}

courseId = Number(courseId);

console.log("📘 Player courseId:", courseId);

/* ================= PREVIEW MODE ================= */
const params = new URLSearchParams(window.location.search);
const isPreview = params.get("preview") === "1";
const previewCourseId = params.get("course_id");

console.log("👁 Preview Mode:", isPreview, "Course:", previewCourseId);

/* ================= LEARNING SESSION TRACK ================= */
function markLearningStart() {
  console.log("🟢 Learning started");
  localStorage.setItem("currentlyLearning", "true");
}

function markLearningStop() {
  console.log("🔴 Learning stopped");
  localStorage.removeItem("currentlyLearning");
}



/* ================= DOM ELEMENTS ================= */
const courseTitle = document.getElementById("courseTitle");
const moduleList = document.getElementById("moduleList");
const lessonTitle = document.getElementById("lessonTitle");
const lessonContent = document.getElementById("lessonContent");
const progressBar = document.getElementById("progressBar");
const progressPercent = document.getElementById("progressPercent");


/* ================= ACTIVE COURSE ================= */
function getActiveCourseId() {

  // 1️⃣ First priority: course_id from URL
  const urlCourse = Number(
    new URLSearchParams(window.location.search).get("course_id")
  );

  if (urlCourse) {
    localStorage.setItem("activeCourseId", urlCourse);
    return urlCourse;
  }

  // 2️⃣ Fallback: last opened course
  const saved = Number(localStorage.getItem("activeCourseId"));

  if (saved) return saved;

  return null;
}

/* ================= ⭐ RESUME FEATURE HELPERS ================= */

function saveLastLesson(courseId, lessonId) {
  if (!courseId || !lessonId) return;
  localStorage.setItem(`lastLesson_${courseId}`, String(lessonId));
  console.log("💾 Saved last lesson:", lessonId);
}

function getLastLesson(courseId) {
  const v = localStorage.getItem(`lastLesson_${courseId}`);
  return v ? Number(v) : null;
}

/* ================= LOAD COURSE TREE ================= */
async function loadCourse() {
  try {
    let courseId = getActiveCourseId();

    if (!courseId || isNaN(courseId)) {
      const listRes = await fetch("/api/player/my-courses", {
        headers: { Authorization: "Bearer " + localStorage.getItem("token") }
      });

      const listData = await listRes.json();
      const courses = listData.courses || [];

      if (!courses.length) {
        courseTitle.textContent = "No course enrolled";
        return;
      }

      courseId = Number(courses[0].id);
      localStorage.setItem("activeCourseId", courseId);
    }

    console.log("🎯 Active course:", courseId);

    const res = await fetch(`/api/course-content/my-course?course_id=${courseId}`, {
  headers: {
    Authorization: "Bearer " + localStorage.getItem("token")
  }
});

if (!res.ok) {
  throw new Error("Failed to load course");
}

const data = await res.json();
console.log("📘 Course data:", data);

    /* ================= LOAD PROGRESS ================= */
    if (!isPreview) {
      const progressRes = await fetch(
 `/api/course-content/completed-lessons?course_id=${courseId}`,
 {
   headers: {
     Authorization: "Bearer " + localStorage.getItem("token")
   }
 }
);

const raw = await progressRes.json();

completedLessons = Array.isArray(raw)
  ? [...new Set(raw.map(id => Number(id)).filter(Boolean))]
  : [];

console.log("✅ Completed lessons:", completedLessons);

      console.log("✅ Completed lessons:", completedLessons);
    } else {
      completedLessons = [];
    }

    if (!data.course) {
      courseTitle.textContent = "No course assigned";
      return;
    }

    courseTitle.textContent =
      data.course.title + (isPreview ? " (Preview Mode)" : "");

    renderModules(data.modules);
checkCourseCompletion();

// 🌟 Fallback mark learning if lesson auto-resumes
if (!isPreview) {
  setTimeout(() => {
    const activeLesson = document.querySelector(".lesson.active");
    if (activeLesson) {
      markLearningStart();
    }
  }, 1000);
}

/* ✅ Auto resume last lesson */
autoResumeLastLesson(data.modules);


    // ⭐ RESUME FEATURE — auto open last lesson
    if (!isPreview) {
      setTimeout(() => {
        const lastLessonId = getLastLesson(courseId);

        if (lastLessonId) {
          console.log("▶️ Auto resuming lesson:", lastLessonId);
          const lessonObj = findLessonById(lastLessonId, data.modules);
          if (lessonObj) {
            showLesson(lessonObj);
          }
        }
      }, 600);
    }

  } catch(err){
 console.error("COURSE LOAD ERROR:",err);
 alert("Failed to load course: "+err.message);
}
}

/* ================= ⭐ FIND LESSON HELPER ================= */
function findLessonById(lessonId, modules) {
  for (const m of modules || []) {
    for (const l of m.lessons || []) {
      if (Number(l.id) === Number(lessonId)) {
        return l;
      }
    }
  }
  return null;
}

/* ================= RENDER MODULES ================= */
function renderModules(modules) {
  moduleList.innerHTML = "";
  totalLessonsCount = 0;
  currentLessonIds = [];

  if (!modules || !modules.length) {
    moduleList.innerHTML = "<p>No modules available</p>";
    return;
  }

  modules.forEach(module => {
    const moduleDiv = document.createElement("div");
    moduleDiv.className = "module";

    const titleDiv = document.createElement("div");
    titleDiv.className = "module-title";
    titleDiv.textContent = module.title;

    const lessonsDiv = document.createElement("div");
    lessonsDiv.style.display = "none";

    titleDiv.onclick = () => {
      lessonsDiv.style.display =
        lessonsDiv.style.display === "none" ? "block" : "none";
    };

    totalLessonsCount += module.lessons.length;

    module.lessons.forEach(lesson => {

  const lessonId = Number(lesson.id);

  // ✅ ADD THIS LINE
  currentLessonIds.push(lessonId);

  const lessonDiv = document.createElement("div");
  lessonDiv.className = "lesson";

  lessonDiv.innerText = lesson.title;

  lessonDiv.onclick = () => {

    document.querySelectorAll(".lesson")
      .forEach(el=>el.classList.remove("active"));

    lessonDiv.classList.add("active");

    showLesson({
      id: lesson.id,
      title: lesson.title,
      content: lesson.content,
      video_url: lesson.video_url,
      pdf_url: lesson.pdf_url
    });

  };

  lessonsDiv.appendChild(lessonDiv);

});

    moduleDiv.appendChild(titleDiv);
    moduleDiv.appendChild(lessonsDiv);
    moduleList.appendChild(moduleDiv);
  });

  if (!isPreview) {
    checkCourseCompletion();
  }
}

/* ================= AUTO RESUME ================= */
function autoResumeLastLesson(modules) {
  if (isPreview) return;

  const savedLessonId = Number(localStorage.getItem("lastLessonId"));
  let resumeLesson = null;

  // 1️⃣ Try restoring last opened lesson
  if (savedLessonId) {
    for (const module of modules) {
      for (const lesson of module.lessons) {
        if (Number(lesson.id) === savedLessonId) {
          resumeLesson = lesson;
          console.log("🔁 Restoring last lesson:", lesson.title);
          break;
        }
      }
      if (resumeLesson) break;
    }
  }

  // 2️⃣ Fallback → first incomplete lesson
  if (!resumeLesson) {
    for (const module of modules) {
      for (const lesson of module.lessons) {
        const lessonId = Number(lesson.id);
        if (!completedLessons.includes(lessonId)) {
          resumeLesson = lesson;
          console.log("▶️ Fallback to next lesson:", lesson.title);
          break;
        }
      }
      if (resumeLesson) break;
    }
  }

  // 3️⃣ Final fallback → first lesson
  if (!resumeLesson && modules.length) {
    resumeLesson = modules[0]?.lessons?.[0] || null;
  }

  if (!resumeLesson) return;

  // Wait for UI render
  setTimeout(() => {
    const lessonEls = document.querySelectorAll(".lesson");

    lessonEls.forEach(el => {
      if (el.textContent.includes(resumeLesson.title)) {
        el.classList.add("active");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });

    showLesson(resumeLesson);
  }, 300);
}


/* ================= MARK COMPLETED BUTTON ================= */
function createMarkCompletedButton(lesson) {
  if (isPreview) return null;

  const lessonId = Number(lesson.id);
  if (completedLessons.includes(lessonId)) return null;

  const btn = document.createElement("button");
  btn.id = "markCompletedBtn";
  btn.type = "button"; // ✅ prevent form behavior
  btn.innerText = "✅ Mark Completed";
  btn.style.marginTop = "15px";
  btn.style.padding = "8px 14px";
  btn.style.cursor = "pointer";

  btn.onclick = async (e) => {
    e.preventDefault(); // extra safety

    try {
      btn.disabled = true;
      btn.innerText = "⏳ Saving...";

      const secondsSpent = Math.floor(
        (Date.now() - window.lessonStartTime) / 1000
      );

      // Track activity (optional, non-blocking)
      // await fetch("/api/activity/track", {
//   method: "POST",
//   headers: {
//     "Content-Type": "application/json",
//     Authorization: "Bearer " + localStorage.getItem("token")
//   },
//   body: JSON.stringify({
//     lesson_id: lessonId,
//     seconds: secondsSpent
//   })
// });

      // Mark lesson complete
      const res = await fetch("/api/course-content/mark-complete", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + localStorage.getItem("token")
  },
  body: JSON.stringify({ lessonId: lessonId })
});

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error("Progress save failed");
      }

      console.log("✅ Lesson marked completed:", lessonId);

      markLearningStop(); // stop timer

      // ✅ Update UI without full reload
      completedLessons.push(lessonId);
checkCourseCompletion();
      btn.innerText = "🎉 Completed";
      btn.style.background = "#22c55e";
      btn.disabled = true;

      // Optional: show coin animation later
      // showCoinAnimation(5);

    } catch (err) {
      console.error("❌ Failed to save progress", err);
      alert("Failed to save progress");
      btn.disabled = false;
      btn.innerText = "✅ Mark Completed";
    }
  };

  return btn;
}

/* ================= SHOW LESSON ================= */

function showLesson(lesson){

 lessonTitle.textContent = lesson.title;
 lessonContent.innerHTML = "";

 if(lesson.video_url){

  lessonContent.innerHTML = `
   <video controls style="max-width:100%">
    <source src="${lesson.video_url}">
   </video>
  `;

 }

 else if(lesson.pdf_url){

  lessonContent.innerHTML = `
   <iframe src="${lesson.pdf_url}"
           style="width:100%;height:500px;border:none">
   </iframe>
  `;

 }

 else{

  lessonContent.innerHTML = lesson.content || "No content available";

 }

 /* ✅ ADD THIS BLOCK */
 const btn = createMarkCompletedButton(lesson);
 if(btn){
   lessonContent.appendChild(btn);
 }

}

function saveLastLearning(courseId, moduleId, lessonId) {
  localStorage.setItem("lastLearning", JSON.stringify({
    courseId,
    moduleId,
    lessonId,
    time: Date.now()
  }));
}

/* ================= COURSE COMPLETION CHECK ================= */
function checkCourseCompletion() {
  if (!totalLessonsCount) return;

  const validCompleted = completedLessons.filter(id =>
    currentLessonIds.includes(id)
  );

  const uniqueCompleted = [...new Set(validCompleted)];
  const percent = Math.min(
    100,
    Math.round((uniqueCompleted.length / totalLessonsCount) * 100)
  );

  if (progressBar) progressBar.style.width = percent + "%";
  if (progressPercent) progressPercent.innerText = percent + "%";

  console.log("📊 Progress:", {
    completed: uniqueCompleted.length,
    total: totalLessonsCount,
    percent
  });
}

/* ================= 🤖 AI CHAT ================= */

function toggleAI(forceClose = false) {
  const panel = document.getElementById("aiPanel");
  if (!panel) return;

  if (forceClose) {
    panel.style.display = "none";
    return;
  }

  panel.style.display =
    panel.style.display === "flex" ? "none" : "flex";
}

function addMessage(text, type) {
  const box = document.getElementById("aiMessages");
  if (!box) return;

  const div = document.createElement("div");
  div.className = "ai-msg " + type;
  div.innerText = text;

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

async function sendAI() {
  const input = document.getElementById("aiInput");
  if (!input) return;

  const msg = input.value.trim();
  if (!msg) return;

  addMessage(msg, "ai-user");
  input.value = "";

  try {
    const res = await fetch("/api/ai/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify({
  lesson_id: window.CURRENT_LESSON_ID,
  course_id: window.CURRENT_COURSE_ID,
  message: msg,
  context: window.currentLessonContext
})

    });

    const text = await res.text();

let data;
try{
  data = JSON.parse(text);
}catch(e){
  console.error("Server returned HTML instead of JSON:", text);
  return;
}

    if (typeof data === "object") {
  addMessage(JSON.stringify(data, null, 2), "ai-bot");
} else if (data.reply) {
  addMessage(data.reply, "ai-bot");
} else {
  addMessage("⚠️ AI returned empty response", "ai-bot");
}

  } catch (err) {
    console.error("AI error", err);
    addMessage("❌ AI service unavailable", "ai-bot");
  }
}

function quickAI(prompt) {
  const input = document.getElementById("aiInput");
  if (!input) return;
  input.value = prompt;
  sendAI();
}

/* ================= AI BINDING ================= */
document.addEventListener("DOMContentLoaded", () => {
  const launcher = document.getElementById("aiLauncher");
  const panel = document.getElementById("aiPanel");
  const sendBtn = document.getElementById("aiSendBtn");
  const closeBtn = document.getElementById("aiCloseBtn");
  const input = document.getElementById("aiInput");

  if (launcher) {
    launcher.onclick = () => toggleAI();
  }

  if (closeBtn) {
    closeBtn.onclick = () => toggleAI(true);
  }

  if (sendBtn) {
    sendBtn.onclick = sendAI;
  }

  if (input) {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendAI();
      }
    });
  }
});

async function generateQuiz() {
  const lessonId = getLessonId();
  const difficulty = document.getElementById("quizDifficulty").value;
  const container = document.getElementById("quizContainer");

  if (!lessonId) {
    alert("Please select a lesson first");
    return;
  }

  container.innerHTML = "⏳ Generating quiz...";

  try {
    const res = await fetch("/api/ai/quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify({
        lesson_id: lessonId,
        difficulty,
        context: window.currentLessonContext
      })
    });

    const data = await res.json();

    if (!data.questions) {
      container.innerHTML = "⚠️ Failed to generate quiz";
      return;
    }

    renderQuiz(data.questions);
  } catch (err) {
    console.error(err);
    container.innerHTML = "❌ Quiz service unavailable";
  }
}

function renderQuiz(questions) {
  const container = document.getElementById("quizContainer");
  container.innerHTML = "";

  questions.forEach((q, index) => {
    const div = document.createElement("div");
    div.style.marginBottom = "15px";

    div.innerHTML = `
      <p><b>${index + 1}. ${q.question}</b></p>
      ${q.options
        .map(
          (opt, i) =>
            `<label>
              <input type="radio" name="q${index}">
              ${opt}
            </label><br>`
        )
        .join("")}
    `;

    container.appendChild(div);
  });
}

async function loadProgress() {
  const res = await fetch(`/api/progress/my-progress?course_id=${courseId}`, {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  });

  const data = await res.json();
  completedLessons = data.map(Number);
}

/* ================= INIT ================= */
loadCourse();