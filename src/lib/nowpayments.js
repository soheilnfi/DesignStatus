// NOWPayments integration — https://documenter.getpostman.com/view/7907941/S1a32n38
const fetch = require("node-fetch");
const crypto = require("crypto");

const API_BASE = "https://api.nowpayments.io/v1";

async function createInvoice({ orderId, priceUsd, description }) {
  const res = await fetch(`${API_BASE}/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.NOWPAYMENTS_API_KEY,
    },
    body: JSON.stringify({
      price_amount: priceUsd,
      price_currency: "usd",
      pay_currency: process.env.NOWPAYMENTS_PAY_CURRENCY || "usdttrc20",
      order_id: orderId,
      order_description: description,
      ipn_callback_url: `${process.env.APP_URL}/api/payment/webhook`,
      success_url: `${process.env.APP_URL}/payment/success`,
      cancel_url: `${process.env.APP_URL}/payment/cancelled`,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error("nowpayments_create_invoice_failed: " + JSON.stringify(json));
  }
  return json; // { id, invoice_url, order_id, ... }
}

// Recursively sort object keys — required by NOWPayments before hashing the IPN body.
function sortObject(obj) {
  if (Array.isArray(obj)) return obj.map(sortObject);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObject(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}

function verifyIpnSignature(rawBodyObject, signatureHeader) {
  const sorted = sortObject(rawBodyObject);
  const hmac = crypto
    .createHmac("sha512", process.env.NOWPAYMENTS_IPN_SECRET)
    .update(JSON.stringify(sorted))
    .digest("hex");
  return hmac === signatureHeader;
}

module.exports = { createInvoice, verifyIpnSignature };
