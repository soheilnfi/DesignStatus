const express = require("express");
const { pool } = require("../lib/db");
const { requireAuth } = require("../lib/jwt");
const { asyncHandler } = require("../lib/asyncHandler");
const { getUserById, licenseStatus } = require("../lib/users");

const router = express.Router();
const FREE_USES = parseInt(process.env.FREE_USES || "20", 10);

router.get(
  "/check",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: "user_not_found" });
    res.json(licenseStatus(user, FREE_USES));
  })
);

// Called once per edit attempt. No-ops (doesn't consume a credit) if the
// user has an active subscription.
router.post(
  "/increment",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: "user_not_found" });

    const status = licenseStatus(user, FREE_USES);
    if (status.subscribed) {
      return res.json(status);
    }
    if (!status.allowed) {
      return res.json({ allowed: false, subscribed: false, usesLeft: 0 });
    }

    const { rows } = await pool.query(
      `UPDATE users SET uses_count = uses_count + 1 WHERE id = $1 RETURNING *`,
      [user.id]
    );
    res.json(licenseStatus(rows[0], FREE_USES));
  })
);

module.exports = router;
