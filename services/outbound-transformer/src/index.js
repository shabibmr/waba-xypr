const express = require('express');
const config = require('./config');
const routes = require('./routes');
const { errorHandler } = require('./middleware/error.middleware');
const { startMessageConsumer } = require('./services/rabbitmq.service');

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