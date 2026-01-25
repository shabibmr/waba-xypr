/**
 * WhatsApp Webhook Service
 * Entry point for the WhatsApp webhook receiver service
 */

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const config = require('./config/config');
const rabbitMQService = require('./services/rabbitmq.service');
const webhookRoutes = require('./routes/webhook.routes');
const healthRoutes = require('./routes/health.routes');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');
const Logger = require('./utils/logger');

// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/webhook', webhookRoutes);
app.use('/', healthRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize services and start server
async function startServer() {
  try {
    // Initialize RabbitMQ
    await rabbitMQService.initialize();

    // Start Express server
    app.listen(config.port, () => {
      Logger.info(`WhatsApp Webhook Service running on port ${config.port}`);
      Logger.info(`Webhook URL: http://localhost:${config.port}/webhook/whatsapp`);
    });
  } catch (error) {
    Logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the service
startServer();