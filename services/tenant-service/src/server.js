require('dotenv').config();
const app = require('./app');
const { initDatabase } = require('./services/schemaService');
const redisClient = require('./config/redis');

const PORT = process.env.PORT || 3007;

async function startServer() {
    try {
        // Connect to Redis
        if (!redisClient.isOpen) {
            await redisClient.connect();
            console.log('Redis connected');
        }

        // Initialize Database
        await initDatabase();

        app.listen(PORT, () => {
            console.log(`Enhanced Tenant Service running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
