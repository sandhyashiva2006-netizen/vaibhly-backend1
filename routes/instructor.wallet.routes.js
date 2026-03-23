const express = require("express");
const router = express.Router();
const pool = require("../db");
const { verifyToken } =
require("../middleware/auth.middleware");

const { allowInstructor } =
require("../middleware/role.middleware");

// wallet balance
router.get(
"/instructor/wallet",
verifyToken,
async(req,res)=>{

 try{

   let wallet = await pool.query(
   `
   SELECT balance
   FROM instructor_wallets
   WHERE instructor_id=$1
   `,
   [req.user.id]
   );

   // ✅ create wallet automatically
   if(wallet.rows.length === 0){

     await pool.query(`
       INSERT INTO instructor_wallets
       (instructor_id,balance)
       VALUES($1,0)
     `,[req.user.id]);

     return res.json({ balance:0 });
   }

   res.json(wallet.rows[0]);

 }catch(err){
   console.error(err);
   res.status(500).json({balance:0});
 }

});

// earnings history
router.get("/instructor/transactions",
verifyToken,
async(req,res)=>{

 const data = await pool.query(
   `SELECT *
    FROM instructor_transactions
    WHERE instructor_id=$1
    ORDER BY created_at DESC`,
   [req.user.id]
 );

 res.json(data.rows);
});

module.exports = router;