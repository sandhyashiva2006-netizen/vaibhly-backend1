const pool = require("../config/db");
const { sendWhatsApp } = require("./whatsapp.service");
const { sendEmail } = require("./email.service");


/*
  Runs every minute:
  - Finds pending followups
  - Logs reminder (later → WhatsApp / Email)
*/

async function runFollowupScheduler() {
  try {
    console.log("⏳ Scheduler tick...");

    const result = await pool.query(`
      SELECT f.id, f.lead_id, l.name, l.phone, l.email

      FROM lead_followups f
      JOIN leads l ON l.id = f.lead_id
      WHERE f.status = 'PENDING'
        AND f.followup_at <= NOW()
    `);

    console.log("📦 Pending followups found:", result.rows.length);

    for (const row of result.rows) {
      console.log("🔔 FOLLOW-UP REMINDER:", row.name, row.phone);

if (row.email) {
  await sendEmail(
    row.email,
    "EduNexa – We contacted you",
    `
      <h3>Hello ${row.name},</h3>
      <p>Thank you for contacting EduNexa.</p>
      <p>Our team will reach out to you shortly.</p>
      <br>
      <p>Regards,<br>EduNexa Team</p>
    `
  );
}


await sendWhatsApp(
  row.phone,
  `Hello ${row.name}, thank you for your enquiry at EduNexa. Our team will contact you shortly. 📞`
);


      await pool.query(
        `UPDATE lead_followups SET status='DONE' WHERE id=$1`,
        [row.id]
      );
    }

  } catch (err) {
    console.error("Scheduler error:", err);
  }
}

function startScheduler() {
  console.log("⏰ Follow-up scheduler started");
  setInterval(runFollowupScheduler, 60 * 1000);
}

module.exports = { startScheduler };
