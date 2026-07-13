const { pool } = require("./db");

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

module.exports = { upsertUserFromFigma, getUserById, licenseStatus };
