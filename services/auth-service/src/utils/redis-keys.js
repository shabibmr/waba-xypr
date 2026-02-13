const RedisKeys = {
  token(provider, tenantId) {
    return `auth:token:${provider}:${tenantId}`;
  },
  lock(provider, tenantId) {
    return `auth:lock:${provider}:${tenantId}`;
  },
  jwks(region) {
    return `auth:jwks:${region}`;
  },
  rateLimit(provider, tenantId) {
    const minute = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    return `auth:ratelimit:${provider}:${tenantId}:${minute}`;
  },
};

const RedisTTL = {
  TOKEN_SAFETY_BUFFER: 60,
  LOCK_TTL: 30,
  JWKS_TTL: 21600,
  WHATSAPP_DEFAULT_TTL: 86400,
  WHATSAPP_SAFETY_BUFFER: 3600,
};

module.exports = { RedisKeys, RedisTTL };
