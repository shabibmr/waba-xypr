const winston = require('winston');

// Config is loaded lazily to avoid circular dependency
let _config = null;
function getConfig() {
  if (!_config) _config = require('../config');
  return _config;
}

const logger = winston.createLogger({
  get level() { return getConfig().logLevel; },
  defaultMeta: { service: 'auth-service' },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            const metaStr = Object.keys(meta).length
              ? ' ' + JSON.stringify(meta)
              : '';
            return `${timestamp} [${level}] ${message}${metaStr}`;
          })
        )
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
