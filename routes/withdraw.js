const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/request-withdraw", async (req, res) => {

  const { instructor_id, amount } = req.body;

  try {

    await db.query(
      `INSERT INTO withdraw_requests (instructor_id, amount)
       VALUES ($1,$2)`,
      [instructor_id, amount]
    );

    res.json({ success: true });

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: "Withdraw request failed" });

  }

});

module.exports = router;