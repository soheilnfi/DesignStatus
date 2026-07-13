require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const usageRoutes = require("./routes/usage");
const paymentRoutes = require("./routes/payment");
const { ensureSchema } = require("./lib/migrate");

const REQUIRED_ENV = [
  "DATABASE_URL",
  "FIGMA_CLIENT_ID",
  "FIGMA_CLIENT_SECRET",
  "FIGMA_REDIRECT_URI",
  "JWT_SECRET",
  "NOWPAYMENTS_API_KEY",
  "NOWPAYMENTS_IPN_SECRET",
  "APP_URL",
];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn("⚠️  Missing environment variables: " + missing.join(", "));
  console.warn("   Copy .env.example to .env and fill these in before relying on auth/payments.");
}

const app = express();

// The Figma plugin UI calls this API cross-origin without cookies (Bearer
// tokens only), so a permissive CORS policy is fine here.
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("Flow Tracker backend is running."));

// Makes sure the Postgres tables exist before any route touches the DB.
// Cheap no-op on warm instances (see lib/migrate.js).
app.use((req, res, next) => {
  ensureSchema().then(() => next(), next);
});

app.use("/auth", authRoutes);
app.use("/api/usage", usageRoutes);
app.use("/api/payment", paymentRoutes);

// Catch-all error handler: any error forwarded via asyncHandler/next(err)
// (e.g. a database hiccup) ends here as a normal 500 response instead of
// crashing the whole process.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "internal_error" });
});

process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));

module.exports = app;
