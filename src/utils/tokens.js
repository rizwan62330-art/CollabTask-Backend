const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

if (!SECRET) {
  // Fail fast and loudly rather than silently signing tokens with `undefined`.
  throw new Error("JWT_SECRET is not set. Copy .env.example to .env and set a value.");
}

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, SECRET, {
    expiresIn: EXPIRES_IN,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, SECRET); // throws JsonWebTokenError / TokenExpiredError on failure
}

module.exports = { signAccessToken, verifyAccessToken };
