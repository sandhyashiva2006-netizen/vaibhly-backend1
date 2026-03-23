const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendRecruiterNotification(to, recruiterEmail, message) {
  await transporter.sendMail({
    from: `"EduNexa Recruiter" <${process.env.EMAIL_USER}>`,
    to,
    subject: "New Recruiter Message on EduNexa",
    html: `
      <h2>You received a recruiter message</h2>
      <p><strong>From:</strong> ${recruiterEmail || "Anonymous"}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
      <br>
      <p>Login to your EduNexa dashboard to reply.</p>
    `
  });
}

module.exports = { sendRecruiterNotification };
