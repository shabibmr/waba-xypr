const helmet = require('helmet');
const cors = require('cors');
const CONFIG = require('../config/config');

const securityMiddleware = [
    helmet(),
    cors({
        origin: CONFIG.allowedOrigins,
        credentials: true
    })
];

module.exports = securityMiddleware;
