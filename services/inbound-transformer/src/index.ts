/**
 * Inbound Transformer Service
 * Main application entry point
 * Transforms Meta WhatsApp messages to Genesys Open Messaging format
 */

import express from 'express';
// @ts-ignore
import { startConsumer } from './consumers/inboundConsumer';
// @ts-ignore
import healthRoutes from './routes/health';
// @ts-ignore
import transformRoutes from './routes/transform';

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