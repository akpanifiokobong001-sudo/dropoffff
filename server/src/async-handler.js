// Wraps an async Express handler/middleware so a rejected promise is forwarded
// to the error-handling middleware. Express 4 does not do this automatically,
// so without it a DB error inside an async handler would hang the request.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}
