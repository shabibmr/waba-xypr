const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const dashboardCache = require('../services/dashboardCache');
const socketEmitter = require('../services/socketEmitter');
const ERROR_CODES = require('../utils/errorCodes');
const AppError = require('../utils/AppError');

/**
 * Get aggregated stats (cached)
 */
async function getStats(req, res, next) {
    try {
        const { tenant_id } = req.user;

        // 1. Check cache
        const cached = await dashboardCache.getStats(tenant_id);
        if (cached) {
            return res.json({ ...cached, source: 'cache' });
        }

        // 2. Fetch from State Manager
        // In a real implementation effectively calling state-manager aggregation API
        // For MVP, we might simulate or make multiple calls if aggregation API missing

        const stateManagerUrl = config.services.stateManager;

        // Parallel fetch for MVP if no single aggregation endpoint exists
        // (Assuming State Manager has these endpoints or we build them)
        // const [conversations, messages] = await Promise.all([...]);

        // Mocking the response for MVP until State Manager implements /stats endpoint
        // Or strictly calling State Manager if available

        let stats = {
            activeConversations: 0,
            waitingConversations: 0,
            totalMessagesToday: 0,
            avgResponseTime: 0,
            timestamp: new Date().toISOString()
        };

        try {
            const response = await axios.get(`${stateManagerUrl}/stats/summary`, {
                headers: { 'X-Tenant-ID': tenant_id }
            });
            stats = response.data;
        } catch (error) {
            logger.warn('Failed to fetch stats from State Manager, returning default', { error: error.message });
            // We don't throw error to allow dashboard to load with zeros/partial data
        }

        // 3. Cache result
        await dashboardCache.setStats(tenant_id, stats);

        // 4. Emit metrics update to connected clients
        socketEmitter.emitMetricsUpdate(tenant_id, stats);

        res.json({ ...stats, source: 'live' });
    } catch (error) {
        next(error);
    }
}

/**
 * Get historical metrics
 */
async function getMetrics(req, res, next) {
    try {
        const { tenant_id } = req.user;
        const { from, to, metric, interval } = req.query;

        logger.info('Fetching metrics', { tenantId: tenant_id, from, to, metric });

        const stateManagerUrl = config.services.stateManager;

        // Forward query to State Manager's analytics endpoint
        // If State Manager doesn't have it, we'd need to query raw data and aggregate here
        // Assuming State Manager has /analytics/metrics

        try {
            const response = await axios.get(`${stateManagerUrl}/analytics/metrics`, {
                headers: { 'X-Tenant-ID': tenant_id },
                params: { from, to, metric, interval }
            });
            res.json(response.data);
        } catch (error) {
            logger.error('Metrics fetch failed', { error: error.message });
            throw new AppError('Failed to fetch metrics', 502, ERROR_CODES.DASH_001);
        }
    } catch (error) {
        next(error);
    }
}

/**
 * Force refresh stats
 */
async function refreshStats(req, res, next) {
    try {
        const { tenant_id } = req.user;
        await dashboardCache.invalidate(tenant_id);

        // Re-fetch stats from State Manager
        const stateManagerUrl = config.services.stateManager;
        let stats = {
            activeConversations: 0,
            waitingConversations: 0,
            totalMessagesToday: 0,
            avgResponseTime: 0,
            timestamp: new Date().toISOString()
        };

        try {
            const response = await axios.get(`${stateManagerUrl}/stats/summary`, {
                headers: { 'X-Tenant-ID': tenant_id }
            });
            stats = response.data;
        } catch (error) {
            logger.warn('Failed to fetch stats from State Manager during refresh', { error: error.message });
        }

        // Cache the refreshed stats
        await dashboardCache.setStats(tenant_id, stats);

        // Emit metrics update to connected clients
        socketEmitter.emitMetricsUpdate(tenant_id, stats);

        res.json({ success: true, message: 'Stats refreshed', stats });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getStats,
    getMetrics,
    refreshStats
};
