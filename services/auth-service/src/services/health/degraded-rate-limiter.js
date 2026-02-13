const logger = require('../../utils/logger');

class DegradedModeRateLimiter {
  constructor(maxRequestsPerMinute = 10) {
    this.requests = new Map();
    this.maxRequestsPerMinute = maxRequestsPerMinute;
  }

  isAllowed(provider, tenantId) {
    const key = `${provider}:${tenantId}`;
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    const timestamps = (this.requests.get(key) || []).filter(ts => ts > oneMinuteAgo);

    if (timestamps.length >= this.maxRequestsPerMinute) {
      logger.warn('Degraded mode rate limit exceeded', {
        provider, tenantId,
        requests: timestamps.length,
        limit: this.maxRequestsPerMinute,
      });
      return false;
    }

    timestamps.push(now);
    this.requests.set(key, timestamps);
    return true;
  }
}

module.exports = { DegradedModeRateLimiter };
