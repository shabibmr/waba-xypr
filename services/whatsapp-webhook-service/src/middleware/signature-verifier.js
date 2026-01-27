/**
 * Signature Verifier Middleware
 * Verifies Meta webhook signatures
 */

const crypto = require('crypto');
const Logger = require('../utils/logger');

/**
 * Verify Meta webhook signature
 * @param {string} signature - Signature from x-hub-signature-256 header
 * @param {Object} body - Request body
 * @param {string} appSecret - App secret for HMAC verification
 * @returns {boolean} True if signature is valid
 */
function verifyMetaSignature(signature, body, appSecret) {
    if (!signature) {
        return false;
    }

    const hmac = crypto.createHmac('sha256', appSecret);

    // Use raw buffer if available (more reliable), otherwise fallback to stringify
    const bodyData = Buffer.isBuffer(body) ? body : JSON.stringify(body);

    const expectedSignature = 'sha256=' + hmac.update(bodyData).digest('hex');

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch {
        return false;
    }
}

/**
 * Create middleware for signature verification
 * Note: This is used programmatically in webhook processing
 * rather than as standard Express middleware due to tenant-specific secrets
 */
function createSignatureVerifier(appSecret) {
    return (req, res, next) => {
        const signature = req.headers['x-hub-signature-256'];

        if (!verifyMetaSignature(signature, req.body, appSecret)) {
            Logger.warn('Invalid webhook signature');
            return res.sendStatus(403);
        }

        next();
    };
}

module.exports = {
    verifyMetaSignature,
    createSignatureVerifier
};
