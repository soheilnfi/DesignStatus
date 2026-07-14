const express = require("express");
const { pool } = require("../lib/db");
const { requireAuth } = require("../lib/jwt");
const { asyncHandler } = require("../lib/asyncHandler");
const { createInvoice, verifyIpnSignature } = require("../lib/nowpayments");

const router = express.Router();

const SUCCESS_STATUSES = new Set(["finished", "confirmed"]);
const SUBSCRIPTION_DAYS = parseInt(process.env.SUBSCRIPTION_DAYS || "30", 10);
const PRICE_USD = parseFloat(process.env.SUBSCRIPTION_PRICE_USD || "5");

router.post(
  "/create",
  requireAuth,
  asyncHandler(async (req, res) => {
    const orderId = `user_${req.user.userId}_${Date.now()}`;
    const invoice = await createInvoice({
      orderId,
      priceUsd: PRICE_USD,
      description: "Design Status – monthly subscription",
    });

    await pool.query(
      `INSERT INTO payments (user_id, order_id, np_payment_id, status, amount)
       VALUES ($1, $2, $3, 'pending', $4)`,
      [req.user.userId, orderId, String(invoice.id || ""), PRICE_USD]
    );

    res.json({ invoice_url: invoice.invoice_url, order_id: orderId });
  })
);

// NOWPayments IPN webhook — configure this exact URL in your NOWPayments
// dashboard / pass it as ipn_callback_url (already done in lib/nowpayments.js).
router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    const signature = req.headers["x-nowpayments-sig"];
    if (!signature || !verifyIpnSignature(req.body, signature)) {
      return res.status(401).send("invalid signature");
    }

    const { order_id, payment_status } = req.body;
    if (!order_id) return res.status(400).send("missing order_id");

    const { rows } = await pool.query(`SELECT * FROM payments WHERE order_id = $1`, [order_id]);
    const payment = rows[0];
    if (!payment) return res.status(404).send("payment not found");

    await pool.query(`UPDATE payments SET status = $1, updated_at = now() WHERE order_id = $2`, [
      payment_status,
      order_id,
    ]);

    if (SUCCESS_STATUSES.has(payment_status)) {
      await pool.query(
        `UPDATE users
       SET subscription_active = TRUE,
           subscription_expires_at = GREATEST(COALESCE(subscription_expires_at, now()), now()) + ($1 || ' days')::interval
       WHERE id = $2`,
        [SUBSCRIPTION_DAYS, payment.user_id]
      );
    }

    res.status(200).send("ok");
  })
);

module.exports = router;
