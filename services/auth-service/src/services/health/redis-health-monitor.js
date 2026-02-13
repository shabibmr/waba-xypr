const logger = require('../../utils/logger');

class RedisHealthMonitor {
  constructor(redisClient, checkIntervalMs = 5000) {
    this.redis = redisClient;
    this.isHealthy = true;
    this.lastCheck = null;
    this.checkIntervalMs = checkIntervalMs;
    this._timer = null;
  }

  async checkHealth() {
    try {
      await this.redis.ping();

      if (!this.isHealthy) {
        logger.info('Redis recovered — exiting degraded mode');
      }

      this.isHealthy = true;
      this.lastCheck = new Date();
      return true;
    } catch (err) {
      if (this.isHealthy) {
        logger.error('Redis became unhealthy — entering degraded mode', { error: err.message });
      }
      this.isHealthy = false;
      this.lastCheck = new Date();
      return false;
    }
  }

  start() {
    this._timer = setInterval(() => this.checkHealth(), this.checkIntervalMs);
    if (this._timer.unref) this._timer.unref();
    logger.info('Redis health monitor started', { intervalMs: this.checkIntervalMs });
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  getStatus() {
    return { isHealthy: this.isHealthy, lastCheck: this.lastCheck };
  }
}

module.exports = { RedisHealthMonitor };
