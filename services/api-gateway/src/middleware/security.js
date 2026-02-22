const helmet = require('helmet');
const cors = require('cors');
const CONFIG = require('../config/config');

const securityMiddleware = [
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "default-src": ["'self'", "https:", "data:", "blob:"],
                "script-src": [
                    "'self'",
                    "'unsafe-inline'",
                    "'unsafe-eval'",
                    "https://sdk-cdn.mypurecloud.com",
                    "https://cdn.socket.io"
                ],
                "script-src-attr": ["'none'"],
                "style-src": ["'self'", "'unsafe-inline'", "https:"],
                "font-src": ["'self'", "https:", "data:"],
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
                    "https://apps.pure.cloud",
                    "https://apps.aps1.pure.cloud",
                    "https://apps.usw2.pure.cloud",
                    "https://apps.cac1.pure.cloud",
                    "https://apps.euw1.pure.cloud",
                    "https://apps.euw2.pure.cloud",
                    "https://apps.apne2.pure.cloud",
                    "https://apps.apse2.pure.cloud",
                    "https://apps.sae1.pure.cloud",
                    "https://apps.use2.pure.cloud",
                    "https://apps.apne1.pure.cloud",
                    "https://*.mypurecloud.com",
                    "https://*.mypurecloud.ie",
                    "https://*.mypurecloud.de",
                    "https://*.mypurecloud.jp",
                    "https://*.mypurecloud.com.au"
                ],
                "upgrade-insecure-requests": null,
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
