const AppError = require("../utils/AppError");

/**
 * Validates req.body / req.params / req.query against Zod schemas and
 * replaces each with its parsed (and therefore type-coerced/defaulted)
 * value. On failure, responds with a 400 that lists every field error at
 * once rather than stopping at the first one.
 *
 * Usage: validate({ body: createTaskSchema, params: projectIdParamSchema })
 */
function validate(schemas) {
  return (req, res, next) => {
    for (const key of ["params", "query", "body"]) {
      const schema = schemas[key];
      if (!schema) continue;

      const result = schema.safeParse(req[key]);
      if (!result.success) {
        const details = result.error.issues.map((issue) => ({
          field: issue.path.join(".") || key,
          message: issue.message,
        }));
        return next(AppError.badRequest("The request was invalid.", details));
      }
      req[key] = result.data;
    }
    next();
  };
}

module.exports = validate;
