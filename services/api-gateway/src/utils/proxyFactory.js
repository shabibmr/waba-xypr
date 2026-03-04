const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const CONFIG = require('../config/config');

// Proxy middleware factory with circuit breaker pattern
const createServiceProxy = (serviceName, options = {}) => {
    let failureCount = 0;
    const MAX_FAILURES = 5;
    const RESET_TIMEOUT = 30000;

    return createProxyMiddleware({
        target: CONFIG.services[serviceName],
        changeOrigin: true,
        timeout: 60000, // 60 second timeout
        proxyTimeout: 60000, // 60 second proxy timeout
        ws: options.ws || false, // Only enable WebSocket proxying when explicitly requested
        pathRewrite: options.pathRewrite || undefined,
        onError: (err, req, res) => {
            failureCount++;
            console.error(`Service ${serviceName} error:`, err.message);

            if (failureCount >= MAX_FAILURES) {
                setTimeout(() => { failureCount = 0; }, RESET_TIMEOUT);
            }

            // Don't send response if headers already sent
            if (!res.headersSent) {
                res.status(503).json({
                    error: 'Service temporarily unavailable',
                    service: serviceName,
                    timestamp: new Date().toISOString()
                });
            }
        },
        onProxyReq: (proxyReq, req, res) => {
            // Add request ID for tracing
            proxyReq.setHeader('X-Request-ID', req.headers['x-request-id'] ||
                `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

            // Add source info
            proxyReq.setHeader('X-Forwarded-By', 'api-gateway');

            // Re-stream body parsed by express.json() using HPM's built-in helper
            fixRequestBody(proxyReq, req);
        }
    });
};

module.exports = createServiceProxy;
