const axios = require('axios');
const logger = require('../../utils/logger');
const config = require('../../config');
const { AuthServiceError, ErrorCode } = require('../../models/errors');

class CredentialFetcherService {
  constructor() {
    this.client = axios.create({
      baseURL: config.tenantService.url,
      timeout: config.tenantService.timeout,
      headers: { 'X-Service-Name': 'auth-service' },
    });
  }

  /**
   * Fetch credentials for a tenant+provider from Tenant Service.
   * Endpoint: GET /tenants/:id/credentials/:type
   * Retries up to 2 times on 5xx/network errors. No retry on 404/400.
   */
  async fetchCredentials(tenantId, provider) {
    const maxRetries = 2;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.get(
          `/tenants/${tenantId}/credentials/${provider}`
        );
        return response.data;
      } catch (err) {
        lastError = err;
        const status = err.response?.status;

        if (status === 404) {
          throw new AuthServiceError(
            ErrorCode.CREDENTIALS_NOT_FOUND,
            `No ${provider} credentials found for tenant ${tenantId}`,
            404,
            tenantId
          );
        }

        if (status === 400) {
          throw new AuthServiceError(
            ErrorCode.INVALID_REQUEST,
            `Invalid credential request for tenant ${tenantId}`,
            400,
            tenantId
          );
        }

        if (attempt < maxRetries) {
          const delay = Math.min(500 * Math.pow(2, attempt), 4000);
          logger.warn('Tenant Service request failed, retrying', {
            tenantId, provider, attempt, delay,
            status, error: err.message,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    logger.error('Tenant Service request failed after retries', {
      tenantId, provider, error: lastError?.message,
    });

    throw new AuthServiceError(
      ErrorCode.CREDENTIALS_NOT_FOUND,
      `Failed to fetch ${provider} credentials for tenant ${tenantId}`,
      503,
      tenantId
    );
  }
}

module.exports = { CredentialFetcherService };
