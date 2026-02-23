import axios from 'axios';
import authService from './authService';

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000';

class GenesysPlatformService {
    async getAuthHeaders() {
        const token = authService.getAccessToken();
        if (!token) throw new Error('Not authenticated');
        return { Authorization: `Bearer ${token}` };
    }

    async getOrgInfo() {
        try {
            const headers = await this.getAuthHeaders();
            const response = await axios.get(`${API_BASE_URL}/api/genesys-platform/org-info`, { headers });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    async listOAuthClients() {
        try {
            const headers = await this.getAuthHeaders();
            const response = await axios.get(`${API_BASE_URL}/api/genesys-platform/oauth-clients`, { headers });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    async createOAuthClient(data) {
        try {
            const headers = await this.getAuthHeaders();
            const response = await axios.post(`${API_BASE_URL}/api/genesys-platform/oauth-clients`, data, { headers });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    async listIntegrations() {
        try {
            const headers = await this.getAuthHeaders();
            const response = await axios.get(`${API_BASE_URL}/api/genesys-platform/integrations`, { headers });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    async provisionMessaging(data) {
        try {
            const headers = await this.getAuthHeaders();
            const response = await axios.post(`${API_BASE_URL}/api/genesys-platform/provision-messaging`, data, { headers });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    handleError(error) {
        if (error.response?.status === 403) {
            throw new Error(error.response.data?.message || 'Insufficient permissions. You need Genesys Admin roles (oauth:client:edit, integrations:integration:edit).');
        }
        if (error.response?.status === 401) {
            throw new Error('Your Genesys session expired. Please log in again.');
        }
        throw new Error(error.response?.data?.message || error.message || 'An error occurred connecting to Genesys Platform API');
    }
}

export default new GenesysPlatformService();
