const express = require('express');
const CONFIG = require('./config/config');
const securityMiddleware = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health');
const gatewayRoutes = require('./routes/gateway');

const app = express();

// Apply security middleware
securityMiddleware.forEach(middleware => app.use(middleware));

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Routes
app.use(healthRoutes);
app.use(gatewayRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(CONFIG.port, () => {
  console.log(`API Gateway running on port ${CONFIG.port}`);
  console.log('Service routes configured:', Object.keys(CONFIG.services));
});

module.exports = app;