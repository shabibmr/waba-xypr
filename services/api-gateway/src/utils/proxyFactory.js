const { createProxyMiddleware } = require('http-proxy-middleware');
const CONFIG = require('../config/config');

// Proxy middleware factory with circuit breaker pattern
const createServiceProxy = (serviceName) => {
    let failureCount = 0;
    const MAX_FAILURES = 5;
    const RESET_TIMEOUT = 30000;

    return createProxyMiddleware({
        target: CONFIG.services[serviceName],
        changeOrigin: true,
        onError: (err, req, res) => {
            failureCount++;
            console.error(`Service ${serviceName} error:`, err.message);

            if (failureCount >= MAX_FAILURES) {
                setTimeout(() => { failureCount = 0; }, RESET_TIMEOUT);
            }

            res.status(503).json({
                error: 'Service temporarily unavailable',
                service: serviceName,
                timestamp: new Date().toISOString()
            });
        },
        onProxyReq: (proxyReq, req, res) => {
            // Add request ID for tracing
            proxyReq.setHeader('X-Request-ID', req.headers['x-request-id'] ||
                `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

            // Add source info
            proxyReq.setHeader('X-Forwarded-By', 'api-gateway');
        }
    });
};

module.exports = createServiceProxy;
