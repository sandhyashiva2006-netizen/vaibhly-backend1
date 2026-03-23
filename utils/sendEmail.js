const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "YOUR_EMAIL@gmail.com",
    pass: "YOUR_APP_PASSWORD" // NOT normal password
  }
});

const sendEmail = async (to, subject, text) => {
  await transporter.sendMail({
    from: `"EduNexa" <YOUR_EMAIL@gmail.com>`,
    to,
    subject,
    text
  });
};

module.exports = sendEmail;