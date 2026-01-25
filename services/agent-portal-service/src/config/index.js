require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3015,
    database: {
        connectionString: process.env.DATABASE_URL
    },
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    },
    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost:5672'
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'default_secret_change_in_production',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    },
    genesys: {
        clientId: process.env.GENESYS_CLIENT_ID,
        clientSecret: process.env.GENESYS_CLIENT_SECRET,
        region: process.env.GENESYS_REGION || 'mypurecloud.com',
        redirectUri: process.env.GENESYS_REDIRECT_URI
    },
    services: {
        authService: process.env.AUTH_SERVICE_URL || 'http://localhost:3004',
        tenantService: process.env.TENANT_SERVICE_URL || 'http://localhost:3007',
        agentWidget: process.env.AGENT_WIDGET_URL || 'http://localhost:3012',
        stateManager: process.env.STATE_MANAGER_URL || 'http://localhost:3005',
        whatsappApi: process.env.WHATSAPP_API_URL || 'http://localhost:3008'
    },
    frontend: {
        url: process.env.AGENT_PORTAL_FRONTEND_URL || 'http://localhost: 3014'
    }
};
