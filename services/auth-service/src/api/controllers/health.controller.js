const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');

class HealthController {
  constructor(redisClient, healthMonitor) {
    this.redis = redisClient;
    this.healthMonitor = healthMonitor;
  }

  async getHealth(req, res) {
    const [redisResult, tenantResult] = await Promise.allSettled([
      this._checkRedis(),
      this._checkTenantService(),
    ]);

    const redisStatus   = redisResult.status === 'fulfilled'  ? redisResult.value  : { status: 'unhealthy', error: redisResult.reason?.message };
    const tenantStatus  = tenantResult.status === 'fulfilled' ? tenantResult.value : { status: 'unhealthy', error: tenantResult.reason?.message };

    const isHealthy = redisStatus.status === 'healthy' && tenantStatus.status === 'healthy';

    return res.status(200).json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      dependencies: {
        redis:         redisStatus,
        tenantService: tenantStatus,
      },
    });
  }

  async _checkRedis() {
    const start = Date.now();
    try {
      await this.redis.ping();
      return { status: 'healthy', latency: Date.now() - start };
    } catch (err) {
      return { status: 'unhealthy', error: err.message, latency: Date.now() - start };
    }
  }

  async _checkTenantService() {
    const start = Date.now();
    try {
      await axios.get(`${config.tenantService.url}/health`, { timeout: 2000 });
      return { status: 'healthy', latency: Date.now() - start };
    } catch (err) {
      // Tenant Service may not have /health — treat connection refused as unhealthy
      const latency = Date.now() - start;
      if (err.response) {
        // Got a response (even 404) means the service is reachable
        return { status: 'healthy', latency };
      }
      return { status: 'unhealthy', error: err.message, latency };
    }
  }
}

module.exports = { HealthController };
