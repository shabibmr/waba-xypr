// services/agent-widget/src/server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');

const app = express();

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url} [Host: ${req.headers.host}]`);
  next();
});
// CORS configuration - restrict to known origins for demo
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3014',  // agent-portal dev
    'http://localhost:3000',  // api-gateway
  ],
  credentials: true
};
app.use(cors(corsOptions));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Mount routes
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(config.port, () => {
  console.log(`Agent Widget Service running on port ${config.port}`);
  console.log(`Widget URL: ${config.publicUrl}/widget`);
  console.log(`Example: ${config.publicUrl}/widget?conversationId=abc123&tenantId=acme`);
});