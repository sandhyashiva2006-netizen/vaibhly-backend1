const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");
const { sendInvoiceEmail } = require("../services/email.service");
const path = require("path");


/* ================= RAZORPAY INSTANCE ================= */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* ================= CREATE ORDER ================= */
router.post("/create-order", verifyToken, async (req, res) => {
  try {
    const { course_id, coupon_code, discount_amount, use_coins } = req.body;

    if (!course_id) {
      return res.status(400).json({ error: "course_id required" });
    }

    const courseRes = await pool.query(
      "SELECT price FROM courses WHERE id = $1",
      [course_id]
    );

    if (!courseRes.rows.length) {
      return res.status(404).json({ error: "Course not found" });
    }

    let amount = Number(courseRes.rows[0].price);

    console.log("💵 COURSE PRICE:", amount);

    // 🎟 Coupon
    if (discount_amount && Number(discount_amount) > 0) {
      amount = Math.max(0, amount - Number(discount_amount));
    }

    // 🪙 Coins (10 coins = ₹1)
    let coinsUsed = 0;

    if (use_coins && Number(use_coins) > 0) {

      const walletRes = await pool.query(
        "SELECT coins FROM user_wallets WHERE user_id = $1",
        [req.user.id]
      );

      const walletCoins = walletRes.rows[0]?.coins || 0;
      const requestedCoins = Number(use_coins);

      const validCoins = Math.min(requestedCoins, walletCoins);

      const rupeeDiscount = Math.floor(validCoins / 10);

      console.log("🪙 VALID COINS:", validCoins);
      console.log("💸 RUPEE DISCOUNT:", rupeeDiscount);

      if (rupeeDiscount > 0) {
        coinsUsed = rupeeDiscount * 10;
        amount = Math.max(0, amount - rupeeDiscount);
      }
    }

    console.log("💰 FINAL AMOUNT:", amount);

    if (amount <= 0) {
      return res.status(400).json({ error: "Invalid final amount" });
    }

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`
    });

    const orderDb = await pool.query(
      `
      INSERT INTO orders 
      (user_id, course_id, total_amount, razorpay_order_id, status, coins_used)
      VALUES ($1,$2,$3,$4,'PENDING',$5)
      RETURNING id
      `,
      [req.user.id, course_id, amount, order.id, coinsUsed]
    );

    res.json({
      orderId: order.id,
      dbOrderId: orderDb.rows[0].id,
      amount: order.amount,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});


/* ================= VERIFY PAYMENT ================= */
router.post("/verify", verifyToken, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      course_id,
      dbOrderId,
      coupon_code,
      discount_amount
    } = req.body;

    if (!course_id || !dbOrderId) {
      return res.status(400).json({ error: "Missing required data" });
    }

    /* ================= VERIFY SIGNATURE ================= */
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    /* ================= MARK ORDER PAID ================= */
    await pool.query(
      `
      UPDATE orders
      SET 
        payment_id = $1,
        status = 'PAID',
        coupon_code = $3,
        discount_amount = $4
      WHERE id = $2
      `,
      [
        razorpay_payment_id,
        dbOrderId,
        coupon_code || null,
        discount_amount || 0
      ]
    );

    /* ================= COIN DEDUCTION ================= */
    const orderCoins = await pool.query(
      `SELECT coins_used FROM orders WHERE id = $1`,
      [dbOrderId]
    );

    const coinsUsed = orderCoins.rows[0]?.coins_used || 0;

    if (coinsUsed > 0) {
      await pool.query(
        `UPDATE user_wallets
         SET coins = coins - $1
         WHERE user_id = $2`,
        [coinsUsed, req.user.id]
      );

      await pool.query(
        `INSERT INTO coin_transactions (user_id, type, amount)
         VALUES ($1, 'coin_spent', $2)`,
        [req.user.id, -coinsUsed]
      );
    }

    /* ================= ENROLL USER ================= */
    await pool.query(
      `
      INSERT INTO user_courses (user_id, course_id, payment_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, course_id) DO NOTHING
      `,
      [req.user.id, course_id, razorpay_payment_id]
    );

    /* ================= INSTRUCTOR PROFIT SHARE ================= */

const courseInfo = await pool.query(
 `
 SELECT instructor_id, price
 FROM courses
 WHERE id = $1
 `,
 [course_id]
);

const instructorId =
courseInfo.rows[0]?.instructor_id;

const price =
courseInfo.rows[0]?.price || 0;


// ✅ ONLY instructor courses
if (instructorId) {

  const instructorShare = price * 0.30;

  // create wallet if not exists
  await pool.query(`
    INSERT INTO instructor_wallets(instructor_id)
    VALUES($1)
    ON CONFLICT DO NOTHING
  `,[instructorId]);

  // credit wallet
  await pool.query(`
    UPDATE instructor_wallets
    SET balance = balance + $1
    WHERE instructor_id = $2
  `,[instructorShare,instructorId]);

  // transaction history
  await pool.query(`
    INSERT INTO instructor_transactions
    (instructor_id,course_id,amount,type)
    VALUES($1,$2,$3,'credit')
  `,
  [instructorId,course_id,instructorShare]);

}

    /* ================= REFERRAL REWARD ================= */
    try {
      const buyerRes = await pool.query(
        `SELECT referred_by FROM users WHERE id = $1`,
        [req.user.id]
      );

      if (buyerRes.rows.length && buyerRes.rows[0].referred_by) {

        const referrerId = buyerRes.rows[0].referred_by;
        const rewardCoins = 50;

        const alreadyRewarded = await pool.query(
          `SELECT 1 FROM coin_transactions
           WHERE user_id = $1
           AND type = 'referral_bonus'
           AND reference_id = $2`,
          [referrerId, dbOrderId]
        );

        if (!alreadyRewarded.rows.length) {

          await pool.query(
            `UPDATE user_wallets
             SET coins = coins + $1
             WHERE user_id = $2`,
            [rewardCoins, referrerId]
          );

          await pool.query(
            `INSERT INTO coin_transactions (user_id, type, amount, reference_id)
             VALUES ($1, 'referral_bonus', $2, $3)`,
            [referrerId, rewardCoins, dbOrderId]
          );
        }
      }

    } catch (err) {
      console.error("Referral reward error:", err);
    }

    /* ================= INVOICE GENERATION ================= */
    try {
      const invoiceModule = await import("../services/invoice.service.js");
      const generateInvoice = invoiceModule.generateInvoice;

      const invoiceNo = "INV-" + Date.now();

      const orderRes = await pool.query(
        `
        SELECT 
          o.id AS order_id,
          o.total_amount,
          u.name AS student_name,
          u.email,
          c.title AS course_name
        FROM orders o
        JOIN users u ON u.id = o.user_id
        JOIN courses c ON c.id = o.course_id
        WHERE o.id = $1
        `,
        [dbOrderId]
      );

      if (orderRes.rows.length) {

        const info = orderRes.rows[0];

        const invoice = await generateInvoice({
          invoiceNo,
          studentName: info.student_name,
          email: info.email,
          courseName: info.course_name,
          amount: info.total_amount,
          orderId: info.order_id
        });

        await pool.query(
          `
          UPDATE orders
          SET invoice_no = $1,
              invoice_file = $2
          WHERE id = $3
          `,
          [invoiceNo, invoice.fileName, info.order_id]
        );

        /* ================= SEND EMAIL ================= */
        try {
          const invoicePath = path.join(
            __dirname,
            "..",
            "invoices",
            invoice.fileName
          );

          await sendInvoiceEmail({
            to: info.email,
            studentName: info.student_name,
            invoiceNo,
            courseName: info.course_name,
            amount: info.total_amount,
            invoiceFilePath: invoicePath
          });

        } catch (mailErr) {
          console.error("Invoice email failed:", mailErr);
        }
      }

    } catch (invErr) {
      console.error("Invoice generation failed:", invErr);
    }

    /* ================= SUCCESS RESPONSE ================= */
    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      course_id
    });

  } catch (err) {
    console.error("Payment verify error:", err);
    return res.status(500).json({
      success: false,
      error: "Payment verification failed"
    });
  }
});

router.get("/my-courses", verifyToken, async (req, res) => {

  const userId = req.user.id;

  const result = await pool.query(
    "SELECT course_id FROM user_courses WHERE user_id = $1",
    [userId]
  );

  res.json(result.rows);
});

module.exports = router;
