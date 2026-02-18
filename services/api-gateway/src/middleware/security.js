const helmet = require('helmet');
const cors = require('cors');
const CONFIG = require('../config/config');

const securityMiddleware = [
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "script-src": ["'self'", "'unsafe-inline'"], // Allow inline scripts for OAuth callback
                "frame-ancestors": [
                    "'self'",
                    "https://*.pure.cloud",
                    "https://*.mypurecloud.com",
                    "https://*.mypurecloud.ie",
                    "https://*.mypurecloud.de",
                    "https://*.mypurecloud.jp",
                    "https://*.mypurecloud.com.au",
                ], // Allow Genesys Cloud to embed widget in iframe
            },
        },
        crossOriginOpenerPolicy: false, // Allow window.opener to work across ports (3000 vs 3014)
        crossOriginResourcePolicy: false, // Allow resources to be loaded across origins
        originAgentCluster: false, // Prevent strict origin isolation
        xFrameOptions: false, // Disabled — CSP frame-ancestors takes precedence
    }),
    cors({
        origin: CONFIG.allowedOrigins,
        credentials: true
    })
];

module.exports = securityMiddleware;
