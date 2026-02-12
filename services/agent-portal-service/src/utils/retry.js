const logger = require('./logger');

/**
 * Exponential backoff retry wrapper for external service calls.
 *
 * @param {Function} fn - Async function to retry
 * @param {object} options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {Function} options.shouldRetry - Predicate to check if error is retryable
 * @param {string} options.label - Label for logging context
 * @returns {Promise<*>}
 */
async function withRetry(fn, options = {}) {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        shouldRetry = defaultShouldRetry,
        label = 'operation'
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt > maxRetries || !shouldRetry(error)) {
                throw error;
            }

            const delay = baseDelay * Math.pow(2, attempt - 1); // 1s, 2s, 4s
            logger.warn(`Retry attempt ${attempt}/${maxRetries} for ${label}`, {
                error: error.message,
                nextRetryMs: delay
            });

            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Default retry predicate: retry on 5xx and network errors.
 */
function defaultShouldRetry(error) {
    // Network errors (ECONNREFUSED, ETIMEDOUT, etc.)
    if (error.code && ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'].includes(error.code)) {
        return true;
    }
    // Axios 5xx errors
    if (error.response && error.response.status >= 500) {
        return true;
    }
    // Axios network error (no response)
    if (error.isAxiosError && !error.response) {
        return true;
    }
    return false;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { withRetry };
