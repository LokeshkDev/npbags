const { sendError } = require('../utils/response');

function notFound(req, res, next) {
  return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

function errorHandler(err, req, res, next) {
  console.error('[Error Handler]', err);

  // Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 'File size too large. Maximum size allowed is 5MB.', 400);
    }
    return sendError(res, err.message, 400);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  return sendError(res, message, statusCode, process.env.NODE_ENV === 'development' ? err.stack : null);
}

module.exports = {
  notFound,
  errorHandler
};

