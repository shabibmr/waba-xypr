const AppError = require('./AppError');
const ERROR_CODES = require('./errorCodes');

/**
 * Request Helper Utilities
 * Extract common request context (token, region, tenantId)
 */

/**
 * Extract request context from Express request
 * @param {Object} req - Express request object
 * @param {boolean} requireTenant - Whether tenant ID is required
 * @returns {Object} Request context { token, region, tenantId }
 * @throws {AppError} If tenant is required but not found
 */
function getRequestContext(req, requireTenant = false) {
    const token = req.headers.authorization;
    const region = req.user?.genesysRegion || 'mypurecloud.com';
    let tenantId = null;

    if (requireTenant) {
        tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
        if (!tenantId) {
            throw new AppError('Tenant ID is required', 400, ERROR_CODES.VALIDATION_001);
        }
    }

    return { token, region, tenantId };
}

module.exports = {
    getRequestContext
};
