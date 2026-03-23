const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"EduNexa" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });

    console.log("📧 Email sent to:", to);

  } catch (err) {
    console.error("Email send failed:", err.message);
  }
}

async function sendSelectionEmail(to, name) {

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Congratulations! You are selected 🎉",
    html: `
      <h2>Hi ${name},</h2>
      <p>You have been selected for the next stage.</p>
      <p>Login to EduNexa for more details.</p>
    `
  });
}

module.exports = { sendEmail };
