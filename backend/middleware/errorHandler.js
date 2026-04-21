const logger = require('../services/logger');

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : err.statusCode || 500;
  const message = err.message || 'Server error';

  logger.error(message, {
    requestId: req?.requestId,
    path: req?.originalUrl,
    method: req?.method,
    statusCode,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });

  res.status(statusCode).json({
    message: statusCode === 500 ? 'Server error' : message,
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
  });
};

module.exports = errorHandler;
