const helmet = require('helmet');
const cors = require('cors');
const CONFIG = require('../config/config');

const securityMiddleware = [
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "script-src": ["'self'", "'unsafe-inline'"], // Allow inline scripts for OAuth callback
            },
        },
        crossOriginOpenerPolicy: false, // Allow window.opener to work across ports (3000 vs 3014)
        crossOriginResourcePolicy: false, // Allow resources to be loaded across origins
        originAgentCluster: false, // Prevent strict origin isolation
    }),
    cors({
        origin: CONFIG.allowedOrigins,
        credentials: true
    })
];

module.exports = securityMiddleware;
