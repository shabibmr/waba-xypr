console.log('DEBUG: index.ts starting execution');
import express from 'express';
import initDatabase from './utils/dbInit';
import routes from './routes/index';
import statsController from './controllers/statsController';
import { initializeRabbitMQ } from './services/rabbitmq.service';
import { registerOperationHandlers } from './services/operationHandlers';
import { startExpiryJob } from './cron/expiry';
import { verifyApiKey } from './middleware/auth';

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

    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`State Manager running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize:', error);
    process.exit(1);
  }
})();
