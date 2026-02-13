const { createServices } = require('./services/factory');
const { TokenController } = require('./api/controllers/token.controller');
const { JWTController } = require('./api/controllers/jwt.controller');
const { HealthController } = require('./api/controllers/health.controller');
const { createApp } = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

async function start() {
  const services = await createServices();

  const tokenController  = new TokenController(services.tokenService);
  const jwtController    = new JWTController(services.jwtValidatorService);
  const healthController = new HealthController(services.redis, services.healthMonitor);

  const app = createApp({ tokenController, jwtController, healthController });

  const server = app.listen(config.port, () => {
    logger.info('Auth service started', {
      port: config.port,
      env: config.nodeEnv,
      authEnabled: !!config.internalAuth.secret,
    });
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      try {
        services.healthMonitor.stop();
        await services.redis.quit();
        logger.info('Auth service stopped cleanly');
      } catch (err) {
        logger.error('Error during shutdown', { error: err.message });
      }
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  return server;
}

module.exports = { start };
