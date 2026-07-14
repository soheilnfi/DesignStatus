// Direct on-chain USDT-TRC20 payment confirmation — no third-party payment
// gateway. We ask the payer to send an exact, uniquely-suffixed amount
// (e.g. 5.000123 instead of a flat 5) to our own wallet address, then poll
// TronGrid (a public Tron block explorer API) for a matching incoming
// transfer. This is what disambiguates two people paying the same address
// around the same time, without needing an account with any payment
// processor.
const fetch = require("node-fetch");

const USDT_CONTRACT_MAINNET = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRONGRID_BASE = "https://api.trongrid.io";
const USDT_DECIMALS = 6;

// Generates a unique amount by adding a small random fraction (1 to 999999
// millionths of a dollar) on top of the base subscription price. Formatted
// to exactly 6 decimal places, matching USDT-TRC20's on-chain precision.
function randomizedAmount(baseUsd) {
  const fractionUnits = 1 + Math.floor(Math.random() * 999999);
  const amount = Number(baseUsd) + fractionUnits / 10 ** USDT_DECIMALS;
  return amount.toFixed(USDT_DECIMALS);
}

// Looks for an incoming TRC20 USDT transfer to `address` matching
// `expectedAmount` (string, 6 decimals) that arrived after `sinceMs`.
// Returns { matched: true, txHash } or { matched: false }.
async function findMatchingTransfer({ address, expectedAmount, sinceMs }) {
  const url =
    `${TRONGRID_BASE}/v1/accounts/${address}/transactions/trc20` +
    `?limit=50&contract_address=${USDT_CONTRACT_MAINNET}&only_to=true&order_by=block_timestamp,desc`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`tron_grid_request_failed: ${res.status}`);
  }
  const json = await res.json();
  const transfers = Array.isArray(json.data) ? json.data : [];

  const expected = Number(expectedAmount);
  const EPSILON = 5e-7; // half of the smallest USDT unit, to absorb float rounding

  for (const tx of transfers) {
    if (!tx.to || tx.to !== address) continue;
    if (typeof tx.block_timestamp === "number" && tx.block_timestamp < sinceMs) continue;
    const value = Number(tx.value) / 10 ** USDT_DECIMALS;
    if (Math.abs(value - expected) < EPSILON) {
      return { matched: true, txHash: tx.transaction_id };
    }
  }
  return { matched: false };
}

module.exports = { randomizedAmount, findMatchingTransfer };
