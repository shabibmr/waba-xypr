/**
 * Genesys Webhook Service
 * Entry Point
 */

import express from 'express';
// @ts-ignore
import swaggerUi from 'swagger-ui-express';
// @ts-ignore
import YAML from 'yamljs';
import path from 'path';
// @ts-ignore
import config from './config/config';
// @ts-ignore
import rabbitMQService from './services/rabbitmq.service';
// @ts-ignore
import webhookRoutes from './routes/webhook.routes';
// @ts-ignore
import healthRoutes from './routes/health.routes';
// @ts-ignore
import errorHandler from './middleware/error-handler';
// @ts-ignore
import logger from './utils/logger';

// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));

const app = express();

// Middleware
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/webhook/genesys', webhookRoutes);
app.use('/health', healthRoutes);

// Error handling
app.use(errorHandler);

// Initialize services and start server
async function startServer() {
  try {
    // Initialize RabbitMQ
    await rabbitMQService.initialize();

    app.listen(config.port, () => {
      logger.info(`Genesys Webhook Service running on port ${config.port}`);
      logger.info(`Outbound webhook URL: http://localhost:${config.port}/webhook/genesys/outbound`);
      logger.info(`Events webhook URL: http://localhost:${config.port}/webhook/genesys/events`);
    });
  } catch (error) {
    logger.error('Failed to start service', error);
    process.exit(1);
  }
}

startServer();