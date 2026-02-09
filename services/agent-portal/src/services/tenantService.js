import axios from 'axios';
import authService from './authService';

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000';

class TenantService {
    /**
     * Update organization profile
     */
    async updateProfile(profileData) {
        try {
            const response = await axios.put(
                `${API_BASE_URL}/api/organization/profile`,
                profileData,
                {
                    headers: { Authorization: `Bearer ${authService.getAccessToken()}` }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to update profile');
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
            throw new Error(error.response?.data?.error || 'Failed to complete onboarding');
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
            throw new Error(error.response?.data?.error || 'Failed to fetch profile');
        }
    }
}

export default new TenantService();
