const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

/* ================= VALIDATE COUPON ================= */
router.get("/validate", verifyToken, async (req, res) => {
  try {
    const { code, amount } = req.query;

    if (!code) {
      return res.status(400).json({ error: "Coupon code required" });
    }

    const numericAmount = Number(amount || 0);

    const couponRes = await pool.query(
      `SELECT id, code, discount_type, discount_value, is_active 
       FROM coupons 
       WHERE UPPER(code) = UPPER($1)`,
      [code.trim()]
    );

    if (!couponRes.rows.length) {
      return res.status(404).json({ error: "Invalid coupon code" });
    }

    const coupon = couponRes.rows[0];

    if (!coupon.is_active) {
      return res.status(400).json({ error: "Coupon is inactive" });
    }

    const discountValue = Number(coupon.discount_value || 0);
    let discount = 0;

    if (coupon.discount_type === "PERCENT") {
      discount = Math.round((numericAmount * discountValue) / 100);
    } 
    else if (coupon.discount_type === "FLAT") {
      discount = discountValue;
    }

    discount = Math.min(discount, numericAmount);
    const finalAmount = Math.max(0, numericAmount - discount);

    res.json({
      success: true,
      code: coupon.code,
      discount,
      finalAmount,
      coupon_id: coupon.id
    });

  } catch (err) {
    console.error("❌ Coupon validation error:", err);
    res.status(500).json({ error: "Failed to validate coupon" });
  }
});

/* ================= CREATE COUPON (ADMIN) ================= */
router.post("/create", verifyToken, isAdmin, async (req, res) => {
  try {
    const { code, discount_type, discount_value, max_uses, expires_at } = req.body;

    if (!code || !discount_type || !discount_value) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await pool.query(
      `
      INSERT INTO coupons
      (code, discount_type, discount_value, max_uses, expires_at)
      VALUES ($1,$2,$3,$4,$5)
      `,
      [
        code.toUpperCase(),
        discount_type,
        Number(discount_value),
        Number(max_uses || 100),
        expires_at || null
      ]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Create coupon error:", err);
    res.status(500).json({ error: "Failed to create coupon" });
  }
});

/* ================= LIST COUPONS (ADMIN) ================= */
router.get("/list", verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM coupons ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("List coupons error:", err);
    res.status(500).json({ error: "Failed to load coupons" });
  }
});

/* ================= TOGGLE COUPON STATUS ================= */
router.post("/toggle/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`
      UPDATE coupons
      SET is_active = NOT is_active
      WHERE id = $1
    `, [id]);

    res.json({ success: true });

  } catch (err) {
    console.error("Toggle coupon error:", err);
    res.status(500).json({ error: "Failed to update coupon" });
  }
});

/* ================= DELETE COUPON (ADMIN) ================= */
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`DELETE FROM coupons WHERE id = $1`, [id]);

    res.json({ success: true });

  } catch (err) {
    console.error("Delete coupon error:", err);
    res.status(500).json({ error: "Failed to delete coupon" });
  }
});

module.exports = router;
