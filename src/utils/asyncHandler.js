/**
 * Express does not forward rejected promises from async handlers to
 * next(). Wrapping every controller in this removes the need for a
 * try/catch block in each one.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
