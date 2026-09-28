const { verifyAccessToken } = require("../utils/tokens");
const AppError = require("../utils/AppError");
const usersRepo = require("../modules/users/users.repository");

/**
 * Verifies the Authorization: Bearer <token> header and attaches the
 * authenticated user (without the password hash) to req.user. Every route
 * under /api/v1 except /auth/register, /auth/login, and /health requires
 * this.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(AppError.unauthorized("Missing or malformed Authorization header."));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    const message = err.name === "TokenExpiredError" ? "Your session has expired. Please log in again." : "Invalid access token.";
    return next(AppError.unauthorized(message));
  }

  const user = usersRepo.findById(payload.sub);
  if (!user) {
    return next(AppError.unauthorized("The user for this token no longer exists."));
  }

  req.user = user; // { id, name, email, createdAt } — no password hash
  next();
}

module.exports = requireAuth;
