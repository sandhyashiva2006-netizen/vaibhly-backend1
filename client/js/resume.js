/* ================= GLOBAL ================= */

let certificates = [];
let selectedTemplate = localStorage.getItem("resumeTemplate") || "modern";
let currentThemeAllowed = true;

const fields = [
  "name","title","email","phone",
  "summary","skills","projects",
  "education","linkedin","github"
];

/* ================= SAFE JSON ================= */

function extractJSON(text) {

  if (!text) return null;

  try {

    if (typeof text === "object") return text;

    text = text.replace(/```json/g,"")
               .replace(/```/g,"")
               .trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1) return null;

    return JSON.parse(text.substring(start, end + 1));

  } catch (e) {
    console.error("JSON Parse Error:", e);
    return null;
  }
}

/* ================= DOM LOAD ================= */

document.addEventListener("DOMContentLoaded", function(){

  fields.forEach(function(id){
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updatePreview);
  });

  restoreTemplate();
  loadDraft();
  updatePreview();
  loadCertificates();
});

/* ================= CERTIFICATES ================= */

async function loadCertificates(){

  try{
    const res = await fetch("/api/certificates/my",{
      headers:{ Authorization:"Bearer " + localStorage.getItem("token") }
    });

    const data = await res.json();
    certificates = data.certificates || [];
    updatePreview();

  }catch{
    certificates = [];
  }
}

/* ================= DATA ================= */

function getData(){

  const data = {};

  fields.forEach(function(id){
    const el = document.getElementById(id);
    data[id] = el ? el.value : "";
  });

  return data;
}

function handleAIUnavailable(message){
  alert(message || "AI features are temporarily unavailable.");
}

/* ================= PREVIEW ================= */

function updatePreview(){

  const preview = document.getElementById("resumePreview");
  if (!preview) return;

  const d = getData();

  preview.innerHTML = `
    <div class="resume-sheet template-${selectedTemplate}">
      <h1>${d.name}</h1>
      <h3>${d.title}</h3>
      <p>${d.email} | ${d.phone}</p>

      <hr>

      <h3>Summary</h3>
      <p>${d.summary}</p>

      <h3>Skills</h3>
      <p>${d.skills}</p>

      <h3>Projects</h3>
      <p>${d.projects}</p>

      <h3>Education</h3>
      <p>${d.education}</p>

      <h3>Certificates</h3>
      <ul>
        ${certificates.map(function(c){
          return `<li>${c.course_name} (${new Date(c.issued_at).toLocaleDateString()})</li>`;
        }).join("")}
      </ul>

      <h3>Links</h3>
      <p>${d.linkedin}<br>${d.github}</p>
    </div>
  `;
}

setTimeout(function(){
   if (typeof calculateResumeScore === "function") {
      calculateResumeScore();
   }
}, 50);

/* ================= TEMPLATE ================= */

function onTemplateChange(){
  const select = document.getElementById("templateSelect");
  selectedTemplate = select.value;
  localStorage.setItem("resumeTemplate", selectedTemplate);
  updatePreview();
}

function restoreTemplate(){
  const select = document.getElementById("templateSelect");
  if (select) select.value = selectedTemplate;
}

/* ================= DRAFT ================= */

async function saveDraft(){

if (!currentThemeAllowed) {
  alert("🔒 Please purchase this theme before saving.");
  return;
}

  const template = document.getElementById("templateSelect").value;

  const checkRes = await fetch(`/api/resume/themes/check/${template}`, {
    headers:{
      Authorization:"Bearer " + localStorage.getItem("token")
    }
  });

  const check = await checkRes.json();

  if (!check.allowed) {
    startPayment(template, check.price);
    return;
  }

  // Continue normal save
  const draft = getData();

  await fetch("/api/resume/save", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      Authorization:"Bearer " + localStorage.getItem("token")
    },
    body:JSON.stringify({
      resume_data:draft,
      template
    })
  });

  alert("Saved successfully");
}

function startPayment(code, price){

  const options = {
    key: "rzp_test_YOURKEY",
    amount: price * 100,
    currency: "INR",
    name: "EduNexa Themes",
    description: code + " Theme",

    handler: async function (response){

      await fetch("/api/payments/verify-payment", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          Authorization:"Bearer " + localStorage.getItem("token")
        },
        body:JSON.stringify({
          theme_code: code,
          razorpay_payment_id: response.razorpay_payment_id
        })
      });

      alert("🎉 Theme unlocked!");

      saveDraft(); // Retry save after purchase
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}


function loadDraft(){

  const d = JSON.parse(localStorage.getItem("resumeDraft") || "{}");

  fields.forEach(function(id){
    if (d[id]) {
      const el = document.getElementById(id);
      if (el) el.value = d[id];
    }
  });
}

/* ================= PDF ================= */

async function downloadPDF(){

  if (!currentThemeAllowed) {
    alert("🔒 Please purchase this theme before downloading.");
    return;
  }

  window.print();
}

/* ================= AI IMPROVE FULL ================= */

async function improveWithAI(){

  return aiImprove("all");
}


/* ================= AI SECTION IMPROVE ================= */

async function aiImprove(section){

  const summaryEl = document.getElementById("summary");
  const skillsEl = document.getElementById("skills");
  const projectsEl = document.getElementById("projects");


  const prompt = `
Rewrite resume professionally.

Return ONLY JSON:
{
 "summary":"...",
 "skills":"...",
 "projects":"..."
}

Improve section:${section}

Summary:${summaryEl.value}
Skills:${skillsEl.value}
Projects:${projectsEl.value}
`;

  try{

    const res = await fetch("/api/ai/ask",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        Authorization:"Bearer " + localStorage.getItem("token")
      },
      body:JSON.stringify({ message:prompt })
    });

    const data = await res.json();
    console.log("RAW AI:", data.reply);

    if (!data.reply) {
  alert("AI did not respond.");
  return;
}

// Detect usage limit or text errors
if (typeof data.reply === "string" && !data.reply.includes("{")) {
  alert(data.reply);
  return;
}

if (data.reply.includes("limit")) {
   alert("AI temporarily disabled for testing");
   return;
}

const parsed = extractJSON(data.reply);

if (!parsed) {
  alert("AI returned invalid format.");
  return;
}


    if ((section==="summary" || section==="all") && parsed.summary)
      summaryEl.value = parsed.summary;

    if ((section==="skills" || section==="all") && parsed.skills)
      skillsEl.value = parsed.skills;

    if ((section==="projects" || section==="all") && parsed.projects)
      projectsEl.value = parsed.projects;

    updatePreview();
    saveDraft();

  }catch(e){
    console.error(e);
    alert("AI Failed");
  }
}


/* ================= JOB OPTIMIZER ================= */

async function optimizeForJob(){

  const jobText = document.getElementById("jobDescriptionInput").value.trim();
  if (!jobText) return alert("Paste job description");

  const summaryEl = document.getElementById("summary");
  const skillsEl = document.getElementById("skills");
  const projectsEl = document.getElementById("projects");

  const prompt = `
Tailor resume for job.

Return ONLY JSON:
{
 "summary":"...",
 "skills":"...",
 "projects":"..."
}

Job Description:
${jobText}

Resume:
Summary:${summaryEl.value}
Skills:${skillsEl.value}
Projects:${projectsEl.value}
`;

  try{

    const res = await fetch("/api/ai/ask",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        Authorization:"Bearer " + localStorage.getItem("token")
      },
      body:JSON.stringify({ message:prompt })
    });

    const data = await res.json();
    const parsed = extractJSON(data.reply);
    if (!parsed) throw new Error();

    summaryEl.value = parsed.summary || summaryEl.value;
    skillsEl.value = parsed.skills || skillsEl.value;
    projectsEl.value = parsed.projects || projectsEl.value;

    updatePreview();
    alert("Resume Optimized");

  }catch{
    alert("Optimization Failed");
  }
}

/* ================= SCORE ================= */

function calculateResumeScore() {

  console.log("Score button clicked");

  var summaryEl = document.getElementById("summary");
  var skillsEl = document.getElementById("skills");
  var projectsEl = document.getElementById("projects");

  var scoreEl = document.getElementById("resumeScore");

  if (!summaryEl || !skillsEl || !projectsEl || !scoreEl) {
    console.log("Score elements missing");
    return;
  }

  var summary = summaryEl.value || "";
  var skills = skillsEl.value || "";
  var projects = projectsEl.value || "";

  var score = 0;

  if (summary.length > 80) score += 30;
  else if (summary.length > 40) score += 20;

  var skillCount = skills.split(",").filter(function(s){
    return s.trim();
  }).length;

  if (skillCount >= 8) score += 30;
  else if (skillCount >= 4) score += 20;

  if (projects.length > 120) score += 25;
  else if (projects.length > 60) score += 15;

  // ⭐ FORCE UI UPDATE
  scoreEl.textContent = score;

  console.log("Score updated:", score);
}

function applyTemplate(template) {
  const sheet = document.querySelector(".resume-sheet");
  if (!sheet) return;

  // Remove ALL template-* classes dynamically
  sheet.className = sheet.className
    .split(" ")
    .filter(c => !c.startsWith("template-"))
    .join(" ");

  // Add new one
  sheet.classList.add("template-" + template);
}


async function loadThemes() {
  const select = document.getElementById("templateSelect");

  const res = await fetch("/api/resume/themes", {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  });

  const themes = await res.json();

  select.innerHTML = "";

  themes.forEach(t => {
    const option = document.createElement("option");
    option.value = t.code;
    option.textContent = t.is_premium
      ? `${t.name} 🔒 ₹${t.price}`
      : t.name;

    select.appendChild(option);
  });

  // ✅ SET DROPDOWN TO CURRENT TEMPLATE
  const saved = localStorage.getItem("resumeTemplate") || "modern";
  select.value = saved;

  selectedTemplate = saved;
  updatePreview();
checkThemeAccess(selectedTemplate);

}

document.addEventListener("DOMContentLoaded", loadThemes);

document.getElementById("templateSelect").addEventListener("change", async function () {

  const selectedTheme = this.value;
  selectedTemplate = selectedTheme;
  localStorage.setItem("resumeTemplate", selectedTheme);

  updatePreview();

  await checkThemeAccess(selectedTheme);
});


function showPremiumBanner(price) {

  let banner = document.getElementById("premiumBanner");

  if (!banner) {
    banner = document.createElement("div");
    banner.id = "premiumBanner";
    banner.className = "premium-banner";
    document.body.prepend(banner);
  }

  banner.innerHTML = `
    🔒 This is a Premium Theme (₹${price})
    <button onclick="window.location.href='/theme-store.html'">
      Buy Now
    </button>
  `;
}



function hidePremiumBanner() {
  const banner = document.getElementById("premiumBanner");
  if (banner) banner.remove();
}

async function buyTheme() {

  const theme = document.getElementById("templateSelect").value;

  const res = await fetch("/api/resume/themes/create-order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({ theme_code: theme })
  });

  const data = await res.json();

  if (!data.orderId) {
    alert("Order failed");
    return;
  }

  const options = {
    key: data.key,
    amount: data.amount * 100,
    currency: "INR",
    name: "EduNexa",
    description: "Resume Theme Purchase",
    order_id: data.orderId,

    handler: async function (response) {

      const verify = await fetch("/api/resume/themes/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
          ...response,
          theme_code: theme
        })
      });

      const result = await verify.json();

      if (result.success) {
        alert("🎉 Theme unlocked!");
        await loadThemes();
hidePremiumBanner();

      } else {
        alert("Verification failed");
      }
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

async function checkThemeAccess(template) {

  const res = await fetch(`/api/resume/themes/check/${template}`, {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  });

  const result = await res.json();

  if (!result.allowed) {
    currentThemeAllowed = false;
    showPremiumBanner(result.price);
  } else {
    currentThemeAllowed = true;
    hidePremiumBanner();
  }
}


/* ================= GLOBAL ACCESS ================= */

window.aiImprove = aiImprove;
window.improveWithAI = improveWithAI;
window.optimizeForJob = optimizeForJob;
window.calculateResumeScore = calculateResumeScore;
window.saveDraft = saveDraft;
window.downloadPDF = downloadPDF;
window.onTemplateChange = onTemplateChange;

