const axios = require('axios');
const logger = require('../../utils/logger');
const config = require('../../config');
const { OAuthError, ErrorCode } = require('../../models/errors');
const { getGenesysEndpoints } = require('../../config/providers.config');

class GenesysOAuthClient {
  /**
   * Exchange client credentials for a Genesys access token.
   * @param {object} credentials - { clientId, clientSecret, region }
   * @param {string} tenantId - For logging context only (never log credentials)
   */
  async exchangeCredentials(credentials, tenantId) {
    const { oauthUrl } = getGenesysEndpoints(credentials.region);

    const basicAuth = Buffer.from(
      `${credentials.clientId}:${credentials.clientSecret}`
    ).toString('base64');

    const maxRetries = config.oauth.maxRetries;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(
          oauthUrl,
          'grant_type=client_credentials',
          {
            timeout: config.oauth.timeout,
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );

        logger.info('Genesys OAuth exchange successful', {
          tenantId, region: credentials.region,
        });

        return response.data;
      } catch (err) {
        lastError = err;
        const status = err.response?.status;

        if (status === 401) {
          logger.error('Genesys OAuth credentials rejected', {
            tenantId, region: credentials.region,
          });
          throw new OAuthError(
            ErrorCode.OAUTH_INVALID_GRANT,
            'OAuth credentials were rejected by Genesys',
            'genesys',
            err.response?.data?.error_description,
            tenantId
          );
        }

        if (status === 429) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
          logger.warn('Genesys OAuth rate limited', { tenantId, attempt, delay });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        const isRetriable = !err.response ||
                            err.code === 'ECONNABORTED' ||
                            err.code === 'ETIMEDOUT' ||
                            (status >= 500 && status < 600);

        if (isRetriable && attempt < maxRetries) {
          const delay = Math.min(500 * Math.pow(2, attempt), 4000);
          logger.warn('Genesys OAuth request failed, retrying', {
            tenantId, attempt, delay, status, code: err.code,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        break;
      }
    }

    logger.error('Genesys OAuth exchange failed after retries', {
      tenantId, maxRetries, error: lastError?.message,
    });

    throw new OAuthError(
      ErrorCode.OAUTH_EXCHANGE_FAILED,
      'Failed to exchange OAuth credentials after retries',
      'genesys',
      undefined,
      tenantId
    );
  }
}

module.exports = { GenesysOAuthClient };
