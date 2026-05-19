require("dotenv").config();
console.log("JWT_SECRET LOADED =", process.env.JWT_SECRET);
const pool = require("./config/db"); // or wherever your db is

const express = require("express");
const app = express();
app.disable("etag");
const passport = require("./config/passport");

const cors = require("cors");
const multer = require("multer");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
require("./cron/subscription.cron");

app.use((req,res,next)=>{

res.header(
  "Access-Control-Allow-Origin",
  "*"
);

res.header(
  "Access-Control-Allow-Headers",
  "Origin, X-Requested-With, Content-Type, Accept, Authorization"
);

res.header(
  "Access-Control-Allow-Methods",
  "GET, POST, PUT, DELETE, OPTIONS"
);

/* HANDLE PREFLIGHT */

if(req.method === "OPTIONS"){

return res.sendStatus(200);

}

next();

});

/* ================= ROUTES ================= */
const adminRoutes = require("./routes/admin.routes");
const courseRoutes = require("./routes/course.routes");
const courseContentRoutes = require("./routes/courseContent.routes");
const purchaseRoutes = require("./routes/purchase.routes");
const playerRoutes = require("./routes/player.routes");
const storeRoutes = require("./routes/store.routes");
const publicRoutes = require("./routes/public.routes");
const couponRoutes = require("./routes/coupon.routes");
const salesRoutes = require("./routes/sales.routes");
const invoiceRoutes = require("./routes/invoice.routes");
const profileRoutes = require("./routes/profile.routes");
const recommendationRoutes = require("./routes/recommendation.routes");
const quizRoutes = require("./routes/ai.quiz.routes");
const resumeRoutes = require("./routes/resume.routes");
const paymentsRoutes = require("./routes/payments.routes");
const recruiterRoutes = require("./routes/recruiter.routes");
const jobsRoutes = require("./routes/jobs.routes");
const instructorRoutes = require("./routes/instructor.routes");
const instructorWalletRoutes = require("./routes/instructor.wallet.routes");
const instructorWithdrawRoutes = require("./routes/instructor.withdraw.routes");
const instructorCourseRoutes = require("./routes/instructor.course.routes");
const instructorLessonRoutes = require("./routes/instructor.lesson.routes");
const instructorModuleRoutes = require("./routes/instructor.module.routes");
const examRoutes = require("./routes/exam.routes");
const leaderboardRoutes = require("./routes/leaderboard.routes");
const instructorEarningsRoutes = require("./routes/instructorEarnings.routes");
const authRoutes =
require("./routes/auth.routes");
const recruiterInboxRoutes =
require("./routes/recruiter.inbox.routes");
const referralRoutes = require("./routes/referral.routes");
const kidsProfilesRoutes = require("./routes/kidsProfiles");
const kidsDashboardRoutes = require("./routes/kidsDashboard");
const kidsProgressRoutes = require("./routes/kidsProgress");

/* ================= MIDDLEWARE ================= */





// ✅ EXCEPTION for webhook (must be BEFORE json if needed)
app.use("/api/recruiter/webhook", express.raw({ type: "*/*" }));

// ✅ JSON for all routes
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));
app.use(passport.initialize());

/* ================= ABSOLUTE PATHS ================= */
const SERVER_ROOT  = __dirname; // /server
const CLIENT_ROOT = path.join(__dirname, "..", "client");
const ADMIN_ROOT   = path.join(__dirname, "..", "admin");
const INVOICE_ROOT = path.join(__dirname, "invoices");   // ✅ server/invoices



/* ================= STATIC FILE SERVING ================= */



// ✅ Admin panel
app.use("/admin", express.static(ADMIN_ROOT));

// ✅ Assets
app.use("/assets", express.static(path.join(CLIENT_ROOT, "assets")));


// ✅ Uploads
app.use(
 "/uploads",
 express.static(path.join(__dirname,"uploads"))
);

// ✅ Invoices (PDF download)
app.use("/invoices", express.static(INVOICE_ROOT));

/* ================= KIDS PAGES ================= */

app.get("/parent-dashboard.html", (req, res) => {
  res.sendFile(
    path.join(CLIENT_ROOT, "parent-dashboard.html")
  );
});

app.get("/kids-dashboard.html", (req, res) => {
  res.sendFile(
    path.join(CLIENT_ROOT, "kids-dashboard.html")
  );
});

app.get("/kids-courses.html", (req, res) => {
  res.sendFile(
    path.join(CLIENT_ROOT, "kids-courses.html")
  );
});

app.get("/kids-course-detail.html", (req, res) => {
  res.sendFile(
    path.join(CLIENT_ROOT, "kids-course-detail.html")
  );
});

app.get("/kids-player.html", (req, res) => {
  res.sendFile(
    path.join(CLIENT_ROOT, "kids-player.html")
  );
});

// 🌍 Public profile route
app.get("/u/:username", (req, res) => {
  res.sendFile(path.join(CLIENT_ROOT, "public-profile.html"));
});




const fs = require("fs");

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

/* ===== IMAGE UPLOAD ===== */

const storage = multer.diskStorage({

  destination:(req,file,cb)=>{
    cb(null,"uploads/");
  },

  filename:(req,file,cb)=>{

    cb(
      null,
      Date.now() +
      path.extname(file.originalname)
    );

  }

});

const upload = multer({ storage });

app.use(
  "/uploads",
  express.static("uploads")
);

/* ===== UPLOAD ROUTE ===== */

app.post(
  "/api/upload",
  upload.single("image"),
  (req,res)=>{

    if(!req.file){

      return res.status(400).json({
        error:"No image uploaded"
      });

    }

    res.json({

      url:
`https://vaibhly-backend1.onrender.com/uploads/${req.file.filename}`

    });

  }
);

/* ================= API ROUTES ================= */

app.use("/api/courses", courseRoutes);
app.use("/api/student", require("./routes/student.routes"));
app.use("/api/content", require("./routes/content.routes"));
app.use("/api/exams", examRoutes);
app.use("/api/certificates", require("./routes/certificate.routes"));
app.use("/api/admin", adminRoutes);
app.use("/api/course-content", courseContentRoutes);
app.use("/api/modules", require("./routes/module.routes"));
app.use("/api/lessons", require("./routes/lesson.routes"));
app.use("/api/player", playerRoutes);

app.use("/api/progress", require("./routes/progress.routes"));
app.use("/api/purchase", purchaseRoutes);
app.use("/api/store", storeRoutes);
app.use("/api/coupons", require("./routes/coupon.routes"));
app.use("/api/sales", salesRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/enrollments", require("./routes/enrollment.routes"));
app.use("/api/admin", require("./routes/admin.course.routes"));
app.use("/api/analytics", require("./routes/analytics.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));
app.use("/api/profile", profileRoutes);
app.use("/api/subscriptions", require("./routes/subscription.routes"));
app.use("/api/leads", require("./routes/leads.routes"));
app.use("/api/ai", require("./routes/ai.routes"));
app.use("/api/activity", require("./routes/activity.routes"));
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/admin", require("./routes/admin.import.routes"));
app.use("/api/resume", require("./routes/resume.routes"));
app.use("/api/ai", quizRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/wallet", require("./routes/wallet.routes"));
app.use("/api/progress", require("./routes/reward.routes"));
app.use("/api/recruiter", recruiterRoutes);
app.use("/api", recruiterInboxRoutes);
app.use("/api", jobsRoutes);
app.use("/api", instructorRoutes);
app.use("/api", instructorWalletRoutes);
app.use("/api", instructorWithdrawRoutes);
app.use("/api", instructorCourseRoutes);
app.use("/api", instructorLessonRoutes);
app.use("/api", instructorModuleRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/instructor-earnings", instructorEarningsRoutes);
app.use("/", publicRoutes);
app.use(
"/api/auth",
authRoutes
);
app.use("/api/referrals", referralRoutes);
// app.use("/api/kids", require("./routes/kids"));
app.use("/api/kids/profiles", kidsProfilesRoutes);
app.use("/api/kids", kidsDashboardRoutes);
app.use("/api/kids", kidsProgressRoutes);

app.use(express.static(path.join(__dirname, "..", "client")));
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();

  res.sendFile(path.join(CLIENT_ROOT, "index.html"));
});


/* ================= HEALTH CHECK ================= */
app.get("/health", (req, res) => {
  res.json({ status: "Vaibhly Backend OK 🚀" });
});

app.get("/kids", (req, res) => {
  res.sendFile(
    path.join(CLIENT_ROOT, "kids.html")
  );
});

/* ================= START ================= */
const PORT = process.env.PORT || 5000;

// const { startScheduler } = require("./services/followup.scheduler");


const { runLeadAutomation } = require("./services/leadAutomation.service");

// Run every 1 minute
setInterval(async () => {
  try {
    await runLeadAutomation();
    console.log("✅ Lead automation completed");
  } catch (err) {
    console.error("❌ Lead automation error:", err);
  }
}, 60000);

app.get("/debug-files", (req, res) => {
  const fs = require("fs");
  fs.readdir(CLIENT_ROOT, (err, files) => {
    if (err) return res.json({ error: err.message });
    res.json({ files });
  });
});

app.get("/r/:username", (req, res) => {
  res.sendFile(path.join(CLIENT_ROOT, "public-resume.html"));
});


app.get("/resume/:slug", (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "client", "public-resume.html")
  );
});

app.get("/test-static", (req, res) => {
  res.sendFile(path.join(CLIENT_ROOT, "css", "styles.css"));
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

io.on("connection", (socket) => {

  console.log("🟢 New client connected:", socket.id);

  socket.on("send_message", (data) => {
    io.emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });

});

server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log("📂 Client folder:", CLIENT_ROOT);
  console.log("📂 Admin folder:", ADMIN_ROOT);
  console.log("📂 Invoice folder:", INVOICE_ROOT);
});

setInterval(async () => {

  await pool.query(
    `UPDATE recruiter_profiles
     SET is_premium = false
     WHERE premium_expires_at < NOW()`
  );

  console.log("Checked expired premium users");

}, 60 * 60 * 1000); // every 1 hour

setInterval(async () => {
  await pool.query(`
    UPDATE jobs
    SET boost_until = NULL
    WHERE boost_until < NOW()
  `);
}, 60 * 60 * 1000);

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();

  res.sendFile(path.join(CLIENT_ROOT, "index.html"));
});

