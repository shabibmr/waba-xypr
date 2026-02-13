import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
// @ts-ignore
import logger from '../utils/logger';
// @ts-ignore
import tenantService from '../services/tenant.service';
// @ts-ignore
import config from '../config/config';

/**
 * Validates X-Hub-Signature-256 header from Genesys Cloud.
 *
 * 01-A: integrationId extracted from channel.from.id only
 * 01-B: tenant resolved via GET /api/v1/tenants/by-integration/{id} (single call, gets webhookSecret)
 * 01-C: No State Manager fallback
 */
async function validateSignature(req: any, res: Response, next: NextFunction) {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;

    if (!signature) {
        logger.warn('Missing X-Hub-Signature-256 header');
        return res.status(401).json({ error: 'Missing signature' });
    }

    if (!req.rawBody) {
        logger.error('Raw body not available for signature validation');
        return res.status(500).json({ error: 'Internal server error' });
    }

    // 01-A: Extract integrationId ONLY from channel.from.id
    const integrationId = req.body?.channel?.from?.id;
    if (!integrationId) {
        logger.warn('Missing integrationId in channel.from.id');
        return res.status(401).json({ error: 'Missing integration ID' });
    }

    try {
        // 01-B: Single call — resolve tenant and get webhookSecret
        const tenant = await tenantService.getByIntegrationId(integrationId);
        if (!tenant) {
            logger.warn('Unknown tenant for integrationId', { integrationId });
            return res.status(404).json({ error: 'Tenant not found' });
        }

        // Resolve secret: prefer from by-integration response, fall back to credentials endpoint, then env
        let secret: string | undefined | null = tenant.webhookSecret;
        if (!secret) {
            secret = await tenantService.getTenantWebhookSecret(tenant.tenantId);
        }
        if (!secret) {
            logger.warn('No webhook secret configured, using env fallback', { tenantId: tenant.tenantId });
            secret = config.webhook.secret;
        }
        if (!secret) {
            logger.error('No webhook secret available', { tenantId: tenant.tenantId });
            return res.status(500).json({ error: 'Webhook secret not configured' });
        }

        // Compute HMAC-SHA256 (hex only — FRD specifies hex)
        const computed = `sha256=${crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex')}`;

        // Constant-time comparison
        let valid = false;
        try {
            const bufSig = Buffer.from(signature);
            const bufCmp = Buffer.from(computed);
            valid = bufSig.length === bufCmp.length && crypto.timingSafeEqual(bufSig, bufCmp);
        } catch {
            valid = false;
        }

        if (!valid) {
            logger.warn('Invalid webhook signature', { tenantId: tenant.tenantId });
            return res.status(401).json({ error: 'Invalid signature' });
        }

        req.tenantId = tenant.tenantId;
        next();

    } catch (error: any) {
        logger.error('Signature validation error', { error: error.message });
        return res.status(500).json({ error: 'Internal server error' });
    }
}

export default validateSignature;
