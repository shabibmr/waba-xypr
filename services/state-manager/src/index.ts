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

// Initialize database
initDatabase();

// Health check (no auth required)
app.get('/health', statsController.healthCheck);

// Mount routes
app.use('/state', verifyApiKey, routes);

// Initialize RabbitMQ and operation handlers
(async () => {
  try {
    await initializeRabbitMQ();
    console.log('RabbitMQ connection established');

    await registerOperationHandlers();
    console.log('Operation handlers registered');

    startExpiryJob();
  } catch (error) {
    console.error('Failed to initialize RabbitMQ:', error);
    process.exit(1);
  }
})();

app.listen(PORT, () => {
  console.log(`State Manager running on port ${PORT}`);
});
