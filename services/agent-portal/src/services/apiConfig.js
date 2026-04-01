/**
 * Resolve the API base URL.
 * When the page is loaded over HTTPS (e.g. via ngrok), use the current origin
 * so the browser doesn't block mixed-content requests to an HTTP backend.
 */
const configuredUrl = import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000';

export const API_BASE_URL =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? window.location.origin
        : configuredUrl;
