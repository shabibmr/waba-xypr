const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Tenant Provisioning Service
 * Handles tenant auto-provisioning and onboarding status
 */
class TenantProvisioningService {
    constructor() {
        this.tenantServiceUrl = config.services.tenantService || 'http://tenant-service:3007';
    }

    /**
     * Provision tenant by Genesys organization ID
     * Finds existing tenant or creates new one
     * @param {string} genesysOrgId - Genesys organization ID
     * @param {string} genesysOrgName - Genesys organization name
     * @param {string} region - Genesys region
     * @returns {Promise<Object>} Tenant data
     * @throws {Error} If provisioning fails
     */
    async provisionTenant(genesysOrgId, genesysOrgName, region) {
        const provisioningUrl = `${this.tenantServiceUrl}/api/tenants/provision/genesys`;

        logger.info('Provisioning tenant for Genesys organization', {
            genesysOrgId,
            genesysOrgName,
            region,
            url: provisioningUrl
        });

        try {
            const response = await axios.post(
                provisioningUrl,
                {
                    genesysOrgId,
                    genesysOrgName,
                    genesysRegion: region
                },
                {
                    timeout: 10000 // 10 second timeout
                }
            );

            logger.info('Tenant provisioned/found', {
                tenantId: response.data.tenantId,
                tenantName: response.data.tenantName,
                isNew: response.data.isNew || false
            });

            return response.data;
        } catch (error) {
            logger.error('Tenant provisioning failed', {
                genesysOrgId,
                url: provisioningUrl,
                error: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            throw new Error('Unable to provision tenant. Please try again later.');
        }
    }

    /**
     * Get tenant onboarding status
     * @param {string} tenantId - Tenant ID
     * @returns {Promise<Object>} Onboarding status
     * @throws {Error} If fetch fails
     */
    async getTenantOnboardingStatus(tenantId) {
        const url = `${this.tenantServiceUrl}/api/tenants/${tenantId}`;

        logger.info('Fetching tenant onboarding status', { tenantId, url });

        try {
            const response = await axios.get(url, {
                timeout: 5000
            });

            return {
                onboardingCompleted: response.data.onboardingCompleted || false,
                whatsappConfigured: response.data.whatsappConfigured || false,
                genesysConfigured: response.data.genesysConfigured || false
            };
        } catch (error) {
            logger.error('Failed to fetch tenant onboarding status', {
                tenantId,
                error: error.message
            });
            // Return default status on error (non-critical)
            return {
                onboardingCompleted: false,
                whatsappConfigured: false,
                genesysConfigured: false
            };
        }
    }
}

// Export singleton instance
module.exports = new TenantProvisioningService();
