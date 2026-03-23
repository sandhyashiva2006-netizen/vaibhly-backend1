const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } =
require("../middleware/auth.middleware");
const { allowInstructor } =
require("../middleware/role.middleware");

/* ===============================
   SAVE BANK DETAILS
================================ */

router.post("/instructor/bank",
verifyToken,
async(req,res)=>{

 const {
   account_holder_name,
   bank_name,
   account_number,
   ifsc_code,
   upi_id
 } = req.body;

 await pool.query(`
 INSERT INTO instructor_bank_details
 (instructor_id,
  account_holder_name,
  bank_name,
  account_number,
  ifsc_code,
  upi_id)
 VALUES($1,$2,$3,$4,$5,$6)
 ON CONFLICT(instructor_id)
 DO UPDATE SET
 account_holder_name=$2,
 bank_name=$3,
 account_number=$4,
 ifsc_code=$5,
 upi_id=$6
 `,
 [
  req.user.id,
  account_holder_name,
  bank_name,
  account_number,
  ifsc_code,
  upi_id
 ]);

 res.json({message:"Bank details saved"});
});



/* ===============================
   REQUEST WITHDRAWAL
================================ */

router.post("/instructor/withdraw",
verifyToken,
async(req,res)=>{

 const { amount } = req.body;

 const wallet = await pool.query(
 `
 SELECT balance
 FROM instructor_wallets
 WHERE instructor_id=$1
 `,
 [req.user.id]
 );

 const balance =
 wallet.rows[0]?.balance || 0;

 if(amount > balance)
   return res.status(400)
   .json({error:"Insufficient balance"});

 await pool.query(`
 INSERT INTO withdrawal_requests
 (instructor_id,amount)
 VALUES($1,$2)
 `,
 [req.user.id,amount]);

 res.json({
  message:"Withdrawal requested"
 });

});


/* ===============================
   MY WITHDRAWALS
================================ */

router.get("/instructor/withdrawals",
verifyToken,
async(req,res)=>{

 const data = await pool.query(`
 SELECT *
 FROM withdrawal_requests
 WHERE instructor_id=$1
 ORDER BY requested_at DESC
 `,
 [req.user.id]);

 res.json(data.rows);
});

module.exports = router;