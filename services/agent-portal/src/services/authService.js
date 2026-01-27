import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000';

class AuthService {
    constructor() {
        this.tokenKey = 'agent_auth_token';
        this.agentKey = 'agent_info';
    }

    /**
     * Initiate Genesys OAuth login
     * No signup needed - auto-provisioning on first login
     */
    async initiateGenesysLogin() {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
            `${API_BASE_URL}/api/agents/auth/login`,
            'GenesysLogin',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        return new Promise((resolve, reject) => {
            const handleMessage = (event) => {
                if (event.origin !== window.location.origin) return;

                if (event.data.type === 'GENESYS_AUTH_SUCCESS') {
                    cleanup();
                    this.setToken(event.data.token);
                    this.setAgent(event.data.agent);
                    resolve(event.data.agent);
                } else if (event.data.type === 'GENESYS_AUTH_ERROR') {
                    cleanup();
                    reject(new Error(event.data.error));
                }
            };

            const checkPopup = setInterval(() => {
                if (!popup || popup.closed) {
                    cleanup();
                    reject(new Error('Login cancelled'));
                }
            }, 1000);

            const cleanup = () => {
                clearInterval(checkPopup);
                window.removeEventListener('message', handleMessage);
                if (popup && !popup.closed) popup.close();
            };

            window.addEventListener('message', handleMessage);
        });
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            await axios.post(`${API_BASE_URL}/api/agents/auth/logout`, {}, {
                headers: { Authorization: `Bearer ${this.getToken()}` }
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.clearAuth();
        }
    }

    /**
     * Get current user profile
     */
    async getProfile() {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/agents/profile`, {
                headers: { Authorization: `Bearer ${this.getToken()}` }
            });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to fetch profile');
        }
    }

    /**
     * Token management
     */
    setToken(token) {
        localStorage.setItem(this.tokenKey, token);
    }

    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    setAgent(agent) {
        localStorage.setItem(this.agentKey, JSON.stringify(agent));
    }

    getAgent() {
        const agent = localStorage.getItem(this.agentKey);
        return agent ? JSON.parse(agent) : null;
    }

    // Keep aliases for backward compatibility if any
    setUser(user) { this.setAgent(user); }
    getUser() { return this.getAgent(); }

    clearAuth() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.agentKey);
    }

    isAuthenticated() {
        return !!this.getToken();
    }
}

export default new AuthService();
