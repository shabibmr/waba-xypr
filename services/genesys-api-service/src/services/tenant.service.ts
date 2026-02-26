/**
 * Tenant service
 * Fetches tenant-specific Genesys configuration including integrationId (T06)
 */

import axios from 'axios';
import config from '../config/config';
import * as logger from '../utils/logger';

export interface TenantGenesysCredentials {
    clientId: string;
    clientSecret: string;
    region: string;
    integrationId: string;
    rateLimits: { requestsPerMinute: number; burstSize: number };
    retry: { maxAttempts: number; baseDelayMs: number; maxDelayMs: number };
    timeout: { connectMs: number; readMs: number };
}

/**
 * Get tenant-specific Genesys credentials from tenant-service.
 * Returns integrationId, rateLimits, retry, and timeout alongside OAuth credentials.
 */
export async function getTenantGenesysCredentials(tenantId: string): Promise<TenantGenesysCredentials> {
    try {
        const response = await axios.get(
            `${config.services.tenantService.url}/api/tenants/${tenantId}/credentials/genesys`,
            { timeout: 5000 }
        );

        const data = response.data;

        return {
            clientId: data.clientId,
            clientSecret: data.clientSecret,
            region: data.region,
            integrationId: data.integrationId,
            rateLimits: data.rateLimits || { requestsPerMinute: 300, burstSize: 50 },
            retry: data.retry || { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 32000 },
            timeout: data.timeout || { connectMs: 5000, readMs: 10000 }
        };
    } catch (error: any) {
        logger.error(tenantId, 'Failed to fetch Genesys credentials:', error.message);
        throw new Error(`Unable to fetch Genesys credentials for tenant ${tenantId}`);
    }
}
