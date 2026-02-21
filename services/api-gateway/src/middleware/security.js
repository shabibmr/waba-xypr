const helmet = require('helmet');
const cors = require('cors');
const CONFIG = require('../config/config');

const securityMiddleware = [
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "script-src": [
                    "'self'",
                    "'unsafe-inline'",
                    "https://sdk-cdn.mypurecloud.com",
                    "https://cdn.socket.io"
                ],
                "script-src-attr": ["'none'"],
                "connect-src": [
                    "'self'",
                    "https://*.pure.cloud",
                    "wss://*.pure.cloud",
                    "https://*.mypurecloud.com",
                    "https://*.mypurecloud.ie",
                    "https://*.mypurecloud.de",
                    "https://*.mypurecloud.jp",
                    "https://*.mypurecloud.com.au",
                    "wss://*.mypurecloud.com",
                    "wss://*.mypurecloud.ie",
                    "wss://*.mypurecloud.de",
                    "wss://*.mypurecloud.jp",
                    "wss://*.mypurecloud.com.au",
                    "wss://*.ngrok-free.dev",
                    "wss://*.ngrok-free.app",
                    "wss://*.ngrok.app",
                    "wss://*.ngrok.io",
                    "https://*.ngrok-free.dev",
                    "https://*.ngrok-free.app",
                    "https://*.ngrok.app",
                    "https://*.ngrok.io"
                ],
                "img-src": ["'self'", "data:", "blob:", "https:", "http:"],
                "media-src": ["'self'", "blob:", "https:", "http:"],
                "frame-ancestors": [
                    "'self'",
                    "https://*.pure.cloud",
                    "https://*.mypurecloud.com",
                    "https://*.mypurecloud.ie",
                    "https://*.mypurecloud.de",
                    "https://*.mypurecloud.jp",
                    "https://*.mypurecloud.com.au",
                ],
            },
        },
        crossOriginOpenerPolicy: false,
        crossOriginResourcePolicy: false,
        originAgentCluster: false,
        xFrameOptions: false,
    }),
    cors({
        origin: CONFIG.allowedOrigins,
        credentials: true
    })
];

module.exports = securityMiddleware;
