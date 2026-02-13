import axios from 'axios';
// @ts-ignore
import config from '../config/config';
// @ts-ignore
import logger from '../utils/logger';

class TenantService {
    /**
     * 01-B: Resolve tenant directly from integrationId via /api/v1/tenants/by-integration/{id}
     * Returns tenantId and webhookSecret in a single call.
     */
    async getByIntegrationId(integrationId: string): Promise<{ tenantId: string; webhookSecret?: string } | null> {
        try {
            const response = await axios.get(
                `${config.services.tenant.url}/api/v1/tenants/by-integration/${integrationId}`
            );
            const data = response.data;
            if (!data) return null;
            const tenantId = data.tenantId || data.id;
            if (!tenantId) return null;
            return { tenantId, webhookSecret: data.webhookSecret };
        } catch (error: any) {
            if (error.response?.status === 404) {
                logger.warn('Tenant not found for integrationId', { integrationId });
            } else {
                logger.error('Failed to resolve tenant by integration ID', { integrationId, error: error.message });
            }
            return null;
        }
    }

    /**
     * Fetch webhook secret separately (fallback if by-integration doesn't return it)
     */
    async getTenantWebhookSecret(tenantId: string): Promise<string | null> {
        try {
            const response = await axios.get(
                `${config.services.tenant.url}/api/v1/tenants/${tenantId}/credentials/genesys`
            );
            return response.data?.webhookSecret || null;
        } catch (error: any) {
            logger.error('Failed to fetch Genesys webhook secret', { tenantId, error: error.message });
            return null;
        }
    }
}

export default new TenantService();
