const express = require('express');
const { correlationMiddleware } = require('./api/middleware/correlation.middleware');
const { errorMiddleware } = require('./api/middleware/error.middleware');
const { createRouter } = require('./api/routes');

function createApp({ tokenController, jwtController, healthController }) {
  const app = express();

  app.use(express.json());
  app.use(correlationMiddleware);

  // Primary FRD routes
  app.use('/api/v1', createRouter({ tokenController, jwtController, healthController }));

  // 404 for unknown routes
  app.use((req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    });
  });

  app.use(errorMiddleware);

  return app;
}

module.exports = { createApp };
