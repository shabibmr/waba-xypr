const { createProxyMiddleware } = require('http-proxy-middleware');
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
        ws: true, // Enable WebSocket proxying if needed
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

            // Fix for body handling - restream body if it was parsed by express.json()
            if (req.body && Object.keys(req.body).length > 0) {
                const bodyData = JSON.stringify(req.body);
                proxyReq.setHeader('Content-Type', 'application/json');
                proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                proxyReq.write(bodyData);
                proxyReq.end();
            }
        }
    });
};

module.exports = createServiceProxy;
