import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000';

class DashboardService {
    /**
     * Get dashboard metrics (KPIs, charts, token health)
     */
    async getMetrics() {
        try {
            const token = sessionStorage.getItem('agent_access_token');
            const response = await axios.get(`${API_BASE_URL}/api/dashboard/metrics`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Failed to fetch dashboard metrics:', error);
            throw new Error(error.response?.data?.error || 'Failed to fetch dashboard metrics');
        }
    }
}

export default new DashboardService();
