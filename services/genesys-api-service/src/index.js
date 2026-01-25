/**
 * Genesys API Service
 * Express application entry point
 */

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const config = require('./config/config');
const genesysRoutes = require('./routes/genesys.routes');
const healthRoutes = require('./routes/health.routes');
const errorHandler = require('./middleware/error-handler');

const { tenantResolver } = require('../../../shared/middleware/tenantResolver');

// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));

const app = express();

// Middleware
app.use(express.json());
app.use(tenantResolver);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/genesys', genesysRoutes);
app.use('/health', healthRoutes);

// Error handling (must be last)
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`Genesys API Service running on port ${config.port}`);
});