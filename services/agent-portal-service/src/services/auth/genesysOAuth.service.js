const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Genesys OAuth Service
 * Handles all Genesys Cloud API interactions for authentication
 * Encapsulates OAuth token exchange and user/org data retrieval
 */
class GenesysOAuthService {
    constructor() {
        this.region = config.genesys.region;
        this.clientId = config.genesys.agentClientId;
        this.clientSecret = config.genesys.agentClientSecret;
        this.redirectUri = config.genesys.redirectUri;
    }

    /**
     * Exchange OAuth authorization code for access token
     * @param {string} code - OAuth authorization code
     * @returns {Promise<string>} Access token
     * @throws {Error} If token exchange fails
     */
    async exchangeCodeForToken(code) {
        const tokenUrl = `https://login.${this.region}/oauth/token`;

        logger.info('Exchanging OAuth code for access token', {
            url: tokenUrl,
            clientId: this.clientId,
            redirectUri: this.redirectUri,
            codeLength: code.length
        });

        try {
            const response = await axios.post(
                tokenUrl,
                new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: this.redirectUri,
                    client_id: this.clientId,
                    client_secret: this.clientSecret
                }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 10000 // 10 second timeout
                }
            );

            logger.info('Token exchange successful');
            return response.data.access_token;
        } catch (error) {
            logger.error('Token exchange failed', {
                url: tokenUrl,
                error: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            });
            throw new Error('Failed to exchange OAuth code for token');
        }
    }

    /**
     * Get user information from Genesys
     * @param {string} accessToken - Genesys access token
     * @returns {Promise<Object>} User information
     * @throws {Error} If user info fetch fails
     */
    async getUserInfo(accessToken) {
        const userInfoUrl = `https://api.${this.region}/api/v2/users/me`;

        logger.info('Fetching user info from Genesys', {
            url: userInfoUrl,
            region: this.region
        });

        try {
            const response = await axios.get(userInfoUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 10000
            });

            logger.info('Genesys user info retrieved', {
                userId: response.data.id,
                email: response.data.email,
                orgId: response.data.organization?.id
            });

            return response.data;
        } catch (error) {
            logger.error('Failed to fetch Genesys user info', {
                url: userInfoUrl,
                error: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText
            });
            throw new Error('Failed to fetch user information from Genesys');
        }
    }

    /**
     * Get organization information from Genesys
     * @param {string} accessToken - Genesys access token
     * @returns {Promise<Object>} Organization information
     * @throws {Error} If org info fetch fails
     */
    async getOrganizationInfo(accessToken) {
        const orgInfoUrl = `https://api.${this.region}/api/v2/organizations/me`;

        logger.info('Fetching organization info from Genesys', {
            url: orgInfoUrl,
            region: this.region
        });

        try {
            const response = await axios.get(orgInfoUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 10000
            });

            logger.info('Genesys organization info retrieved', {
                orgId: response.data.id,
                orgName: response.data.name,
                domain: response.data.domain
            });

            return response.data;
        } catch (error) {
            logger.error('Failed to fetch Genesys organization info', {
                url: orgInfoUrl,
                error: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText
            });
            throw new Error('Failed to fetch organization information from Genesys');
        }
    }

    /**
     * Get both user and organization information in parallel
     * @param {string} accessToken - Genesys access token
     * @returns {Promise<Object>} Combined user and organization data
     * @throws {Error} If either fetch fails
     */
    async getUserAndOrganization(accessToken) {
        logger.info('Fetching user and organization info in parallel');

        try {
            const [user, organization] = await Promise.all([
                this.getUserInfo(accessToken),
                this.getOrganizationInfo(accessToken)
            ]);

            logger.info('Successfully retrieved user and organization data', {
                userId: user.id,
                orgId: organization.id
            });

            return { user, organization };
        } catch (error) {
            logger.error('Failed to fetch user and organization data', {
                error: error.message
            });
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new GenesysOAuthService();
