const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

let schemaPromise = null;

// Idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS only),
// and memoized per warm serverless instance so it only actually runs once
// per cold start.
function ensureSchema() {
  if (!schemaPromise) {
    const sql = fs.readFileSync(path.join(__dirname, "..", "..", "schema.sql"), "utf8");
    schemaPromise = pool.query(sql).catch((err) => {
      schemaPromise = null; // allow retrying on the next request if it failed
      throw err;
    });
  }
  return schemaPromise;
}

module.exports = { ensureSchema };
