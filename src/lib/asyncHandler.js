// Wraps an async Express route handler so a rejected promise (e.g. a DB
// connection error) is forwarded to Express's error handler instead of
// crashing the whole process as an unhandled rejection.
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
