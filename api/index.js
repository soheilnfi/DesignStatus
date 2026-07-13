// Vercel serverless entrypoint. An Express app instance is itself a valid
// (req, res) handler, so we can export it directly — Vercel's Node runtime
// calls this for every request that vercel.json rewrites to /api/index.
module.exports = require("../src/app");
