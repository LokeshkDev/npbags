function sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

function sendError(res, message = 'Something went wrong', statusCode = 400, errors = null) {
  const payload = {
    success: false,
    message
  };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
}

module.exports = {
  sendSuccess,
  sendError
};

