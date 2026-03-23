const grid = document.getElementById("achievementsGrid");
const token = localStorage.getItem("token");

/* ================= ACHIEVEMENTS CONFIG ================= */
const ACHIEVEMENT_LIST = [
  { title: "First Lesson", desc: "Completed your first lesson", icon: "🎯", key: "firstLesson" },
  { title: "Halfway There", desc: "Completed 50% of course", icon: "🚀", key: "halfCourse" },
  { title: "Course Completed", desc: "Finished all lessons", icon: "🏁", key: "courseCompleted" },
  { title: "Certified", desc: "Earned certificate", icon: "🎓", key: "certified" }
];

/* ================= STATE ================= */
let progressState = {
  firstLesson: false,
  halfCourse: false,
  courseCompleted: false,
  certified: false
};

// Persistent unlocked achievements
let unlocked = JSON.parse(localStorage.getItem("achievements")) || {};

/* ================= STORAGE HELPERS ================= */
function saveUnlocked() {
  localStorage.setItem("achievements", JSON.stringify(unlocked));
}

function unlockAchievement(key) {
  if (unlocked[key]) return;
  unlocked[key] = true;
  saveUnlocked();
}

/* ================= UI RENDER ================= */
function renderAchievements() {
  if (!grid) return;

  grid.innerHTML = "";

  ACHIEVEMENT_LIST.forEach(a => {
    const card = document.createElement("div");
    card.className = "achievement-card";

    const isUnlocked = unlocked[a.key] || progressState[a.key];

    if (!isUnlocked) {
      card.classList.add("locked");
    }

    card.innerHTML = `
      <div class="badge-icon">${a.icon}</div>
      <div class="badge-title">${a.title}</div>
      <div class="badge-desc">${a.desc}</div>
    `;

    grid.appendChild(card);
  });
}

/* ================= LOAD REAL ACHIEVEMENTS ================= */
async function loadAchievements() {
  try {
    /* ✅ 1. Load course progress */
    const courseId = localStorage.getItem("activeCourseId");

if (!courseId) {
  console.warn("⚠️ No activeCourseId found");
  renderAchievements();
  return;
}

const progressRes = await fetch(
  `/api/course-content/progress-summary?course_id=${courseId}`,
  {
         headers: { Authorization: "Bearer " + token }
    });

    if (progressRes.ok) {
      const p = await progressRes.json();
      console.log("📊 Course Progress:", p);

      const percent = Number(p.percent || 0);

      progressState.firstLesson = (p.completed || 0) >= 1;
      progressState.halfCourse = percent >= 50;
      progressState.courseCompleted = percent === 100 || p.isComplete === true;

      // 🔓 Auto unlock if completed
      if (progressState.courseCompleted) {
        unlockAchievement("courseCompleted");
      }
    }

    /* ✅ 2. Check certificate */
    const certRes = await fetch("/api/certificates/latest", {
      headers: { Authorization: "Bearer " + token }
    });

    if (certRes.ok) {
      progressState.certified = true;
      unlockAchievement("certified");
    }

    renderAchievements();

  } catch (err) {
    console.error("❌ Achievement load error:", err);
    if (grid) {
      grid.innerHTML = "❌ Failed to load achievements";
    }
  }
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {
  renderAchievements();   // render immediately from localStorage
  loadAchievements();     // then sync with backend
});
