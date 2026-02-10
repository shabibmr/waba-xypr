/**
 * Genesys API Service
 * Express application entry point
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
import genesysRoutes from './routes/genesys.routes';
// @ts-ignore
import healthRoutes from './routes/health.routes';
// @ts-ignore
import errorHandler from './middleware/error-handler';

// @ts-ignore
import { tenantResolver } from '../../../shared/middleware/tenantResolver';

// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));

const app = express();

// Middleware
app.use(express.json());
// Tenant resolver not needed - this service is only called by internal services
// app.use(tenantResolver);

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