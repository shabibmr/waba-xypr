import axios from 'axios';
import authService from './authService';

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000';

// Configure axios defaults
axios.defaults.timeout = 30000; // 30 seconds default timeout

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

/**
 * Setup axios interceptors for automatic token refresh
 */
export const setupAxiosInterceptors = (onLogout) => {
    // Request interceptor - Add auth token to requests
    axios.interceptors.request.use(
        (config) => {
            const token = authService.getAccessToken();

            if (token && config.url?.startsWith(API_BASE_URL)) {
                config.headers.Authorization = `Bearer ${token}`;
            }

            // Ensure timeout is set (use config timeout or default)
            if (!config.timeout) {
                config.timeout = 30000;
            }

            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    // Response interceptor - Handle 401 errors and refresh token
    axios.interceptors.response.use(
        (response) => {
            return response;
        },
        async (error) => {
            const originalRequest = error.config;

            // Skip refresh for login/callback/refresh endpoints
            if (
                originalRequest.url?.includes('/auth/login') ||
                originalRequest.url?.includes('/auth/callback') ||
                originalRequest.url?.includes('/auth/refresh')
            ) {
                return Promise.reject(error);
            }

            // If 401 error and not already retried
            if (error.response?.status === 401 && !originalRequest._retry) {
                if (isRefreshing) {
                    // Queue the request while refresh is in progress
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    })
                        .then(token => {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                            return axios(originalRequest);
                        })
                        .catch(err => {
                            return Promise.reject(err);
                        });
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    // Attempt to refresh token
                    const newAccessToken = await authService.refreshAccessToken();

                    // Update the failed queue
                    processQueue(null, newAccessToken);

                    // Retry original request with new token
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return axios(originalRequest);
                } catch (refreshError) {
                    // Refresh failed - logout user
                    processQueue(refreshError, null);
                    authService.clearAuth();

                    if (onLogout) {
                        onLogout();
                    }

                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }

            return Promise.reject(error);
        }
    );
};

export default setupAxiosInterceptors;
