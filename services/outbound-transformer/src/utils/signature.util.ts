import crypto from 'crypto';
// @ts-ignore
import config from '../config';

/**
 * Generate X-Hub-Signature-256 for webhook security
 * @param {Object} payload - The payload to sign
 * @returns {string} Signature in format 'sha256=...'
 */
export function generateSignature(payload: any) {
    const hmac = crypto.createHmac('sha256', config.meta.appSecret);
    return 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
}
