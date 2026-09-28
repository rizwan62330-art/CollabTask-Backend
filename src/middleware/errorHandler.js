const AppError = require("../utils/AppError");

/**
 * Every error in the app ends up here (thrown in a route wrapped with
 * asyncHandler, passed to next(), or a bug that throws synchronously).
 * The response shape is always { error: { message, code, details? } } so
 * API consumers can rely on one format regardless of what went wrong.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) },
    });
  }

  // better-sqlite3 surfaces constraint violations as SqliteError with a `code`.
  if (err.code === "SQLITE_CONSTRAINT_UNIQUE" || err.code === "SQLITE_CONSTRAINT") {
    return res.status(409).json({ error: { message: "That conflicts with an existing record.", code: "CONFLICT" } });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: { message: "Malformed JSON in request body.", code: "BAD_REQUEST" } });
  }

  // Anything else is unexpected: log the full error server-side, but never
  // leak internals (stack traces, SQL, file paths) to the client.
  console.error(err);
  const isDev = process.env.NODE_ENV === "development";
  return res.status(500).json({
    error: {
      message: "Something went wrong on our end.",
      code: "INTERNAL_ERROR",
      ...(isDev ? { details: err.message, stack: err.stack } : {}),
    },
  });
}

module.exports = errorHandler;
