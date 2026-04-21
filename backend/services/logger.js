const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');
const logFile = path.join(logsDir, 'app.log');

function ensureDir() {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
}

function serialize(meta) {
  if (meta === undefined) return '';
  if (typeof meta === 'string') return meta;
  try {
    return JSON.stringify(meta);
  } catch {
    return '[unserializable]';
  }
}

function write(level, message, meta) {
  ensureDir();
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    meta: meta === undefined ? undefined : meta,
  });
  fs.appendFile(logFile, `${line}\n`, () => {});
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[${level.toUpperCase()}] ${message}${meta !== undefined ? ` ${serialize(meta)}` : ''}`);
}

module.exports = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  http: (message, meta) => write('info', message, meta),
};
