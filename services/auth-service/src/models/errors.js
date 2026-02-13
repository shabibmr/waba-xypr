const ErrorCode = {
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  CREDENTIALS_NOT_FOUND: 'CREDENTIALS_NOT_FOUND',
  CREDENTIALS_INVALID: 'CREDENTIALS_INVALID',
  CREDENTIALS_DECRYPT_FAILED: 'CREDENTIALS_DECRYPT_FAILED',
  OAUTH_EXCHANGE_FAILED: 'OAUTH_EXCHANGE_FAILED',
  OAUTH_INVALID_GRANT: 'OAUTH_INVALID_GRANT',
  OAUTH_TIMEOUT: 'OAUTH_TIMEOUT',
  OAUTH_RATE_LIMITED: 'OAUTH_RATE_LIMITED',
  CACHE_UNAVAILABLE: 'CACHE_UNAVAILABLE',
  LOCK_TIMEOUT: 'LOCK_TIMEOUT',
  LOCK_ACQUISITION_FAILED: 'LOCK_ACQUISITION_FAILED',
  JWT_INVALID_SIGNATURE: 'JWT_INVALID_SIGNATURE',
  JWT_EXPIRED: 'JWT_EXPIRED',
  JWT_INVALID_FORMAT: 'JWT_INVALID_FORMAT',
  JWT_MISSING_CLAIMS: 'JWT_MISSING_CLAIMS',
  JWKS_FETCH_FAILED: 'JWKS_FETCH_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
};

class AuthServiceError extends Error {
  constructor(code, message, statusCode = 500, tenantId, correlationId) {
    super(message);
    this.name = 'AuthServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.tenantId = tenantId;
    this.correlationId = correlationId;
  }
}

class OAuthError extends AuthServiceError {
  constructor(code, message, provider, providerError, tenantId, correlationId) {
    super(code, message, 401, tenantId, correlationId);
    this.name = 'OAuthError';
    this.provider = provider;
    this.providerError = providerError;
  }
}

class CacheError extends AuthServiceError {
  constructor(code, message, operation, tenantId, correlationId) {
    super(code, message, 503, tenantId, correlationId);
    this.name = 'CacheError';
    this.operation = operation;
  }
}

module.exports = { ErrorCode, AuthServiceError, OAuthError, CacheError };
