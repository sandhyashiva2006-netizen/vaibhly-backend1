console.log("dashboard.js loaded");
console.log("🧪 Reloading exams list...");
console.log("✅ dashboard.v2.js loaded");

if (typeof authFetch !== "function") {
  window.authFetch = async function (url, options = {}) {
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: "Bearer " + localStorage.getItem("token")
      }
    });
  };
}

/* ================= FADE IN ================= */
document.body.style.opacity = 0;
window.onload = () => {
  document.body.style.transition = "opacity 0.4s ease";
  document.body.style.opacity = 1;
};

/* ================= GLOBALS ================= */
window.token = localStorage.getItem("token");
window.role = (localStorage.getItem("role") || "").toLowerCase();
let activeCourseId = Number(localStorage.getItem("activeCourseId")) || null;

/* ================= SAFE ELEMENT ACCESS ================= */
function el(id) {
  return document.getElementById(id);
}

function showError(containerId, message, retryFn) {
  const box = document.getElementById(containerId);
  if (!box) return;

  box.innerHTML = `
    <div class="error-box">
      <span>⚠️ ${message}</span>
      <button onclick="${retryFn}">Retry</button>
    </div>
  `;
}

function clearError(containerId) {
  const box = document.getElementById(containerId);
  if (box) box.innerHTML = "";
}


const toggleBtn = document.getElementById("themeToggle");

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  if (toggleBtn) {
    toggleBtn.innerText = theme === "dark" ? "☀️" : "🌙";
  }
}

function initTheme() {
  const saved = localStorage.getItem("theme") || "light";
  applyTheme(saved);
}

if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

document.addEventListener("DOMContentLoaded", initTheme);

/* ================= MOBILE SIDEBAR ================= */
function toggleSidebar(){

  if(window.innerWidth > 768){
    return; // desktop sidebar always visible
  }

  const sidebar = document.getElementById("sidebar");

  sidebar.classList.toggle("open");
}

document.addEventListener("click", e => {
  const sidebar = el("sidebar");
  const toggleBtn = document.querySelector(".mobile-toggle");
  if (!sidebar || !toggleBtn) return;

  if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
    sidebar.classList.remove("open", "active");
  }
});

let touchStartX = 0;

document.addEventListener("touchstart", e => {
  touchStartX = e.touches[0].clientX;
});

document.addEventListener("touchend", e => {
  const delta = e.changedTouches[0].clientX - touchStartX;
  if (delta < -80) {
    document.getElementById("sidebar")?.classList.remove("open","active");
  }
});

/* ================= LOAD PROFILE ================= */
async function loadProfile() {
  try {
    const res = await fetch("/api/student/profile", {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();

    if (el("studentName")) el("studentName").innerText = data.name || "Student";
    if (el("studentCourse")) el("studentCourse").innerText = data.course || "Not Assigned";
  } catch (err) {
    console.error("Profile load failed", err);
  }
}

/* ===== Instructor Menu Visibility ===== */
document.addEventListener("DOMContentLoaded", () => {
  const instructorMenu = el("instructorMenu");
  const role = (localStorage.getItem("role") || "").toLowerCase();

  if (role === "instructor" || role === "admin") {
    if (instructorMenu) instructorMenu.style.display = "block";
  } else {
    if (instructorMenu) instructorMenu.style.display = "none";
  }
});


/* ================= AVATAR ================= */
async function loadAvatar() {
  const avatarEl = el("profileAvatar");
  if (!avatarEl) return;

  const customAvatar = localStorage.getItem("customAvatar");
  if (customAvatar) {
    avatarEl.innerHTML =
      `<img src="${customAvatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    return;
  }

  try {
    const res = await fetch("/api/student/profile", {
      headers: { Authorization: "Bearer " + token }
    });

    const profile = await res.json();

    if (profile.avatar) {
      avatarEl.innerHTML =
        `<img src="${profile.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    } else {
      avatarEl.innerText = profile.name?.charAt(0) || "U";
    }

  } catch (err) {
    console.warn("Avatar load failed", err);
  }
}


/* ================= PROFILE DROPDOWN ================= */
document.addEventListener("DOMContentLoaded", () => {
  const profileBox = el("profileBox");
  const profileDropdown = el("profileDropdown");
  if (!profileBox || !profileDropdown) return;

  profileBox.addEventListener("click", e => {
    e.stopPropagation();
    profileDropdown.classList.toggle("show");
  });

  document.addEventListener("click", () => {
    profileDropdown.classList.remove("show");
  });
});

/* ================= LOGOUT ================= */
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = el("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.onclick = () => {
    localStorage.clear();
    window.location.href = "/login.html";
  };
});

/* ================= CERTIFICATE (SAFE + LATEST) ================= */
async function loadCertificate() {
  const status = el("certificateStatus");
  const btn = el("viewCertificateBtn");
  const shareBtn = el("shareCertificateBtn");

  if (status) status.innerText = "⏳ Checking certificate...";
  if (btn) btn.style.display = "none";
  if (shareBtn) shareBtn.style.display = "none";

  try {
    const res = await fetch("http://vaibhly-backend1.onrender.com/api/certificates/latest", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) throw new Error("No certificate");

    const cert = await res.json();
    if (!cert || !cert.certificate_id) throw new Error("Empty");

    console.log("🎓 Latest certificate:", cert);

    if (status) status.innerText = "✅ Certificate Available";
    if (btn) btn.style.display = "inline-block";
    if (shareBtn) shareBtn.style.display = "inline-block";

    window.certificateId = cert.certificate_id;

  } catch (err) {
    if (status) status.innerText = "❌ Certificate not generated yet";
    if (btn) btn.style.display = "none";
    if (shareBtn) shareBtn.style.display = "none";
    window.certificateId = null;
  }
}

function openCertificate() {

  if (!window.certificateId) {
    alert("Certificate not available");
    return;
  }

  window.location.href =
    "/certificate.html?id=" + window.certificateId;

}

function shareCertificate() {
  if (!window.certificateId) return;

  const link = location.origin + "/verify.html?id=" + window.certificateId;

  if (navigator.share) {
    navigator.share({ title: "My Certificate - Vaibhly", url: link });
  } else {
    navigator.clipboard.writeText(link);
    alert("🔗 Certificate link copied!");
  }
}

/* ================= LEADERBOARD ================= */
async function loadLeaderboard() {

  const container = document.getElementById("leaderboardList");
  if (!container) return;

  try {

    const res = await fetch("/api/leaderboard", {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token")
      }
    });

    const data = await res.json();

    container.innerHTML = "";

    data.forEach((user, index) => {

      const li = document.createElement("li");

      li.innerHTML = `
        <span class="rank">#${index + 1}</span>
        <span class="name">${user.name}</span>
        <span class="coins">🪙 ${user.coins}</span>
      `;

      container.appendChild(li);

    });

  } catch (err) {
    console.error("Leaderboard load error", err);
  }
}

/* ================= EXAMS ================= */
async function loadExams(courseCompleted = false) {

  const listEl = el("examList");
  if (!listEl) return;

  // 🔒 LOCK MESSAGE
  if (!courseCompleted) {
    listEl.innerHTML = `
      <li style="color:#dc2626;font-weight:600;">
        🔒 Complete the course to unlock exams
      </li>
    `;
    return;
  }

  try {

    const token = localStorage.getItem("token");

    if (!token) {
      listEl.innerHTML = "<li>Please login to view exams</li>";
      return;
    }

    const res = await fetch("http://vaibhly-backend1.onrender.com/api/exams/list", {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    if (!res.ok) {
      throw new Error("Failed to fetch exams");
    }

    const exams = await res.json();

    listEl.innerHTML = "";

    // 🔥 EXTRA SAFETY FILTER (frontend protection)
    const activeCourseId = Number(localStorage.getItem("activeCourseId"));

    const filteredExams = exams.filter(e => {
      return !e.course_id || e.course_id == activeCourseId;
    });

    // ❗ USE FILTERED EXAMS (IMPORTANT FIX)
    if (!filteredExams.length) {
      listEl.innerHTML = "<li>No exams available</li>";
      return;
    }

    filteredExams.forEach(exam => {

      const li = document.createElement("li");
      li.className = "exam-item";

      const badge = exam.status === "COMPLETED"
        ? `<span class="badge completed">✅ Completed</span>`
        : `<button class="start-btn">▶ Start Exam</button>`;

      li.innerHTML = `
        <div class="exam-title">${exam.title}</div>
        ${badge}
      `;

      li.onclick = () => {
        if (exam.status !== "COMPLETED") {
console.log("SETTING EXAM ID:", exam.id);
          localStorage.setItem("examId", exam.id);
          window.location.href = "exam.html";
        }
      };

      listEl.appendChild(li);

    });

  } catch (err) {

    console.error("Exam load error:", err);

    listEl.innerHTML = `
      <li style="color:red;">Error loading exams</li>
    `;

  }
}

/* ================= MY COURSES ================= */
async function loadMyCourses() {
  const container = el("myCoursesContainer");
  if (!container) return;

  try {
    const res = await fetch("/api/player/my-courses", {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    const courses = data.courses || [];
    container.innerHTML = "";

    if (!courses.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>📭 You have not purchased any courses yet.</p>
          <button onclick="location.href='/store.html'">🛒 Browse Courses</button>
        </div>`;
      return;
    }

    const grid = document.createElement("div");
    grid.className = "my-courses-grid";

    for (const course of courses) {
      let percent = 0;

      try {
        const r = await authFetch(
          `/api/course-content/progress-summary?course_id=${course.id}`
        );
        if (r.ok) {
          const p = await r.json();
          if (p.total > 0) {
            percent = Math.round((p.completed / p.total) * 100);
          }
        }
      } catch (err) {
  console.error("Error:", err);
}

      percent = Math.min(100, Math.max(0, percent));
// ✅ Unlock Course Completed Achievement
if (percent === 100) {
  unlockAchievement("courseCompleted");
}

      const card = document.createElement("div");
      card.className = "course-card";
      card.innerHTML = `
        <div class="course-title">${course.title}</div>
        <div class="course-progress-text">${percent}% completed</div>
        <div class="course-progress-bar">
          <div class="course-progress-fill" style="width:${percent}%"></div>
        </div>
        <div class="course-actions">
          <span class="course-badge">${percent === 100 ? "Completed" : "In Progress"}</span>
          <button class="course-btn" onclick="openCourse(${course.id})">▶ Continue</button>
        </div>`;
      grid.appendChild(card);
    }


    container.appendChild(grid);

    if (!courses.find(c => c.id === activeCourseId)) {
      activeCourseId = courses[0]?.id || null;
      if (activeCourseId) {
        localStorage.setItem("activeCourseId", activeCourseId);
      }
    }

  } catch {
    container.innerHTML = "<p>❌ Failed to load courses</p>";
  }
}

function openCourse(courseId) {
  localStorage.setItem("activeCourseId", courseId);
  window.location.href = `player.html?course_id=${courseId}`;
}

function openCourseFromDashboard() {
  const active = localStorage.getItem("activeCourseId");
  if (!active) return alert("Please select a course first");
  window.location.href = "/player.html";
}

let achievements = JSON.parse(localStorage.getItem("achievements")) || {};

function unlockAchievement(key) {
  if (achievements[key]) return; // already unlocked

  achievements[key] = true;
  localStorage.setItem("achievements", JSON.stringify(achievements));

  renderAchievements();
}

function renderAchievements() {
  document.querySelectorAll(".achievement-card").forEach(card => {
    const key = card.dataset.key;

    if (achievements[key]) {
      card.classList.remove("locked");
    } else {
      card.classList.add("locked");
    }
  });
}

/* ================= COURSE COMPLETION ================= */
async function checkCourseCompletion() {
  if (!activeCourseId) return animateProgress(0);

  try {
    const res = await authFetch(
      `/api/course-content/progress-summary?course_id=${activeCourseId}`
    );
    const data = await res.json();

    let percent = 0;
    if (data.total > 0) {
      percent = Math.round((data.completed / data.total) * 100);
    }

    animateProgress(percent);
    loadExams(percent === 100);

// ================= AUTO BUILD RESUME (ONCE) =================
if (percent === 100 && !localStorage.getItem("resumeAutoBuilt")) {
  try {
    const res = await fetch("/api/resume/auto-generate", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token
      }
    });

    if (res.ok) {
      console.log("📄 Resume auto-generated");
      localStorage.setItem("resumeAutoBuilt", "1");

      // 🔥 refresh resume UI immediately
      loadResumeStatus();
    }
  } catch (err) {
    console.warn("Resume auto-generate skipped");
  }
}

} catch (err) {
    console.error("Completion check failed", err);
  }
}

async function loadResumeStatus() {
  const status = el("resumeStatus");
  const viewBtn = el("viewResumeBtn");
  const editBtn = el("editResumeBtn");
  const downloadBtn = el("downloadResumeBtn");
  const shareBtn = el("shareResumeBtn");
  const badge = el("resumeBadge");

  if (!status) return;

  try {
    const res = await fetch("/api/profile/resume/me", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) {
      status.innerText = "⏳ Resume not generated yet";
      return;
    }

    const data = await res.json();

    if (data && data.id) {
      status.innerText = "✅ Resume ready";
      badge.style.display = "inline-block";

      viewBtn.style.display = "inline-block";
      editBtn.style.display = "inline-block";
      downloadBtn.style.display = "inline-block";
      shareBtn.style.display = "inline-block";

      window.resumeId = data.id;
      window.resumeUsername = data.username;
    } else {
      status.innerText = "⏳ Resume not generated yet";
    }
  } catch {
    status.innerText = "⏳ Resume not generated yet";
  }
}

async function loadResumeStats() {
  try {
    const res = await fetch("/api/resume/stats", {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token")
      }
    });

    const data = await res.json();

    document.getElementById("resumeViews").innerText = data.views || 0;
    document.getElementById("resumeContacts").innerText = data.contacts || 0;

  } catch (err) {
    console.error("Resume stats load failed", err);
  }
}


function editResume() {
  window.location.href = "/resume-builder.html";
}

function downloadResume() {
  window.open("/api/resume/download/" + window.resumeId, "_blank");
}

function shareResume() {
  const link = location.origin + "/public-resume.html?id=" + window.resumeId;

  if (navigator.share) {
    navigator.share({ title: "My Resume – Vaibhly", url: link });
  } else {
    navigator.clipboard.writeText(link);
    alert("🔗 Resume link copied!");
  }
}

function openThemeStore() {
  window.location.href = "/theme-store.html";
}


async function loadResumePrivacy() {
  try {
    const res = await fetch("/api/profile/resume/me", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) return;

    const data = await res.json();

    const toggle = document.getElementById("resumePrivacyToggle");
    const text = document.getElementById("privacyText");

    if (toggle) toggle.checked = data.is_public;
    if (text) text.innerText = data.is_public ? "Public" : "Private";

  } catch (err) {
    console.error("Error:", err);
  }

  // ✅ MOVE LISTENER INSIDE FUNCTION
  document.getElementById("resumePrivacyToggle")?.addEventListener("change", async e => {
    const isPublic = e.target.checked;

    await fetch("/api/resume/toggle-privacy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ is_public: isPublic })
    });

    document.getElementById("privacyText").innerText =
      isPublic ? "Public" : "Private";
  });
}

/* ================= View My Resume ================= */
async function viewMyResume() {
  const res = await fetch("/api/resume/me", {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  });

  const data = await res.json();

  if (!data || !data.slug) {
    alert("Resume not found");
    return;
  }

  window.open(`/resume/${data.slug}`, "_blank");
}

/* ================= PROGRESS RING ================= */
function animateProgress(percent) {
  percent = Math.min(100, Math.max(0, Number(percent)));

  const ring = el("progressRing");
  const text = el("progressPercent");
  if (!ring || !text) return;

  const deg = percent * 3.6;
  ring.style.background = `conic-gradient(#22c55e ${deg}deg, #e5e7eb ${deg}deg)`;
  text.innerText = percent + "%";
}

/* ================= ANALYTICS (ADMIN ONLY) ================= */
let learningChart = null;

async function loadAnalytics() {
  try {
    const res = await authFetch("/api/activity/my");
    const data = await res.json();
    if (!data || !data.totals) return;

    const totalTimeEl = el("totalTime");
    if (totalTimeEl) {
      totalTimeEl.innerText =
        Math.round((data.totals.total_seconds || 0) / 60) + " mins";
    }

    const totalLessonsEl = el("totalLessons");
    if (totalLessonsEl) {
      totalLessonsEl.innerText =
        data.totals.lessons_completed || 0;
    }

    const recentList = el("recentActivity");
    if (recentList) {
      recentList.innerHTML = "";
      (data.recent || []).forEach(r => {
        const li = document.createElement("li");
        li.innerText = `Lesson ${r.lesson_id} – ${Math.round(r.seconds_spent / 60)} mins`;
        recentList.appendChild(li);
      });
    }

    let labels = (data.daily || []).map(d => d.activity_date);
    let values = (data.daily || []).map(d => d.minutes_spent);
    if (!labels.length) {
      labels = ["Today"];
      values = [0];
    }

    renderLearningChart(labels, values);
  } catch (err) {
    console.error("Analytics load failed", err);
  }
}

function renderLearningChart(labels, values) {
  const canvas = el("learningChart");
  if (!canvas || typeof Chart === "undefined") return;

  if (learningChart) learningChart.destroy();

  learningChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Minutes Spent",
        data: values,
        fill: true,
        tension: 0.3
      }]
    }
  });
}

/* ================= RECOMMENDATIONS ================= */
let tips = [];
let tipIndex = 0;
let tipInterval = null;

async function loadRecommendations() {
  try {
    const res = await authFetch("/api/recommendations/my");
    const data = await res.json();

    tips = [...generateSmartTips(), ...(Array.isArray(data.tips) ? data.tips : [])];


    if (!tips.length) {
      tips = ["📚 Keep learning consistently to achieve your goals!"];
    }

    showTip();
    startTipRotation();

  } catch {
    tips = ["⚠️ Tips unavailable right now."];
    showTip();
  }
}

function showTip() {
  const el = document.getElementById("tipText");
  if (!el) return;

  el.style.animation = "none";
  el.offsetHeight; // reset animation
  el.style.animation = "tipFade 0.4s ease";

  el.innerText = tips[tipIndex];
}

function startTipRotation() {
  if (tipInterval) clearInterval(tipInterval);

  tipInterval = setInterval(() => {
    tipIndex = (tipIndex + 1) % tips.length;
    showTip();
  }, 5000);
}

function generateSmartTips() {
  const tips = [];

  const progress = Number(document.getElementById("progressPercent")?.innerText.replace("%","") || 0);

  if (progress < 30) {
    tips.push("📘 Start with small daily goals — consistency beats intensity.");
  }

  if (progress >= 30 && progress < 80) {
    tips.push("🚀 You’re making good progress — try finishing one module today.");
  }

  if (progress >= 80 && progress < 100) {
    tips.push("🏁 Almost there! Complete the course and unlock your certificate.");
  }

  const exams = document.querySelectorAll(".exam-item .start-btn").length;
  if (exams > 0) {
    tips.push("🧪 You have pending exams — revise and attempt today.");
  }

  if (!tips.length) {
    tips.push("🎯 Keep learning consistently to reach mastery.");
  }

  return tips;
}

/* ================= Heatmap ================= */
async function loadHeatmap() {
  try {
    const res = await authFetch("/api/activity/my");
    const data = await res.json();

    const daily = data.daily || [];
    const grid = document.getElementById("heatmapGrid");
    if (!grid) return;

    grid.innerHTML = "";

    const days = 30;
    const today = new Date();

    // ✅ Always use LOCAL date key
    function makeLocalKey(date) {
      return (
        date.getFullYear() + "-" +
        String(date.getMonth() + 1).padStart(2, "0") + "-" +
        String(date.getDate()).padStart(2, "0")
      );
    }

    const todayKey = makeLocalKey(new Date());

    // ✅ Normalize API dates into LOCAL keys
    const normalizedDaily = daily.map(r => {
      const localDate = new Date(r.activity_date);
      return {
        ...r,
        localKey: makeLocalKey(localDate)
      };
    });

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      const key = makeLocalKey(date);

      const record = normalizedDaily.find(d => d.localKey === key);

      // ✅ Minutes normalize
      let minutes = 0;
      if (record) {
        if (record.minutes_spent !== undefined) {
          minutes = Number(record.minutes_spent) || 0;
        } else if (record.seconds_spent !== undefined) {
          minutes = Math.round(Number(record.seconds_spent) / 60) || 0;
        }
      }

      // ✅ Color levels
      let level = 0;
      if (minutes >= 1) level = 1;
      if (minutes >= 3) level = 2;
      if (minutes >= 10) level = 3;
      if (minutes >= 20) level = 4;

      // 🌟 If user is currently learning today — show light activity
      const isToday = key === todayKey;
      if (isToday && minutes === 0 && localStorage.getItem("currentlyLearning") === "true") {
        level = 1;
      }

      console.log("📅 Heatmap:", key, "minutes:", minutes, "level:", level);

      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      if (level) cell.dataset.level = level;

      if (isToday) {
        cell.classList.add("today");
      }

      cell.title = `${key} • ${minutes} mins studied`;
      grid.appendChild(cell);
    }

    console.log("🔥 Heatmap rendered");

  } catch (err) {
    console.warn("Heatmap load failed", err);
  }
}

/* ================= AI CHAT ================= */
function addMessage(text, type) {
  const box = el("aiMessages");
  if (!box) return;

  const div = document.createElement("div");
  div.className = "ai-msg " + type;
  div.innerText = text;

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

async function sendAI() {
  const input = el("aiInput");
  if (!input) return;

  const msg = input.value.trim();
  if (!msg) return;

  addMessage(msg, "ai-user");
  input.value = "";

  const loading = document.createElement("div");
  loading.className = "ai-msg ai-bot";
  loading.innerText = "🤖 Thinking...";
  el("aiMessages")?.appendChild(loading);

  try {
    const res = await fetch("/api/ai/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        message: msg,
        context: window.currentLessonContext || null
      })
    });

    const data = await res.json();
    loading.remove();
    addMessage(data.reply || "⚠️ No response from AI", "ai-bot");

  } catch (err) {
    loading.remove();
    console.error("AI error", err);
    addMessage("❌ AI service unavailable", "ai-bot");
  }
}

function toggleAI(forceClose = false) {
  const panel = el("aiPanel");
  if (!panel) return;

  if (forceClose) {
    panel.style.display = "none";
    return;
  }

  panel.style.display =
    panel.style.display === "flex" ? "none" : "flex";
}

document.addEventListener("DOMContentLoaded", () => {
  const launcher = el("aiLauncher");
  const closeBtn = el("aiCloseBtn");

  if (launcher) launcher.onclick = () => toggleAI();
  if (closeBtn) closeBtn.onclick = () => toggleAI(true);
});
	

/* ================= CERTIFICATE POPUP ================= */
function showCertificatePopup() {
  const popup = document.getElementById("certificatePopup");
  if (!popup) return;

  const alreadyShown = localStorage.getItem("certPopupShown");
  if (alreadyShown) return;

  popup.classList.remove("hidden");
  localStorage.setItem("certPopupShown", "1");
}

function closeCertificatePopup() {
  const popup = document.getElementById("certificatePopup");
  if (!popup) return;
  popup.classList.add("hidden");
}

function getUserLevel(coins) {
  if (coins >= 700) return { name: "Master 👑", color: "#7c3aed" };
  if (coins >= 300) return { name: "Achiever 🏆", color: "#f59e0b" };
  if (coins >= 100) return { name: "Explorer 🚀", color: "#2563eb" };
  return { name: "Beginner 🌱", color: "#16a34a" };
}

async function loadWallet() {
  const res = await fetch("/api/wallet/balance", {
    headers: { Authorization: "Bearer " + localStorage.getItem("token") }
  });

  const data = await res.json();

  if (data.success) {
    document.getElementById("walletCoins").innerText =
      `🪙 ${data.coins} Coins`;

const level = getUserLevel(data.coins);

const levelDiv = document.getElementById("userLevel");
if (levelDiv) {
  levelDiv.innerText = level.name;
  levelDiv.style.color = level.color;
}

    const sidebarCoins = document.getElementById("sidebarCoins");
    if (sidebarCoins) {
      sidebarCoins.innerText = data.coins;
    }
  }
}

loadWallet();

async function loadStreak() {
  const res = await fetch("/api/progress/streak", {
    headers: { Authorization: "Bearer " + localStorage.getItem("token") }
  });

  const data = await res.json();
  document.getElementById("userStreak").innerText =
    "🔥 " + data.streak + " Day Streak";
}

loadStreak();

window.openChest = async function () {
  const btn = document.getElementById("weeklyChestBtn");

  if (btn.disabled) {
    alert("🔥 Build your 7-day streak to unlock this reward!");
    return;
  }

  const res = await fetch("/api/progress/weekly-chest", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  });

  const data = await res.json();

  if (data.success) {
    alert("🎉 You won " + data.reward + " coins!");
    location.reload();
  } else {
    alert(data.error);
  }
};

async function checkChestAvailability() {
  try {
    const res = await fetch("/api/progress/streak", {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token")
      }
    });

    const data = await res.json();

    const chestBtn = document.getElementById("weeklyChestBtn");
    if (!chestBtn) return;

    if (data.streak === 7) {
      chestBtn.innerText = "🎁 Open Weekly Chest";
      chestBtn.disabled = false;
      chestBtn.classList.remove("locked");
    } else {
      chestBtn.innerText = `🔒 Weekly Chest (${data.streak}/7)`;
      chestBtn.disabled = true;
      chestBtn.classList.add("locked");
    }

  } catch (err) {
    console.error("Chest check error:", err);
  }
}

async function loadCoinHistory() {
  console.log("📜 Loading coin history...");

  const container = document.getElementById("coinHistory");
  if (!container) return;

  const res = await fetch("/api/wallet/transactions", {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  });

  const data = await res.json();
  container.innerHTML = "";

  if (!data.transactions.length) {
    container.innerHTML = "<p>No coin activity yet.</p>";
    return;
  }

  function formatType(type) {
    switch (type) {
      case "lesson_completion": return "📘 Lesson Completed";
      case "referral_bonus": return "🎁 Referral Bonus";
      case "course_completion": return "🎓 Course Completed";
      case "weekly_chest": return "🎁 Weekly Chest";
      default: return type;
    }
  }

  data.transactions.forEach(tx => {
    const item = document.createElement("div");
    item.className = "coin-item";

    item.innerHTML = `
      <div class="coin-top">
        <span class="coin-amount">+${tx.amount} Coins</span>
        <span class="coin-type">${formatType(tx.type)}</span>
      </div>
      <div class="coin-date">
        ${new Date(tx.created_at).toLocaleString()}
      </div>
    `;

    container.appendChild(item);
  });
}

loadCoinHistory();

function toggleWallet() {
  document.getElementById("walletPanel").classList.toggle("hidden");
}

const postForm = document.getElementById("post-form");

if (postForm) {
  postForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token");

    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: title.value,
        type: type.value,
        content: content.value,
        image_url: document.getElementById("image_url").value
      })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage("Post published successfully 🎉", "success");
      postForm.reset();
    } else {
      showMessage(data.error || "Something went wrong", "error");
    }
  });
}

function showMessage(text, type) {
  const msg = document.createElement("div");
  msg.innerText = text;
  msg.className = type === "success" ? "msg-success" : "msg-error";

  document.body.appendChild(msg);

  setTimeout(() => {
    msg.remove();
  }, 3000);
}

async function loadInterviews() {

  const res = await fetch("/api/recruiter/my-interviews", {
    headers: { Authorization: `Bearer ${token}` }
  });

  const interviews = await res.json();

  let html = "";

  interviews.forEach(i => {
    html += `
      <div class="card">
        <h4>${i.title}</h4>
        <p>Date: ${new Date(i.interview_date).toLocaleString()}</p>
        <a href="${i.meeting_link}" target="_blank">Join Meeting</a>
      </div>
    `;
  });

  document.getElementById("interviews").innerHTML = html;
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  loadProfile();
  loadAvatar();
  loadCertificate();
  loadRecommendations();
loadHeatmap();
checkChestAvailability();



  const role = (localStorage.getItem("role") || "").toLowerCase();
  console.log("👤 Dashboard Role:", role);

  // ✅ Analytics for ALL users
loadAnalytics();

// ✅ Admin-only widgets
if (role === "admin") {
  if (typeof loadAdminExams === "function") {
    loadAdminExams();
  }
} else {
  console.log("🚫 Skipping admin dashboard widgets for", role);
  const adminSection = el("adminSection");
  if (adminSection) adminSection.style.display = "none";
}


  await loadMyCourses();
  await checkCourseCompletion();
loadResumeStatus();
loadResumePrivacy();
loadResumeStats();
loadLeaderboard();
});

/* ================= EXPOSE ================= */
window.openCourse = openCourse;
window.openCourseFromDashboard = openCourseFromDashboard;
window.toggleSidebar = toggleSidebar;
window.openThemeStore = openThemeStore;
window.toggleAI = toggleAI;
; // ✅ safety semicolon

