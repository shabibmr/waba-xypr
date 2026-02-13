const { connectRedis } = require('../repositories/redis.client');
const { TokenCacheRepository } = require('../repositories/token-cache.repository');
const { LockRepository } = require('../repositories/lock.repository');
const { CredentialFetcherService } = require('./credentials/credential-fetcher.service');
const { GenesysOAuthClient } = require('./oauth/genesys-oauth.client');
const { GenesysTokenService } = require('./token/genesys-token.service');
const { WhatsAppTokenService } = require('./token/whatsapp-token.service');
const { TokenService } = require('./token/token.service');
const { JWTValidatorService } = require('./jwt/jwt-validator.service');
const { RedisHealthMonitor } = require('./health/redis-health-monitor');
const { DegradedModeRateLimiter } = require('./health/degraded-rate-limiter');
const logger = require('../utils/logger');

let services = null;

async function createServices() {
  if (services) return services;

  logger.info('Initializing auth-service dependencies');

  const redis = await connectRedis();

  const healthMonitor = new RedisHealthMonitor(redis);
  healthMonitor.start();

  const degradedLimiter = new DegradedModeRateLimiter();
  const tokenCache = new TokenCacheRepository(redis);
  const lockRepo = new LockRepository(redis);
  const credentialFetcher = new CredentialFetcherService();
  const oauthClient = new GenesysOAuthClient();

  const genesysTokenService = new GenesysTokenService(
    tokenCache, lockRepo, credentialFetcher, oauthClient, healthMonitor, degradedLimiter
  );

  const whatsappTokenService = new WhatsAppTokenService(
    tokenCache, credentialFetcher, healthMonitor, degradedLimiter
  );

  const tokenService = new TokenService(genesysTokenService, whatsappTokenService);
  const jwtValidatorService = new JWTValidatorService();

  services = { redis, healthMonitor, tokenService, jwtValidatorService, credentialFetcher };
  return services;
}

module.exports = { createServices };
