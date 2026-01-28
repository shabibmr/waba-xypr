/**
 * Authentication service
 * Handles authentication operations
 */

/**
 * Authentication service
 * Handles authentication operations
 */

import axios from 'axios';
// @ts-ignore
import config from '../config/config';
// @ts-ignore
import * as logger from '../utils/logger';

/**
 * Get OAuth token for tenant
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<string>} OAuth token
 */
export async function getAuthToken(tenantId: string): Promise<string> {
    try {
        const response = await axios.get(
            `${config.services.authService.url}/auth/token`,
            {
                headers: {
                    'X-Tenant-ID': tenantId
                }
            }
        );
        return response.data.token;
    } catch (error: any) {
        logger.error(tenantId, 'Failed to fetch auth token:', error.message);
        throw error;
    }
}
