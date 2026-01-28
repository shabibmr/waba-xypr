import express from 'express';
import config from './config';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { startMessageConsumer } from './services/rabbitmq.service';

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use(routes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start RabbitMQ consumer
startMessageConsumer();

// Start HTTP server
app.listen(config.port, () => {
  console.log(`Outbound Transformer running on port ${config.port}`);
});