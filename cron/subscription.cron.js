const cron = require("node-cron");
const pool = require("../config/db");

cron.schedule("0 0 * * *", async () => {

  console.log("Checking expired subscriptions...");

  await pool.query(`
    UPDATE recruiter_profiles
    SET plan_id = 1,
        plan_expires_at = NULL
    WHERE plan_expires_at IS NOT NULL
    AND plan_expires_at < NOW()
  `);

});