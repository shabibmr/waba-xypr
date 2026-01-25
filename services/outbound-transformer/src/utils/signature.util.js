const crypto = require('crypto');
const config = require('../config');

/**
 * Generate X-Hub-Signature-256 for webhook security
 * @param {Object} payload - The payload to sign
 * @returns {string} Signature in format 'sha256=...'
 */
function generateSignature(payload) {
    const hmac = crypto.createHmac('sha256', config.meta.appSecret);
    return 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
}

module.exports = {
    generateSignature
};
