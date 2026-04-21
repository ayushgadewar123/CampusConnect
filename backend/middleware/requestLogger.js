const crypto = require('crypto');
const logger = require('../services/logger');

const requestLogger = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.http(`${req.method} ${req.originalUrl}`, {
      requestId,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      userAgent: req.headers['user-agent'] || '',
    });
  });

  next();
};

module.exports = requestLogger;
