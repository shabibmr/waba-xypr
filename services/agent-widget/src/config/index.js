require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3012,
    env: process.env.NODE_ENV || 'development',
    portalServiceUrl: process.env.PORTAL_SERVICE_URL || 'http://localhost:3015',
    publicUrl: process.env.PUBLIC_URL || 'http://localhost:3012',
};
