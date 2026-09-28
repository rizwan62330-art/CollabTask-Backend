const rateLimit = require("express-rate-limit");

/**
 * Login and registration are the two endpoints most worth protecting from
 * brute-force / credential-stuffing attempts. Disabled automatically in
 * tests (NODE_ENV=test) so the test suite isn't rate-limited itself.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: { message: "Too many attempts. Please try again later.", code: "RATE_LIMITED" } },
});

module.exports = { authLimiter };
