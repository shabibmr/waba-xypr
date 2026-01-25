const express = require('express');
const routes = require('./routes');

const app = express();

app.use(express.json());

// Mount all routes
app.use('/', routes);

// Health check
app.get('/health', async (req, res) => {
    const pool = require('./config/database');
    const redisClient = require('./config/redis');

    try {
        await pool.query('SELECT 1');
        if (redisClient.isOpen) {
            await redisClient.ping();
        } else {
            throw new Error('Redis not connected');
        }

        res.json({
            status: 'healthy',
            database: 'connected',
            redis: 'connected'
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

module.exports = app;
