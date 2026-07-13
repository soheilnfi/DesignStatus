const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../lib/db");
const { buildAuthorizeUrl, exchangeCodeForToken, getMe } = require("../lib/figma");
const { upsertUserFromFigma } = require("../lib/users");
const { signUserToken } = require("../lib/jwt");
const { asyncHandler } = require("../lib/asyncHandler");

const router = express.Router();

// Step 1: the plugin opens this in a real browser popup window.
router.get(
  "/figma/start",
  asyncHandler(async (req, res) => {
    const sessionId = req.query.session;
    if (!sessionId) return res.status(400).send("Missing session parameter.");

    const state = uuidv4();
    await pool.query(
      `INSERT INTO auth_sessions (session_id, state, status)
     VALUES ($1, $2, 'pending')
     ON CONFLICT (session_id) DO UPDATE SET state = EXCLUDED.state, status = 'pending', token = NULL`,
      [sessionId, state]
    );

    res.redirect(buildAuthorizeUrl(state));
  })
);

// Step 2: Figma redirects here after the user clicks "Allow access".
router.get("/figma/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.send(renderResultPage(false, "Access denied. Close this window and try again from the plugin."));
  }
  if (!code || !state) {
    return res.status(400).send(renderResultPage(false, "Invalid request."));
  }

  try {
    const { rows } = await pool.query(`SELECT * FROM auth_sessions WHERE state = $1`, [state]);
    const session = rows[0];
    if (!session) {
      return res.status(400).send(renderResultPage(false, "Sign-in session not found or expired."));
    }

    // Figma's authorization code expires 30s after issue, so exchange immediately.
    const tokenResp = await exchangeCodeForToken(code);
    const me = await getMe(tokenResp.access_token);

    const user = await upsertUserFromFigma({
      figmaId: me.id,
      email: me.email,
      name: me.handle,
    });

    const appToken = signUserToken(user);

    await pool.query(
      `UPDATE auth_sessions SET status = 'done', token = $1 WHERE session_id = $2`,
      [appToken, session.session_id]
    );

    return res.send(renderResultPage(true, "Signed in! Close this window and return to Figma."));
  } catch (err) {
    console.error(err);
    return res.status(500).send(renderResultPage(false, "Something went wrong. Please try again."));
  }
});

// Step 3: the plugin polls this until the callback above has finished.
router.get(
  "/status",
  asyncHandler(async (req, res) => {
    const sessionId = req.query.session;
    if (!sessionId) return res.status(400).json({ status: "error" });

    const { rows } = await pool.query(`SELECT status, token FROM auth_sessions WHERE session_id = $1`, [
      sessionId,
    ]);
    const session = rows[0];
    if (!session) return res.json({ status: "pending" });
    if (session.status === "done") return res.json({ status: "done", token: session.token });
    return res.json({ status: session.status });
  })
);

function renderResultPage(success, message) {
  const accent = success ? "#0acf83" : "#e0393e";
  const icon = success
    ? '<path d="M20 6 9 17l-5-5"/>'
    : '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Flow Tracker</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: linear-gradient(160deg, #f6f7fb 0%, #ece7ff 100%);
    display: flex; align-items: center; justify-content: center;
  }
  .card {
    background: #fff; border-radius: 20px; padding: 40px 36px;
    box-shadow: 0 20px 50px rgba(23, 24, 41, 0.14);
    max-width: 360px; text-align: center;
    animation: rise .35s ease-out;
  }
  @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .badge {
    width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px;
    background: ${accent}1a; display: flex; align-items: center; justify-content: center;
  }
  .badge svg { width: 28px; height: 28px; color: ${accent}; }
  h2 { margin: 0 0 8px; font-size: 18px; color: #16181d; }
  p { margin: 0; color: #7c8798; font-size: 13.5px; line-height: 1.6; }
  .hint { margin-top: 18px; font-size: 11.5px; color: #b9c0cc; }
</style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
    </div>
    <h2>${success ? "You're signed in" : "Something went wrong"}</h2>
    <p>${message}</p>
    <div class="hint">This window closes automatically…</div>
  </div>
  <script>setTimeout(() => window.close(), 2500);</script>
</body>
</html>`;
}

module.exports = router;
