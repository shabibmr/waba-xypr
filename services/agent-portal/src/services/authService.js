import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000';

/**
 * Retry a function with exponential backoff
 */
const retryWithBackoff = async (fn, maxRetries = 3, initialDelay = 1000) => {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on auth errors (401, 403)
            if (error.response?.status === 401 || error.response?.status === 403) {
                throw error;
            }

            // Don't retry on client errors (except 429 rate limit)
            if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
                throw error;
            }

            // Last retry
            if (i === maxRetries - 1) {
                throw lastError;
            }

            // Wait with exponential backoff
            const delay = initialDelay * Math.pow(2, i);
            console.log(`Retry attempt ${i + 1}/${maxRetries} after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
};

class AuthService {
    constructor() {
        this.accessTokenKey = 'agent_access_token';
        this.refreshTokenKey = 'agent_refresh_token';
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
                // Validate message origin against API server
                const apiOrigin = new URL(API_BASE_URL).origin;

                if (event.origin !== apiOrigin) {
                    console.warn('[AuthService] Ignoring message from unexpected origin:', event.origin, 'Expected:', apiOrigin);
                    return;
                }

                if (event.data.type === 'GENESYS_AUTH_SUCCESS') {
                    cleanup();
                    this.setAccessToken(event.data.accessToken);
                    this.setRefreshToken(event.data.refreshToken);
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
                headers: { Authorization: `Bearer ${this.getAccessToken()}` }
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.clearAuth();
        }
    }

    /**
     * Logout from all devices
     */
    async logoutAll() {
        try {
            await axios.post(`${API_BASE_URL}/api/agents/auth/logout-all`, {}, {
                headers: { Authorization: `Bearer ${this.getAccessToken()}` }
            });
        } catch (error) {
            console.error('Logout all error:', error);
        } finally {
            this.clearAuth();
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken() {
        const refreshToken = this.getRefreshToken();

        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await axios.post(`${API_BASE_URL}/api/agents/auth/refresh`, {
                refreshToken
            });

            const { accessToken, refreshToken: newRefreshToken } = response.data;

            this.setAccessToken(accessToken);
            this.setRefreshToken(newRefreshToken);

            return accessToken;
        } catch (error) {
            // Refresh failed, clear auth
            this.clearAuth();
            throw new Error(error.response?.data?.error || 'Failed to refresh token');
        }
    }

    /**
     * Get current user profile (with retry logic)
     */
    async getProfile() {
        return retryWithBackoff(async () => {
            const response = await axios.get(`${API_BASE_URL}/api/agents/profile`, {
                headers: { Authorization: `Bearer ${this.getAccessToken()}` }
            });
            return response.data;
        }, 3, 1000).catch(error => {
            throw new Error(error.response?.data?.error || 'Failed to fetch profile');
        });
    }

    /**
     * Decode JWT token (without verification)
     */
    decodeToken(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('Failed to decode token:', error);
            return null;
        }
    }

    /**
     * Check if token is expired or will expire soon
     */
    isTokenExpired(token, bufferSeconds = 300) {
        const decoded = this.decodeToken(token);
        if (!decoded || !decoded.exp) return true;

        const expiryTime = decoded.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        const buffer = bufferSeconds * 1000; // 5 minutes buffer

        return now >= (expiryTime - buffer);
    }

    /**
     * Get time until token expires (in seconds)
     */
    getTokenExpiryTime(token) {
        const decoded = this.decodeToken(token);
        if (!decoded || !decoded.exp) return 0;

        const expiryTime = decoded.exp * 1000;
        const now = Date.now();
        const timeRemaining = Math.max(0, expiryTime - now);

        return Math.floor(timeRemaining / 1000);
    }

    /**
     * Access Token management
     */
    setAccessToken(token) {
        localStorage.setItem(this.accessTokenKey, token);
    }

    getAccessToken() {
        return localStorage.getItem(this.accessTokenKey);
    }

    /**
     * Refresh Token management
     */
    setRefreshToken(token) {
        localStorage.setItem(this.refreshTokenKey, token);
    }

    getRefreshToken() {
        return localStorage.getItem(this.refreshTokenKey);
    }

    /**
     * Agent/User management
     */
    setAgent(agent) {
        localStorage.setItem(this.agentKey, JSON.stringify(agent));
    }

    getAgent() {
        const agent = localStorage.getItem(this.agentKey);
        return agent ? JSON.parse(agent) : null;
    }

    // Legacy aliases for backward compatibility
    setToken(token) { this.setAccessToken(token); }
    getToken() { return this.getAccessToken(); }
    setUser(user) { this.setAgent(user); }
    getUser() { return this.getAgent(); }

    clearAuth() {
        localStorage.removeItem(this.accessTokenKey);
        localStorage.removeItem(this.refreshTokenKey);
        localStorage.removeItem(this.agentKey);
    }

    isAuthenticated() {
        const token = this.getAccessToken();
        return !!token && !this.isTokenExpired(token);
    }
}

export default new AuthService();
