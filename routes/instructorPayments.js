const express = require("express");
const router = express.Router();
const db = require("../db");

// Add or update payment details
router.post("/save-payment-details", async (req, res) => {
  const {
    instructor_id,
    account_holder_name,
    bank_name,
    account_number,
    ifsc_code,
    upi_id
  } = req.body;

  try {

    const existing = await db.query(
      "SELECT * FROM instructor_payment_details WHERE instructor_id=$1",
      [instructor_id]
    );

    if (existing.rows.length > 0) {

      await db.query(
        `UPDATE instructor_payment_details
         SET account_holder_name=$1,
             bank_name=$2,
             account_number=$3,
             ifsc_code=$4,
             upi_id=$5
         WHERE instructor_id=$6`,
        [
          account_holder_name,
          bank_name,
          account_number,
          ifsc_code,
          upi_id,
          instructor_id
        ]
      );

    } else {

      await db.query(
        `INSERT INTO instructor_payment_details
        (instructor_id,account_holder_name,bank_name,account_number,ifsc_code,upi_id)
        VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          instructor_id,
          account_holder_name,
          bank_name,
          account_number,
          ifsc_code,
          upi_id
        ]
      );

    }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save payment details" });
  }
});

module.exports = router;