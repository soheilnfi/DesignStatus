const jwt = require("jsonwebtoken");

function signUserToken(user) {
  return jwt.sign(
    { userId: user.id, figmaId: user.figma_id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "30d" }
  );
}

function verifyUserToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// Express middleware: requires `Authorization: Bearer <token>`
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing_token" });
  try {
    req.user = verifyUserToken(token);
    next();
  } catch (e) {
    return res.status(401).json({ error: "invalid_token" });
  }
}

module.exports = { signUserToken, verifyUserToken, requireAuth };
