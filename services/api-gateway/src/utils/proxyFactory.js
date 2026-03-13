const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const CONFIG = require('../config/config');

// Proxy middleware factory with circuit breaker pattern
const createServiceProxy = (serviceName, options = {}) => {
    let failureCount = 0;
    let circuitOpen = false;
    const MAX_FAILURES = 5;
    const RESET_TIMEOUT = 30000;

    const proxy = createProxyMiddleware({
        target: CONFIG.services[serviceName],
        changeOrigin: true,
        timeout: 60000, // 60 second timeout
        proxyTimeout: 60000, // 60 second proxy timeout
        ws: options.ws || false, // Only enable WebSocket proxying when explicitly requested
        pathRewrite: options.pathRewrite || undefined,
        onError: (err, req, res) => {
            failureCount++;
            console.error(`Service ${serviceName} error (${failureCount}/${MAX_FAILURES}):`, err.message);

            if (failureCount >= MAX_FAILURES && !circuitOpen) {
                circuitOpen = true;
                console.warn(`[CircuitBreaker] OPEN for service: ${serviceName}`);
                setTimeout(() => {
                    failureCount = 0;
                    circuitOpen = false;
                    console.info(`[CircuitBreaker] CLOSED for service: ${serviceName}`);
                }, RESET_TIMEOUT);
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

    // Circuit breaker wrapper: fast-fail when circuit is open
    return (req, res, next) => {
        if (circuitOpen) {
            return res.status(503).json({
                error: 'Service circuit open — too many failures',
                service: serviceName,
                retryAfter: Math.ceil(RESET_TIMEOUT / 1000),
                timestamp: new Date().toISOString()
            });
        }
        proxy(req, res, next);
    };
};

module.exports = createServiceProxy;
