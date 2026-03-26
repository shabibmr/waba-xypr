console.log('DEBUG: index.ts starting execution');
import express from 'express';
import initDatabase from './utils/dbInit';
import routes from './routes/index';
import statsController from './controllers/statsController';
import { initializeRabbitMQ, closeRabbitMQ } from './services/rabbitmq.service';
import { registerOperationHandlers } from './services/operationHandlers';
import { startExpiryJob, stopExpiryJob } from './cron/expiry';
import { verifyApiKey } from './middleware/auth';
import pool from './config/database';
import redisClient from './config/redis';
import tenantConnectionFactory from './services/tenantConnectionFactory';
import logger from './utils/logger';

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

// Health check (no auth required)
app.get('/health', statsController.healthCheck);

// Mount routes
app.use('/state', verifyApiKey, routes);

// Initialize database, RabbitMQ and start server
(async () => {
  try {
    // Initialize database first
    await initDatabase();
    console.log('Database initialized');

    await initializeRabbitMQ();
    console.log('RabbitMQ connection established');

    await registerOperationHandlers();
    console.log('Operation handlers registered');

    startExpiryJob();

    const server = app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`State Manager running on port ${PORT}`);
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Stop cron job
          if (typeof stopExpiryJob === 'function') {
            stopExpiryJob();
            logger.info('Expiry job stopped');
          }

          // Close RabbitMQ connections
          if (typeof closeRabbitMQ === 'function') {
            await closeRabbitMQ();
            logger.info('RabbitMQ connections closed');
          }

          // Close all tenant DB connection pools
          await tenantConnectionFactory.closeAll();
          logger.info('Tenant connection pools closed');

          // Close main DB connection pool
          await pool.end();
          logger.info('Main database pool closed');

          // Close Redis connection
          await redisClient.quit();
          logger.info('Redis connection closed');

          logger.info('Graceful shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown', { error });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forceful shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to initialize:', error);
    process.exit(1);
  }
})();
