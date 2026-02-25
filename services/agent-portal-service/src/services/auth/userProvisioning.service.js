const { GenesysUser } = require('../../models/Agent');
const logger = require('../../utils/logger');

/**
 * User Provisioning Service
 * Handles user auto-provisioning and profile management
 */
class UserProvisioningService {
    /**
     * Provision user from Genesys OAuth data
     * Finds existing user or creates new one
     * @param {Object} genesysUser - Genesys user data
     * @param {string} tenantId - Tenant ID
     * @returns {Promise<Object>} Provisioned user
     * @throws {Error} If provisioning fails
     */
    async provisionUser(genesysUser, tenantId) {
        logger.info('Provisioning user from Genesys data', {
            genesysUserId: genesysUser.id,
            email: genesysUser.email,
            tenantId
        });

        try {
            const user = await GenesysUser.findOrCreateFromGenesys(genesysUser, tenantId);

            logger.info('User provisioned', {
                userId: user.user_id,
                tenantId: user.tenant_id,
                role: user.role,
                isNewUser: !user.last_login_at
            });

            return user;
        } catch (error) {
            logger.error('User provisioning failed', {
                genesysUserId: genesysUser.id,
                tenantId,
                error: error.message,
                stack: error.stack
            });
            throw new Error('Failed to provision user');
        }
    }

    /**
     * Update user's last login timestamp
     * @param {string} userId - User ID
     * @returns {Promise<void>}
     */
    async updateLastLogin(userId) {
        logger.info('Updating last login', { userId });

        try {
            await GenesysUser.updateLastLogin(userId);
            logger.info('Last login updated', { userId });
        } catch (error) {
            // Log but don't throw - non-critical operation
            logger.error('Failed to update last login', {
                userId,
                error: error.message
            });
        }
    }

    /**
     * Get user profile with organization and WhatsApp config
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User profile with nested organization data
     * @throws {Error} If fetch fails
     */
    async getUserProfile(userId) {
        logger.info('Fetching user profile', { userId });

        try {
            // Get user data
            const user = await GenesysUser.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Get tenant WhatsApp config
            const whatsappConfig = await GenesysUser.getTenantWhatsAppConfig(userId);

            const profile = {
                user_id: user.user_id,
                name: user.name,
                email: user.genesys_email,
                role: user.role,
                tenant_id: user.tenant_id,
                created_at: user.created_at,
                last_login_at: user.last_login_at,
                organization: {
                    tenant_id: user.tenant_id,
                    tenant_name: whatsappConfig?.tenant_name,
                    whatsapp: whatsappConfig ? {
                        connected: true,
                        phone_number: whatsappConfig.display_phone_number,
                        waba_id: whatsappConfig.waba_id
                    } : {
                        connected: false
                    }
                }
            };

            logger.info('User profile retrieved', {
                userId,
                hasWhatsAppConfig: !!whatsappConfig
            });

            return profile;
        } catch (error) {
            logger.error('Failed to fetch user profile', {
                userId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new UserProvisioningService();
