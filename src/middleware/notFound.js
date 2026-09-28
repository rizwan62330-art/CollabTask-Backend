const AppError = require("../utils/AppError");

function notFoundHandler(req, res, next) {
  next(AppError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
}

module.exports = notFoundHandler;
