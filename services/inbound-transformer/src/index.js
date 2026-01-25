/**
 * Inbound Transformer Service
 * Main application entry point
 * Transforms Meta WhatsApp messages to Genesys Open Messaging format
 */

const express = require('express');
const { startConsumer } = require('./consumers/inboundConsumer');
const healthRoutes = require('./routes/health');
const transformRoutes = require('./routes/transform');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());

// Routes
app.use('/health', healthRoutes);
app.use('/transform', transformRoutes);

// Start RabbitMQ consumer
startConsumer();

// Start server
app.listen(PORT, () => {
  console.log(`Inbound Transformer running on port ${PORT}`);
});