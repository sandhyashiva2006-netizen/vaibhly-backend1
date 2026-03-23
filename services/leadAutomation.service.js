const pool = require("../config/db");

/*
AUTO RULES:
1. If followup sent → status = CONTACTED
2. If no activity for 7 days → status = CLOSED
3. If followup_count >= 3 → tag = HOT
*/

async function runLeadAutomation() {
  try {
    console.log("⚙️ Running Lead Automation...");

    // 1️⃣ Mark contacted leads
    await pool.query(`
      UPDATE leads
      SET status = 'CONTACTED'
      WHERE followup_count > 0
        AND status = 'NEW'
    `);

    // 2️⃣ Auto close stale leads (7 days)
    await pool.query(`
      UPDATE leads
      SET status = 'CLOSED'
      WHERE last_contacted_at IS NOT NULL
        AND last_contacted_at < NOW() - INTERVAL '7 days'
        AND status != 'CLOSED'
    `);

    // 3️⃣ Tag hot leads
    await pool.query(`
      UPDATE leads
      SET tag = 'HOT'
      WHERE followup_count >= 3
    `);

    console.log("✅ Lead automation completed");

  } catch (err) {
    console.error("❌ Lead automation failed:", err.message);
  }
}

module.exports = { runLeadAutomation };
