const express = require('express');
const CONFIG = require('./config/config');
const securityMiddleware = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health');
const gatewayRoutes = require('./routes/gateway');

const app = express();

// Trust proxy (required behind Ngrok / reverse proxies for rate-limiting)
app.set('trust proxy', 1);

// Body parsing (required for re-streaming in proxy)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ngrok free-tier interstitial bypass (must be before all routes)
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

// Apply security middleware
securityMiddleware.forEach(middleware => app.use(middleware));

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