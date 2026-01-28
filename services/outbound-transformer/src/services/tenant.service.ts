import axios from 'axios';
// @ts-ignore
import config from '../config';

/**
 * Get tenant WhatsApp credentials
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} WhatsApp credentials with access token and phone number ID
 */
export async function getTenantWhatsAppCredentials(tenantId: string) {
    try {
        const response = await axios.get(
            `${config.services.tenantService}/api/tenants/${tenantId}/whatsapp/config`
        );

        return {
            accessToken: response.data.meta_access_token,
            phoneNumberId: response.data.whatsapp_phone_number_id,
            wabaId: response.data.whatsapp_business_account_id
        };
    } catch (error: any) {
        console.error(`Failed to fetch WhatsApp credentials for tenant ${tenantId}:`, error.message);
        throw new Error(`WhatsApp credentials not configured for tenant ${tenantId}`);
    }
}
