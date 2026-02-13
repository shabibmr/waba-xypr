/**
 * Custom Error Classes
 * Specific error types for webhook processing
 */

class SignatureVerificationError extends Error {
    constructor(message = 'Invalid webhook signature') {
        super(message);
        this.name = 'SignatureVerificationError';
    }
}

class TenantResolutionError extends Error {
    constructor(message = 'Could not resolve tenant') {
        super(message);
        this.name = 'TenantResolutionError';
    }
}

class WebhookProcessingError extends Error {
    constructor(message = 'Webhook processing failed') {
        super(message);
        this.name = 'WebhookProcessingError';
    }
}

module.exports = {
    SignatureVerificationError,
    TenantResolutionError,
    WebhookProcessingError
};
