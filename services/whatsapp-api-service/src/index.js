/**
 * WhatsApp API Service
 * Entry point for the WhatsApp API wrapper service
 */
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const config = require('./config/config');
const Logger = require('./utils/logger');
const { tenantResolver } = require('../../../shared/middleware/tenantResolver');
const { errorHandler } = require('./middleware/error-handler');

// Route imports
const messageRoutes = require('./routes/message.routes');
const mediaRoutes = require('./routes/media.routes');
const healthRoutes = require('./routes/health.routes');

// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));

const app = express();

// Middleware
app.use(express.json());
app.use(tenantResolver);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/whatsapp', messageRoutes);
app.use('/whatsapp', mediaRoutes);
app.use('/', healthRoutes);

// Error Handling
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  Logger.info(`WhatsApp API Service running on port ${config.port}`);
});