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
// Ngrok free-tier interstitial bypass (development only)
if (config.env === 'development') {
  app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
  });
}

// CORS configuration - allow Genesys Cloud iframe origins
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) {
      return callback(null, true);
    }

    // Check Genesys Cloud domains (regex for all regions)
    if (/\.mypurecloud\.(com|ie|de|jp|com\.au)$/.test(origin) ||
      /\.pure\.cloud$/.test(origin)) {
      return callback(null, true);
    }

    // Check local development origins
    const localOrigins = [
      'http://localhost:3014',  // agent-portal dev
      'http://localhost:3000',  // api-gateway
      config.publicUrl,         // widget's own ngrok/public URL
    ].filter(Boolean);
    if (localOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Check custom ALLOWED_ORIGINS (appends, doesn't replace)
    const customOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
    if (customOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Reject all others
    callback(new Error('CORS not allowed'), false);
  },
  credentials: true
};
app.use(cors(corsOptions));

// Explicit route: serve index.html for /widget (no trailing slash)
// This bypasses express.static to avoid 301 redirects through reverse proxies (nginx, api-gateway)
// Note: /widget/ (with slash) is handled by express.static middleware below
app.get('/widget', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Mount API routes (takes precedence over static files)
app.use('/widget', routes);

// Serve static files (fallback for CSS/JS/images and directory index)
// Handles: /widget/ → index.html, /widget/styles.css, /widget/app.js, etc.
app.use('/widget', express.static(path.join(__dirname, 'public')));

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