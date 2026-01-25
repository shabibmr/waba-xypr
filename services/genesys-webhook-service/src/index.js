/**
 * Genesys Webhook Service
 * Entry Point
 */

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const config = require('./config/config');
const rabbitMQService = require('./services/rabbitmq.service');
const webhookRoutes = require('./routes/webhook.routes');
const healthRoutes = require('./routes/health.routes');
const errorHandler = require('./middleware/error-handler');
const logger = require('./utils/logger');

// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));

const app = express();

// Middleware
app.use(express.json({
  verify: (req, res, buf) => {
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