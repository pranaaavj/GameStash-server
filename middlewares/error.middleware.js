const errorHandler = (err, req, res, next) => {
  const customError = {
    statusCode: err.statusCode || 500,
    message: err.message || 'Something went wrong, Please try again',
  };
  if (err.isJoi) {
    customError.statusCode = 400;
    customError.message = err?.details
      .map((err) => err?.message)
      .join(', ')
      .replace(/['"]+/g, '');
  }
  // Handling mongoose duplicate value errors
  else if (err.code || err.code === 11000) {
    customError.statusCode = 409;
    customError.message = `This ${Object.keys(
      err?.keyValue
    )} already exists, Please log in or enter another ${Object.keys(
      err?.keyValue
    )}.`;
  }
  // Handling mongoose validation error
  else if (err.name === 'ValidationError') {
    customError.statusCode = 400;
    customError.message = Object.values(err?.errors).map((err) => err?.message);
  }
  // Handling JWT validation
  else if (err.name === 'JsonWebTokenError') {
    customError.statusCode = 401;
    customError.message = `Invalid Token, Please login again`;
  }
  // Handling Token Expiration
  else if (err.name === 'TokenExpiredError') {
    customError.statusCode = 401;
    customError.message = 'Your token has expired. Please log in again.';
  }

  res.status(customError.statusCode).json({
    success: false,
    message: customError.message,
    data: null,
  });
};

export default errorHandler;
