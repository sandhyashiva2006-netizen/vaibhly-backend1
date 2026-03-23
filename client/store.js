console.log("🛒 Store loaded");
console.log("🔥 STORE.JS LOADED FROM FIXED FILE");


const couponState = {};   // { courseId: { discount, finalAmount } }

const coursesGrid = document.getElementById("coursesGrid");
const examsGrid = document.getElementById("examsGrid");

let appliedCoupon = null;
let appliedDiscount = 0;
let appliedCoins = 0;
let authChecked = false;
let isUserValid = false;
let userCoins = 0;

let purchasedCourses = [];

async function loadPurchased() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await fetch("/api/purchase/my-courses", {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    if (res.ok) {
      purchasedCourses = await res.json();
    }

  } catch (err) {
    console.warn("Purchased load failed");
  }
}

function handleUnauthorized(res) {
  if (res.status === 401) {
    alert("⚠️ Session expired. Please login again.");
    localStorage.removeItem("token");
    window.location.href = "login.html";
    return true;
  }
  return false;
}

async function checkAuth() {
try {
  const token = localStorage.getItem("token");

  if (!token) return false;


    const res = await fetch("/api/profile/me", {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    return res.ok;

  } catch (err) {
  return false;
}
}

async function initAuth() {

try {

  const token = localStorage.getItem("token");

  if (!token) {
    loadCourses();
    return;
  }

  
    const res = await fetch("/api/purchase/create-order", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ course_id: 0 }) // dummy test
    });

if (handleUnauthorized(res)) return;

    if (res.status === 401) {
      console.warn("Invalid token");
    
    }

  } catch (err) {
    console.warn("Auth check failed");
  }

  loadCourses();
}

async function loadStoreWallet() {

  const res = await fetch("/api/wallet/balance", {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  });

  const data = await res.json();

  if (data.success) {
    userCoins = data.coins;
    document.getElementById("storeCoins").innerText = userCoins;
  }
}

document.addEventListener("DOMContentLoaded", () => {

  if (localStorage.getItem("token")) {
    loadStoreWallet();
  }

});

document.getElementById("useCoinsToggle").addEventListener("change", function() {

  if (!this.checked) {
    appliedCoins = 0;
    document.getElementById("coinDiscountInfo").innerText = "";
    return;
  }

  const maxRupeeDiscount = Math.floor(userCoins / 10);
  const maxCoinsUsable = maxRupeeDiscount * 10;

  appliedCoins = maxCoinsUsable;

  document.getElementById("coinDiscountInfo").innerText =
    `Using ${appliedCoins} coins (₹${maxRupeeDiscount} discount)`;
});


let selectedExamId = null;

function showUnlockModal(examId) {
  selectedExamId = examId;
  document.getElementById("unlockModal").classList.remove("hidden");
}

function closeUnlock() {
  document.getElementById("unlockModal").classList.add("hidden");
}

async function confirmUnlock() {

  const res = await fetch("/api/exams/unlock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({ exam_id: selectedExamId })
  });

  const data = await res.json();

  // 🟢 Fully unlocked with coins
  if (data.success && data.method === "coins") {
    alert("🎉 Exam unlocked using coins!");
    startExam(selectedExamId);
    return;
  }

  // 🟡 Partial payment needed
  if (data.partial) {

    const confirmPay = confirm(
      `You have ${data.currentCoins} coins.\n` +
      `You need ${data.remainingCoins} more coins.\n\n` +
      `Pay ₹${data.rupeeToPay} to unlock now?`
    );

    if (confirmPay) {
      openExamPayment(selectedExamId, data.rupeeToPay);
    }

    return;
  }

if (data.success) {

  alert("🎉 Exam unlocked!");

  startExam(selectedExamId);

  return;

}

  alert("❌ Unlock failed");
}

function openExamPayment(examId, amount) {

  const options = {
    key: RAZORPAY_KEY,
    amount: amount * 100,
    currency: "INR",
    name: "EduNexa",
    description: "Exam Unlock",

    handler: async function (response) {

      await fetch("/api/exams/confirm-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
          exam_id: examId,
          payment_id: response.razorpay_payment_id
        })
      });

      alert("🎉 Exam unlocked successfully!");
      startExam(examId);

    }
  };

  new Razorpay(options).open();
}

/* ================= LOAD COURSES ================= */
async function loadCourses() {

await loadPurchased();

console.log("LOAD COURSES RUNNING");

  const res = await fetch("/api/store/all");

  const data = await res.json();

 console.log("API DATA:", data);

  const courses = data.courses;
  const exams = data.exams;

console.log("COURSES:", courses);

  if (!coursesGrid) {
    console.error("coursesGrid not found");
    return;
  }

  coursesGrid.innerHTML="";
  examsGrid.innerHTML="";

  /* ---------- COURSES ---------- */

  courses.forEach((course) => {

  const card = document.createElement("div");
  card.className = "course-card";

 const token = localStorage.getItem("token");

const isPurchased = purchasedCourses.some(c => c.course_id === course.id);

let buttonHTML;

if (isPurchased) {
  buttonHTML = `<button class="buy-btn" onclick="goToCourse(${course.id})">Go to Course</button>`;
} else if (localStorage.getItem("token")) {
  buttonHTML = `<button class="buy-btn" onclick="buyCourse(${course.id})">Buy Course</button>`;
} else {
  buttonHTML = `<button class="buy-btn" onclick="redirectLogin()">Login to Buy</button>`;
}

console.log("Rendering course:", course.title);

  card.innerHTML = `

  <img 
    class="course-thumb"
    src="${course.thumbnail || 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4'}"
  />


  <h3>${course.title}</h3>

  <p>${course.description || "Learn industry skills with practical lessons."}</p>

  <div class="course-meta">
    <span class="course-rating">⭐ ${(4.5 + Math.random()*0.4).toFixed(1)}</span>
    <span class="course-students">${1000 + Math.floor(Math.random()*500)} students</span>
  </div>

  <p class="course-instructor">
  👨‍🏫 
  <span class="instructor-link" onclick="openInstructor(${course.instructor_id})">
    ${course.instructor || "Vaibhly Instructor"}
  </span>
</p>

  <div class="course-price">
    ₹ ${course.price}
  </div>

  ${buttonHTML}

  `;

  coursesGrid.appendChild(card);

});


  /* ---------- EXAMS ---------- */

  exams.forEach(exam => {

    const card=document.createElement("div");
    card.className="course-card";

    card.innerHTML=`
      <h3>📝 ${exam.title}</h3>
      <p>Competitive Exam</p>

      <div class="course-price">₹${exam.price}</div>

      <button class="buy-btn"
      onclick="showUnlockModal(${exam.id})">
      Attempt Exam
      </button>
    `;

    examsGrid.appendChild(card);

  });

}

/* ================= APPLY COUPON ================= */
async function applyCoupon(button, originalAmount) {
  try {
    const card = button.closest(".card");
    if (!card) return;

    const input = card.querySelector(".coupon-input");
    const msg = card.querySelector(".coupon-msg");
    const priceSpan = card.querySelector(".final-price");

    if (!input || !msg || !priceSpan) {
      alert("Coupon UI missing");
      return;
    }

    const code = input.value.trim();
    if (!code) {
      msg.innerText = "❌ Enter coupon code";
      msg.style.color = "red";
      return;
    }

    const amount = Number(originalAmount);

    console.log("🎟 Applying coupon:", code, amount);

    const res = await fetch(
      `/api/coupons/validate?code=${encodeURIComponent(code)}&amount=${amount}`,
      {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token")
        }
      }
    );

    const data = await res.json();

    if (!res.ok || !data.success) {
      msg.innerText = "❌ " + (data.error || "Invalid coupon");
      msg.style.color = "red";
      return;
    }

    // ✅ Success
    msg.innerText = `✅ Discount ₹${data.discount} applied`;
    msg.style.color = "green";

    priceSpan.innerText = data.finalAmount;

    // Store coupon on card for checkout
    card.dataset.couponId = data.coupon_id;
    card.dataset.finalAmount = data.finalAmount;

appliedCoupon = code;              // use correct variable
appliedDiscount = data.discount;   // use correct property

console.log("🎟 Stored Coupon:", appliedCoupon);
console.log("💰 Stored Discount:", appliedDiscount);


    console.log("✅ Coupon applied:", data);

  } catch (err) {
    console.error("Coupon error:", err);
    alert("Server error validating coupon");
  }
}


/* ================= BUY COURSE ================= */
async function buyCourse(courseId) {
try {
const token = localStorage.getItem("token");

if (!token) {
  alert("🔒 Please login first");
  window.location.href = "login.html";
  return;
}

    console.log("🛒 Buying course:", courseId);

    const coinsToUse = appliedCoins || 0;

    const res = await fetch("/api/purchase/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        course_id: courseId,
        coupon_code: appliedCoupon,
        discount_amount: appliedDiscount,
        use_coins: coinsToUse
      })
    });

if (handleUnauthorized(res)) return;

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }

    const data = await res.json();

    // 🔒 DOUBLE CHECK BEFORE PAYMENT
    if (!localStorage.getItem("token")) {
      alert("Session expired. Please login again.");
      window.location.href = "login.html";
      return;
    }

    const options = {
      key: data.key,
      amount: data.amount,
      currency: "INR",
      name: "Vaibhly",
      order_id: data.orderId,

      handler: async function (response) {

        const verify = await fetch("/api/purchase/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify({
            ...response,
            course_id: courseId,
            dbOrderId: data.dbOrderId
          })
        });

        const result = await verify.json();

        if (result.success) {
          alert("✅ Payment successful!");
          window.location.href = "/dashboard.html";
        } else {
          alert("❌ Payment verification failed");
        }
      }
    };

    new Razorpay(options).open();



  } catch (err) {
    console.error("❌ Payment error:", err);
    alert("❌ Payment failed");
  }
}


/* ================= RAZORPAY CHECKOUT ================= */
function openRazorpay(order) {
  if (!window.Razorpay) {
    alert("❌ Razorpay SDK not loaded");
    return;
  }

  const options = {
    key: order.key,
    amount: order.amount,
    currency: "INR",
    name: "Vaibhly",
    description: "Course Purchase",
    order_id: order.orderId,

    handler: async function (response) {
      console.log("✅ Payment success:", response);

      try {
        const payload = {
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,

          // ✅ CRITICAL FIX
          course_id: Number(window.__lastCourseId),
          dbOrderId: order.dbOrderId,

          // optional (if you use coupons later)
          coupon_code: window.__lastCouponId || null,
          discount_amount: Number(
            document.querySelector(".discount-amount")?.innerText || 0
          )
        };

        console.log("📦 Verify payload:", payload);

        const verify = await fetch("/api/purchase/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("authToken")
          },
          body: JSON.stringify(payload)
        });

        const result = await verify.json();

        if (result.success) {
          alert("✅ Payment successful! Course activated.");

          // ✅ Auto-select purchased course for dashboard
          if (window.__lastCourseId) {
            localStorage.setItem(
              "activeCourseId",
              String(window.__lastCourseId)
            );
          }

          // ✅ Force fresh dashboard load
          window.location.href =
            "/dashboard.html?refresh=" + Date.now();

        } else {
          alert("❌ Payment verification failed");
        }

      } catch (err) {
        console.error("Verification error:", err);
        alert("❌ Payment verification error");
      }
    },

    theme: {
      color: "#2563eb"
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

function filterCourses() {
  console.log("🔍 filterCourses called (placeholder)");
}

function redirectLogin(){

  localStorage.setItem("redirectAfterLogin", window.location.href);

  alert("🔒 Please login to purchase courses");

  window.location.href = "login.html";
}

function goToCourse(id) {
  window.location.href = `course.html?id=${id}`;
}

function renderExams(exams){

 exams.forEach(exam=>{

  const card=document.createElement("div");
  card.className="card";

  card.innerHTML=`
   <h3>📝 ${exam.title}</h3>
   <p>Competitive Exam</p>

   <div class="price">
    ₹${exam.price}
   </div>

   <button class="buy-btn"
   onclick="showUnlockModal(${exam.id})">
   Attempt Exam
   </button>
  `;

  grid.appendChild(card);

 });

}

function startExam(examId){

  // store exam session
  localStorage.setItem("examId", examId);

  window.location.href = "/exam.html";
}

function openInstructor(id) {
  window.location.href = `instructor.html?id=${id}`;
}

async function loadCompetitiveExams(){

 const res=await fetch("/api/store/competitive-exams");
 const exams=await res.json();

 exams.forEach(exam=>{

  const card=document.createElement("div");
  card.className="card";

  card.innerHTML=`
  <h3>🏆 ${exam.title}</h3>

  <p>Competitive exam</p>

  <div class="price">
   ₹${exam.price}
  </div>

  <button onclick="showUnlockModal(${exam.id})">
   Attempt Exam
  </button>
  `;

  grid.appendChild(card);

 });

}

/* ================= INIT ================= */
initAuth();
