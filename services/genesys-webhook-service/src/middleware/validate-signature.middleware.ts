import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
// @ts-ignore
import logger from '../utils/logger';
// @ts-ignore
import tenantService from '../services/tenant.service';

/**
 * Validates X-Hub-Signature-256 header from Genesys Cloud
 */
async function validateSignature(req: any, res: Response, next: NextFunction) {
    const signature = req.headers['x-hub-signature-256'];

    if (!signature) {
        logger.warn('Missing X-Hub-Signature-256 header');
        return res.status(401).json({ error: 'Missing signature' });
    }

    try {
        if (!req.rawBody) {
            logger.error('Raw body not available for signature validation');
            return res.status(500).json({ error: 'Internal server error' });
        }

        const body = req.body; // Parsed body

        // 1. Extract identification to find tenant
        let conversationId = body.conversationId;
        let integrationId = body.channel?.integrationId || body.channel?.from?.id; 

        // Resolve Tenant
        const tenantId = await tenantService.resolveTenant(conversationId, integrationId);

        if (!tenantId) {
            logger.warn('Could not resolve tenant for signature validation', { conversationId, integrationId });
            return res.status(404).json({ error: 'Tenant not found' });
        }

        // Get Secret
        const secret = await tenantService.getTenantWebhookSecret(tenantId);

        if (!secret) {
            logger.warn('No webhook secret configured for tenant', { tenantId });
            return res.status(401).json({ error: 'Webhook secret not configured' });
        }

        // Compute HMAC
        const hmacBase64 = crypto.createHmac('sha256', secret);
        const computedSignatureBase64 = `sha256=${hmacBase64.update(req.rawBody).digest('base64')}`;

        const hmacHex = crypto.createHmac('sha256', secret);
        const computedSignatureHex = `sha256=${hmacHex.update(req.rawBody).digest('hex')}`;

        if (signature !== computedSignatureBase64 && signature !== computedSignatureHex) {
            logger.warn('Invalid webhook signature', { 
                tenantId, 
                received: signature, 
                expectedBase64: computedSignatureBase64,
                expectedHex: computedSignatureHex
            });
            return res.status(401).json({ error: 'Invalid signature' });
        }

        req.tenantId = tenantId; // Pass it down
        next();

    } catch (error: any) {
        logger.error('Signature validation error', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export default validateSignature;
