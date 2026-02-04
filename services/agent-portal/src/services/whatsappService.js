import axios from 'axios';
import authService from './authService';

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000';

class WhatsAppService {
    /**
     * Initiate WhatsApp embedded signup
     */
    async initiateSignup() {
        const META_APP_ID = import.meta.env.VITE_META_APP_ID;
        const META_CONFIG_ID = import.meta.env.VITE_META_CONFIG_ID;

        console.log('WhatsApp Signup Env Check:', {
            META_APP_ID,
            META_CONFIG_ID,
            ALL_ENV: import.meta.env
        });

        if (!META_APP_ID || !META_CONFIG_ID) {
            throw new Error('WhatsApp credentials not configured');
        }

        const width = 600;
        const height = 800;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
            `https://www.facebook.com/v18.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${window.location.origin}/onboarding&config_id=${META_CONFIG_ID}&response_type=code&scope=whatsapp_business_management,whatsapp_business_messaging`,
            'WhatsAppSignup',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        return new Promise((resolve, reject) => {
            const checkPopup = setInterval(() => {
                if (!popup || popup.closed) {
                    clearInterval(checkPopup);
                    reject(new Error('WhatsApp signup cancelled'));
                }
            }, 1000);

            window.addEventListener('message', (event) => {
                if (event.data.type === 'WHATSAPP_SIGNUP_SUCCESS') {
                    clearInterval(checkPopup);
                    popup.close();
                    resolve(event.data.data);
                } else if (event.data.type === 'WHATSAPP_SIGNUP_ERROR') {
                    clearInterval(checkPopup);
                    popup.close();
                    reject(new Error(event.data.error));
                }
            });
        });
    }

    /**
     * Complete WhatsApp setup with backend
     */
    async completeSetup(setupData) {
        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/agents/whatsapp/setup`,
                setupData,
                { headers: { Authorization: `Bearer ${authService.getToken()}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to complete WhatsApp setup');
        }
    }

    /**
     * Skip setup and use demo credentials
     */
    async skipSetup() {
        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/agents/whatsapp/setup/skip`,
                {},
                { headers: { Authorization: `Bearer ${authService.getToken()}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to skip setup');
        }
    }

    /**
     * Get WhatsApp connection status
     */
    async getStatus() {
        try {
            const response = await axios.get(
                `${API_BASE_URL}/api/agents/whatsapp/status`,
                { headers: { Authorization: `Bearer ${authService.getToken()}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to get WhatsApp status');
        }
    }
}

export default new WhatsAppService();
