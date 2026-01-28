/**
 * Tenant service
 * Handles tenant-related operations
 */

/**
 * Tenant service
 * Handles tenant-related operations
 */

import axios from 'axios';
// @ts-ignore
import config from '../config/config';
// @ts-ignore
import * as logger from '../utils/logger';

/**
 * Get tenant-specific Genesys credentials
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Genesys credentials with region
 */
export async function getTenantGenesysCredentials(tenantId: string): Promise<any> {
    try {
        const response = await axios.get(
            `${config.services.tenantService.url}/tenants/${tenantId}/genesys/credentials`
        );

        // Return credentials in expected format
        return {
            clientId: response.data.clientId,
            clientSecret: response.data.clientSecret,
            region: response.data.region
        };
    } catch (error: any) {
        logger.error(tenantId, 'Failed to fetch Genesys credentials:', error.message);
        throw new Error(`Unable to fetch Genesys credentials for tenant ${tenantId}`);
    }
}
