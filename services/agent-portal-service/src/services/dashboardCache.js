const config = require('../config');
const logger = require('../utils/logger');
const { createClient } = require('redis');

class DashboardCache {
    constructor() {
        this.client = createClient({
            url: config.redis.url
        });

        this.client.on('error', (err) => logger.error('Redis Client Error (Dashboard)', err));
        this.client.connect().catch(err => logger.error('Redis Connection Error (Dashboard)', err));

        this.TTL = 5 * 60; // 5 minutes
    }

    _getKey(tenantId) {
        return `dashboard:stats:${tenantId}`;
    }

    /**
     * Get cached stats
     * @param {string} tenantId 
     */
    async getStats(tenantId) {
        try {
            const data = await this.client.get(this._getKey(tenantId));
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error('Dashboard cache get error', { error: error.message, tenantId });
            return null;
        }
    }

    /**
     * Cache stats
     * @param {string} tenantId 
     * @param {object} stats 
     */
    async setStats(tenantId, stats) {
        try {
            await this.client.set(this._getKey(tenantId), JSON.stringify(stats), {
                EX: this.TTL
            });
        } catch (error) {
            logger.error('Dashboard cache set error', { error: error.message, tenantId });
        }
    }

    /**
     * Invalidate cache
     * @param {string} tenantId 
     */
    async invalidate(tenantId) {
        try {
            await this.client.del(this._getKey(tenantId));
        } catch (error) {
            logger.error('Dashboard cache del error', { error: error.message, tenantId });
        }
    }
}

module.exports = new DashboardCache();
