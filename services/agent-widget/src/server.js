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
// Ngrok free-tier interstitial bypass
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

// CORS configuration - allow Genesys Cloud iframe origins
const GENESYS_ORIGINS = [
  'https://apps.mypurecloud.com',
  'https://apps.mypurecloud.ie',
  'https://apps.mypurecloud.de',
  'https://apps.mypurecloud.jp',
  'https://apps.mypurecloud.com.au',
  'https://apps.cac1.pure.cloud',
  'https://apps.sae1.pure.cloud',
  'https://apps.apne2.pure.cloud',
];

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    ...GENESYS_ORIGINS,
    'http://localhost:3014',  // agent-portal dev
    'http://localhost:3000',  // api-gateway
  ],
  credentials: true
};
app.use(cors(corsOptions));

// Explicit route: serve index.html for /widget (no trailing slash) to avoid 301 redirect through proxy
app.get('/widget', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static files (handles /widget/ and assets)
app.use('/widget', express.static(path.join(__dirname, 'public')));

// Mount routes
app.use('/widget', routes);

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