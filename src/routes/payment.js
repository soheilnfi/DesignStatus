const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../lib/db");
const { requireAuth } = require("../lib/jwt");
const { asyncHandler } = require("../lib/asyncHandler");
const { randomizedAmount, findMatchingTransfer } = require("../lib/tron");
const { walletQrDataUrl } = require("../lib/qr");

const router = express.Router();

const SUBSCRIPTION_DAYS = parseInt(process.env.SUBSCRIPTION_DAYS || "30", 10);
const PRICE_USD = parseFloat(process.env.SUBSCRIPTION_PRICE_USD || "5");
const WALLET_ADDRESS = process.env.USDT_WALLET_ADDRESS;

// Creates a pending payment with a unique exact amount (base price plus a
// small random 6-decimal fraction) and returns the wallet address + a QR
// code of it, so the widget can show "send exactly $X to this address"
// without ever redirecting the user to a third-party payment page.
router.post(
  "/create",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!WALLET_ADDRESS) {
      return res.status(500).json({ error: "wallet_not_configured" });
    }

    const orderId = uuidv4();

    // Regenerate on the rare chance of a collision with another still-open
    // pending payment (same exact amount currently awaited).
    let amount;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = randomizedAmount(PRICE_USD);
      const { rows } = await pool.query(
        `SELECT 1 FROM payments WHERE status = 'pending' AND amount = $1 LIMIT 1`,
        [candidate]
      );
      if (rows.length === 0) {
        amount = candidate;
        break;
      }
    }
    if (!amount) amount = randomizedAmount(PRICE_USD);

    await pool.query(
      `INSERT INTO payments (user_id, order_id, status, amount) VALUES ($1, $2, 'pending', $3)`,
      [req.user.userId, orderId, amount]
    );

    const qr = await walletQrDataUrl(WALLET_ADDRESS);

    res.json({ order_id: orderId, address: WALLET_ADDRESS, amount, qr });
  })
);

// Polled by the widget's popup every ~5 seconds while the paywall is shown.
// No Bearer auth required — same "possession of an unguessable id is the
// capability" pattern as /auth/status, since order_id is a random UUID.
// On each call (until confirmed) we ask TronGrid whether a transfer for the
// exact expected amount has landed yet, and activate the subscription the
// moment one has.
router.get(
  "/status/:orderId",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`SELECT * FROM payments WHERE order_id = $1`, [req.params.orderId]);
    const payment = rows[0];
    if (!payment) return res.status(404).json({ error: "not_found" });

    if (payment.status === "confirmed") {
      return res.json({ confirmed: true });
    }

    if (!WALLET_ADDRESS) {
      return res.status(500).json({ error: "wallet_not_configured" });
    }

    const sinceMs = new Date(payment.created_at).getTime();
    const result = await findMatchingTransfer({
      address: WALLET_ADDRESS,
      expectedAmount: payment.amount,
      sinceMs,
    });

    if (!result.matched) {
      return res.json({ confirmed: false });
    }

    await pool.query(
      `UPDATE payments SET status = 'confirmed', tx_hash = $1, updated_at = now() WHERE id = $2`,
      [result.txHash, payment.id]
    );
    await pool.query(
      `UPDATE users
       SET subscription_active = TRUE,
           subscription_expires_at = GREATEST(COALESCE(subscription_expires_at, now()), now()) + ($1 || ' days')::interval
       WHERE id = $2`,
      [SUBSCRIPTION_DAYS, payment.user_id]
    );

    res.json({ confirmed: true });
  })
);

module.exports = router;
