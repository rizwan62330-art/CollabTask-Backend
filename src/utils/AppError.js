/**
 * An error carrying an HTTP status code and a machine-readable code, so the
 * central error handler can turn it into a consistent JSON response without
 * every route having to know the response shape.
 */
class AppError extends Error {
  constructor(statusCode, message, { code = "ERROR", details = undefined } = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) {
    return new AppError(400, message, { code: "BAD_REQUEST", details });
  }
  static unauthorized(message = "Authentication required.") {
    return new AppError(401, message, { code: "UNAUTHORIZED" });
  }
  static forbidden(message = "You don't have permission to do that.") {
    return new AppError(403, message, { code: "FORBIDDEN" });
  }
  static notFound(message = "Resource not found.") {
    return new AppError(404, message, { code: "NOT_FOUND" });
  }
  static conflict(message, details) {
    return new AppError(409, message, { code: "CONFLICT", details });
  }
}

module.exports = AppError;
