const { pool } = require("./db");

// Comma-separated list of Figma account emails that always get unlimited
// access (no free-use limit, no payment required). Meant for the widget's
// own developer/owner account(s). Empty by default — safe no-op if unset.
function isAdminEmail(email) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!email && admins.includes(String(email).toLowerCase());
}

async function upsertUserFromFigma({ figmaId, email, name }) {
  const { rows } = await pool.query(
    `INSERT INTO users (figma_id, email, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (figma_id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
     RETURNING *`,
    [figmaId, email, name]
  );
  return rows[0];
}

async function getUserById(id) {
  const { rows } = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

function licenseStatus(user, freeUses) {
  if (isAdminEmail(user.email)) {
    return { allowed: true, subscribed: true, usesLeft: null, admin: true };
  }

  const subscribed =
    user.subscription_active &&
    user.subscription_expires_at &&
    new Date(user.subscription_expires_at) > new Date();

  if (subscribed) {
    return { allowed: true, subscribed: true, usesLeft: null };
  }
  const usesLeft = Math.max(0, freeUses - user.uses_count);
  return { allowed: usesLeft > 0, subscribed: false, usesLeft };
}

module.exports = { upsertUserFromFigma, getUserById, licenseStatus, isAdminEmail };
