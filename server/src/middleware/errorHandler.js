/**
 * Create a structured API error.
 * @param {string} code - Machine-readable error code
 * @param {string} message - Human-readable message
 * @param {number} statusCode - HTTP status code
 * @param {*} details - Optional extra details
 */
export function createError(code, message, statusCode = 500, details = null) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  if (details) err.details = details;
  return err;
}

/**
 * Express global error handler — must be last middleware.
 */
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = statusCode === 500
    ? 'An unexpected error occurred.'
    : err.message;

  if (statusCode === 500) {
    console.error(`[ERROR] ${err.message}`, err.stack);
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}
