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
  const fileTooLarge = err?.code === 'LIMIT_FILE_SIZE';
  const statusCode = fileTooLarge ? 413 : (err.statusCode || 500);
  const code = fileTooLarge ? 'IMPORT_FILE_TOO_LARGE' : (err.code || 'INTERNAL_ERROR');
  const message = fileTooLarge
    ? 'CSV files must be 5 MB or smaller.'
    : statusCode === 500
    ? 'An unexpected error occurred.'
    : err.message;

  if (statusCode === 500) {
    console.error('Unhandled API error.', {
      code,
      method: req?.method ?? 'UNKNOWN',
      path: req?.originalUrl ?? req?.path ?? 'UNKNOWN',
    });
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}
