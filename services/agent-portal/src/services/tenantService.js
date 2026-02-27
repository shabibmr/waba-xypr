import axios from 'axios';
import authService from './authService';

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000';

class TenantService {
    /**
     * Update organization profile
     */
    async updateProfile(profileData) {
        try {
            console.log('[tenantService] updateProfile called', { profileData, apiUrl: API_BASE_URL });
            const token = authService.getAccessToken();
            console.log('[tenantService] Access token:', token ? `${token.substring(0, 20)}...` : 'MISSING');

            const url = `${API_BASE_URL}/api/organization/profile`;
            console.log('[tenantService] Sending PUT request to:', url);

            const response = await axios.put(
                url,
                profileData,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 30000 // 30 second timeout
                }
            );
            console.log('[tenantService] Response received:', response.status, response.data);
            return response.data;
        } catch (error) {
            console.error('[tenantService] updateProfile error:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                stack: error.stack
            });
            const errorData = error.response?.data?.error;
            const message = typeof errorData === 'string' ? errorData : errorData?.message;
            throw new Error(message || 'Failed to update profile');
        }
    }

    /**
     * Complete onboarding setup
     */
    async completeOnboarding(tenantId, setupData) {
        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/tenants/${tenantId}/complete-onboarding`,
                setupData,
                {
                    headers: { Authorization: `Bearer ${authService.getAccessToken()}` }
                }
            );
            return response.data;
        } catch (error) {
            const errorData = error.response?.data?.error;
            const message = typeof errorData === 'string' ? errorData : errorData?.message;
            throw new Error(message || 'Failed to complete onboarding');
        }
    }

    /**
     * Get organization profile
     */
    async getProfile() {
        try {
            const response = await axios.get(
                `${API_BASE_URL}/api/organization/profile`,
                {
                    headers: { Authorization: `Bearer ${authService.getAccessToken()}` }
                }
            );
            return response.data;
        } catch (error) {
            const errorData = error.response?.data?.error;
            const message = typeof errorData === 'string' ? errorData : errorData?.message;
            throw new Error(message || 'Failed to fetch profile');
        }
    }

    /**
     * Update Genesys credentials
     */
    async updateGenesysCredentials(credentialsData) {
        try {
            const response = await axios.put(
                `${API_BASE_URL}/api/organization/genesys-credentials`,
                credentialsData,
                {
                    headers: { Authorization: `Bearer ${authService.getAccessToken()}` }
                }
            );
            return response.data;
        } catch (error) {
            const errorData = error.response?.data?.error;
            const message = typeof errorData === 'string' ? errorData : errorData?.message;
            throw new Error(message || 'Failed to update Genesys credentials');
        }
    }

    /**
     * Update WhatsApp access token
     */
    async updateWhatsAppToken(accessToken) {
        try {
            const response = await axios.put(
                `${API_BASE_URL}/api/organization/whatsapp-token`,
                { accessToken },
                {
                    headers: { Authorization: `Bearer ${authService.getAccessToken()}` }
                }
            );
            return response.data;
        } catch (error) {
            const errorData = error.response?.data?.error;
            const message = typeof errorData === 'string' ? errorData : errorData?.message;
            throw new Error(message || 'Failed to update WhatsApp token');
        }
    }
}

export default new TenantService();
