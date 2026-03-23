const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
 verifyToken,
 isInstructor
} = require("../middleware/auth.middleware");

// ==============================
// INSTRUCTOR REGISTER
// ==============================
router.post("/instructor/register", async (req,res)=>{

 try{

   const {
     name,
     username,
     email,
     password
   } = req.body;

   if(!name || !username || !email || !password){
     return res.status(400)
       .json({error:"All fields required"});
   }

   // username check
   const userCheck = await pool.query(
     "SELECT id FROM users WHERE username=$1",
     [username]
   );

   if(userCheck.rows.length){
     return res.status(400)
       .json({error:"Username already exists"});
   }

   const hashed =
     await bcrypt.hash(password,10);

   const user = await pool.query(
     `
     INSERT INTO users
     (name,username,email,password,role)
     VALUES($1,$2,$3,$4,'instructor')
     RETURNING id,name,username,email
     `,
     [name,username,email,hashed]
   );

   res.json(user.rows[0]);

 }catch(err){
   console.error(
     "Instructor register error:",
     err
   );

   res.status(500)
     .json({error:"Register failed"});
 }

});


// ==============================
// INSTRUCTOR LOGIN
// ==============================
router.post("/instructor/login", async(req,res)=>{

 try{

   const { email,password } = req.body;

   const result = await pool.query(
     "SELECT * FROM users WHERE email=$1",
     [email]
   );

   const user = result.rows[0];

   if(!user)
     return res.status(400).json({msg:"User not found"});

   if(user.role !== "instructor")
     return res.status(403)
       .json({msg:"Not instructor account"});

   const valid =
     await bcrypt.compare(password,user.password);

   if(!valid)
     return res.status(400)
       .json({msg:"Wrong password"});

   const token = jwt.sign(
     { id:user.id, role:user.role },
     process.env.JWT_SECRET
   );

   res.json({token,user});

 }catch(err){
   console.error(err);
 }

});


router.get(
"/instructor/wallet",
verifyToken,
isInstructor,
async(req,res)=>{

 const result =
 await pool.query(`
 SELECT COALESCE(SUM(amount),0) AS balance
 FROM instructor_transactions
 WHERE instructor_id=$1
 AND type='credit'
 `,
 [req.user.id]);

 res.json({
   balance: Number(result.rows[0].balance)
 });

});

router.get("/instructor/transactions",
verifyToken,
async(req,res)=>{

 const tx = await pool.query(`
SELECT
 t.amount,
 t.created_at,
 c.title AS course_title
FROM instructor_transactions t
LEFT JOIN courses c
ON c.id = t.course_id
WHERE t.instructor_id=$1
ORDER BY t.created_at DESC
`,
[req.user.id]);

res.json(tx.rows);
});

router.post("/instructor/withdraw",
verifyToken,
async(req,res)=>{

 try{

 const instructorId = req.user.id;
 const { amount } = req.body;

 // ===============================
 // CHECK PAYMENT DETAILS
 // ===============================

 const payment = await pool.query(
 `SELECT id
  FROM instructor_payment_details
  WHERE instructor_id=$1`,
 [instructorId]
 );

 if(payment.rows.length === 0){
  return res.status(400).json({
   error:"Please add bank or UPI details first"
  });
 }

 // ===============================
 // MINIMUM WITHDRAW
 // ===============================

 if(amount < 500){
  return res.status(400).json({
   error:"Minimum withdraw amount is ₹500"
  });
 }

 // ===============================
 // CHECK WALLET BALANCE
 // ===============================

 const wallet = await pool.query(
 `SELECT balance
  FROM instructor_wallet
  WHERE instructor_id=$1`,
 [instructorId]
 );

 const balance = wallet.rows[0]?.balance || 0;

 if(amount > balance){
  return res.status(400).json({
   error:"Insufficient wallet balance"
  });
 }

 // ===============================
 // INSERT WITHDRAW REQUEST
 // ===============================

 await pool.query(`
 INSERT INTO withdrawal_requests
 (instructor_id,amount,status)
 VALUES($1,$2,'pending')
 `,[instructorId,amount]);

 // ===============================
 // ADMIN NOTIFICATION
 // ===============================

 await pool.query(`
 INSERT INTO admin_notifications
 (type,message)
 VALUES('withdraw_request',$1)
 `,[`Instructor ${instructorId} requested withdrawal ₹${amount}`]);

 res.json({message:"Withdrawal request submitted"});

 }catch(err){

 console.error(err);
 res.status(500).json({
  error:"Withdraw request failed"
 });

 }

});

router.post("/instructor/payment-details",
verifyToken,
async(req,res)=>{

 try{

 const instructorId = req.user.id;

 const {
  account_holder_name,
  bank_name,
  account_number,
  ifsc_code,
  upi_id
 } = req.body;

 const existing = await pool.query(
 `SELECT id
  FROM instructor_payment_details
  WHERE instructor_id=$1`,
 [instructorId]
 );

 if(existing.rows.length>0){

 await pool.query(
 `UPDATE instructor_payment_details
  SET
  account_holder_name=$1,
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
  instructorId
 ]);

 }else{

 await pool.query(
 `INSERT INTO instructor_payment_details
 (instructor_id,account_holder_name,bank_name,account_number,ifsc_code,upi_id)
 VALUES($1,$2,$3,$4,$5,$6)`,
 [
  instructorId,
  account_holder_name,
  bank_name,
  account_number,
  ifsc_code,
  upi_id
 ]);

 }

 res.json({message:"Payment details saved"});

 }catch(err){

 console.error(err);
 res.status(500).json({
  error:"Failed to save payment details"
 });

 }

});

router.get("/instructor/payment-details",
verifyToken,
async(req,res)=>{

 try{

 const instructorId = req.user.id;

 const result = await pool.query(
 `SELECT *
  FROM instructor_payment_details
  WHERE instructor_id=$1`,
 [instructorId]
 );

 res.json(result.rows[0] || {});

 }catch(err){

 console.error(err);
 res.status(500).json({
  error:"Failed to load payment details"
 });

 }

});

router.get("/instructor/course-analytics", verifyToken, async(req,res)=>{

 try{

 const instructorId = req.user.id;

 const result = await pool.query(`
 SELECT 
 c.id,
 c.title,
 COUNT(t.id) AS students,
 COALESCE(SUM(t.amount),0) AS revenue
 FROM courses c
 LEFT JOIN instructor_transactions t
 ON t.course_id = c.id
 WHERE c.instructor_id = $1
 GROUP BY c.id
 `,[instructorId]);

 res.json(result.rows);

 }catch(err){

 console.error("Course analytics error:",err);
 res.status(500).json({error:"Analytics failed"});

 }

});

router.get("/instructor/revenue", verifyToken, async(req,res)=>{

 try{

 const instructorId = req.user.id;

 const result = await pool.query(`
 SELECT 
 TO_CHAR(created_at,'Mon') AS month,
 SUM(amount) AS total
 FROM instructor_transactions
 WHERE instructor_id=$1
 GROUP BY month
 ORDER BY MIN(created_at)
 `,[instructorId]);

 const months = result.rows.map(r=>r.month);
 const amounts = result.rows.map(r=>r.total);

 res.json({months,amounts});

 }catch(err){

 console.error("Revenue error:",err);
 res.status(500).json({error:"Revenue failed"});

 }

});

router.get("/instructor/withdraw-history", verifyToken, async (req,res)=>{

const instructorId = req.user.id;

try{

const result = await pool.query(`
SELECT amount,status,created_at
FROM withdrawal_requests
WHERE instructor_id=$1
ORDER BY created_at DESC
`,[instructorId]);

res.json(result.rows);

}catch(err){

console.error(err);
res.status(500).json({error:"Withdraw history failed"});

}

});

router.post("/instructor/course", verifyToken, async (req,res)=>{

try{

const instructorId = req.user.id;

const { title, description, price } = req.body;

const result = await pool.query(`
INSERT INTO courses
(title, description, price, instructor_id)
VALUES ($1,$2,$3,$4)
RETURNING *
`,[
title,
description,
price,
instructorId
]);

res.json(result.rows[0]);

}catch(err){

console.error("Create course error:",err);
res.status(500).json({error:"Course creation failed"});

}

});

// routes/instructor.routes.js (or wherever your publish route is)

router.post("/instructor/course/:id/publish", verifyToken, async (req,res)=>{

const {id} = req.params;

try{

const check = await pool.query(
`SELECT COUNT(*) FROM exam_questions WHERE course_id=$1`,
[id]
);

if(Number(check.rows[0].count) === 0){

 return res.status(400).json({
 message:"Add exam questions before publishing"
 });

}

await pool.query(
`UPDATE courses SET published=true WHERE id=$1`,
[id]
);

res.json({message:"Course published successfully"});

}catch(err){

console.error(err);
res.status(500).json({message:"Publish failed"});

}

});

router.get("/instructor/course/:id", verifyToken, async (req,res)=>{

const {id} = req.params;

try{

const result = await pool.query(
`SELECT id,title FROM courses WHERE id=$1`,
[id]
);

if(result.rows.length === 0){
 return res.status(404).json({error:"Course not found"});
}

res.json(result.rows[0]);

}catch(err){

console.error(err);
res.status(500).json({error:"Failed to load course"});

}

});

router.delete("/instructor/course/:id", verifyToken, async (req,res)=>{

const { id } = req.params;

try{

/* 1️⃣ delete exam questions */
await pool.query(
`DELETE FROM exam_questions WHERE course_id=$1`,
[id]
);

/* 2️⃣ delete lessons */
await pool.query(`
DELETE FROM course_lessons
WHERE module_id IN (
  SELECT id FROM course_modules WHERE course_id=$1
)
`,[id]);

/* 3️⃣ delete modules */
await pool.query(
`DELETE FROM course_modules WHERE course_id=$1`,
[id]
);

/* 4️⃣ delete course */
await pool.query(
`DELETE FROM courses WHERE id=$1`,
[id]
);

res.json({success:true});

}catch(err){

console.error("Delete course error:",err);
res.status(500).json({error:"Delete failed"});

}

});

router.delete("/exam/question/:id", verifyToken, async (req,res)=>{

const { id } = req.params;

try{

await pool.query(
`DELETE FROM exam_questions WHERE id=$1`,
[id]
);

res.json({success:true});

}catch(err){

console.error(err);
res.status(500).json({error:"Delete failed"});

}

});

module.exports = router;