require('dotenv').config();

function getEnv(key, defaultValue) {
  return process.env[key] !== undefined ? process.env[key] : defaultValue;
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function loadConfig() {
  const errors = [];

  const redisUrl = getEnv('REDIS_URL', 'redis://localhost:6379');
  const tenantServiceUrl = getEnv('TENANT_SERVICE_URL', 'http://localhost:3007');
  const internalSecret = getEnv('INTERNAL_SERVICE_SECRET', '');

  if (!redisUrl)         errors.push('REDIS_URL is required');
  if (!tenantServiceUrl) errors.push('TENANT_SERVICE_URL is required');

  if (errors.length) {
    throw new Error(`Config validation failed:\n  ${errors.join('\n  ')}`);
  }

  if (!internalSecret) {
    // Allow dev mode without auth; warn loudly
    console.warn('[auth-service] WARNING: INTERNAL_SERVICE_SECRET not set — service auth is DISABLED (dev mode)');
  }

  return {
    port:    parseInt(getEnv('PORT', '3004')),
    nodeEnv: getEnv('NODE_ENV', 'development'),
    logLevel: getEnv('LOG_LEVEL', 'info'),

    redis: {
      url: redisUrl,
    },

    tenantService: {
      url:     tenantServiceUrl,
      timeout: parseInt(getEnv('TENANT_SERVICE_TIMEOUT', '3000')),
    },

    internalAuth: {
      secret: internalSecret,  // Empty string = auth disabled
    },

    ttls: {
      tokenSafetyBuffer:    parseInt(getEnv('TOKEN_SAFETY_BUFFER_SECONDS', '60')),
      lockTTL:              parseInt(getEnv('LOCK_TTL_SECONDS', '30')),
      jwksTTL:              parseInt(getEnv('JWKS_TTL_SECONDS', '21600')),
      whatsappDefault:      parseInt(getEnv('WHATSAPP_DEFAULT_TTL_SECONDS', '86400')),
      whatsappSafetyBuffer: parseInt(getEnv('WHATSAPP_SAFETY_BUFFER_SECONDS', '3600')),
    },

    oauth: {
      timeout:    parseInt(getEnv('OAUTH_TIMEOUT_MS', '5000')),
      maxRetries: parseInt(getEnv('OAUTH_MAX_RETRIES', '2')),
    },

    // Legacy Genesys config for authorize/callback flow
    genesys: {
      clientId:     getEnv('GENESYS_CLIENT_ID', ''),
      clientSecret: getEnv('GENESYS_CLIENT_SECRET', ''),
      region:       getEnv('GENESYS_REGION', 'mypurecloud.com'),
      redirectUri:  getEnv('GENESYS_REDIRECT_URI', 'http://localhost:3014/auth/callback'),
    },
  };
}

module.exports = loadConfig();
