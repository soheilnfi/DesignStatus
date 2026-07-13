// Optional standalone migration run: `npm run migrate`. Not required for
// normal operation — app.js also runs this automatically on first request —
// but handy for manually applying schema changes ahead of time.
require("dotenv").config();
const { ensureSchema } = require("./lib/migrate");
const { pool } = require("./lib/db");

ensureSchema()
  .then(() => {
    console.log("Schema applied successfully.");
    return pool.end();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
