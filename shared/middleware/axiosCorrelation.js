/**
 * Axios Interceptor for Correlation IDs
 *
 * Automatically attaches X-Correlation-ID to all outgoing axios requests
 *
 * Usage:
 *   const axios = require('axios');
 *   const { setupAxiosInterceptor } = require('../../shared/middleware/axiosCorrelation');
 *
 *   // In your Express app after correlationId middleware:
 *   setupAxiosInterceptor(axios);
 */

/**
 * Setup axios interceptor to automatically add correlation IDs
 * @param {Object} axiosInstance - Axios instance
 */
function setupAxiosInterceptor(axiosInstance) {
    // Request interceptor - add correlation ID to outgoing requests
    axiosInstance.interceptors.request.use(
        (config) => {
            // Try to get correlation ID from various sources
            // Note: This works best when combined with async local storage or similar
            if (global.currentCorrelationId) {
                if (!config.headers) {
                    config.headers = {};
                }
                config.headers['X-Correlation-ID'] = global.currentCorrelationId;
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    return axiosInstance;
}

/**
 * Create axios config with correlation ID
 * For manual control when not using interceptors
 *
 * @param {string} correlationId - Correlation ID from request
 * @param {Object} existingConfig - Existing axios config
 * @returns {Object} Axios config with correlation ID header
 */
function withCorrelationId(correlationId, existingConfig = {}) {
    return {
        ...existingConfig,
        headers: {
            ...(existingConfig.headers || {}),
            'X-Correlation-ID': correlationId
        }
    };
}

module.exports = {
    setupAxiosInterceptor,
    withCorrelationId
};
