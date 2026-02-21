const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');
const mediaService = require('../services/media.service');
const rabbitMQService = require('../services/rabbitmq.service');

const stateManagerUrl = config.services.stateManager || 'http://state-manager:3005';
const tenantServiceUrl = config.services.tenantService || 'http://tenant-service:3007';

// Multer for widget file uploads (16 MB limit)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 16 * 1024 * 1024 }
});

/**
 * Widget-specific routes — NO AUTH required.
 * These are called by the Genesys iframe widget which has no portal session.
 * All routes are read-only or scoped to safe operations.
 */

// Resolve tenant by integration ID
router.get('/resolve-tenant/:integrationId', async (req, res, next) => {
    try {
        const { integrationId } = req.params;
        const response = await axios.get(
            `${tenantServiceUrl}/tenants/by-integration/${integrationId}`
        );
        res.json(response.data);
    } catch (error) {
        if (error.response?.status === 404) {
            return res.status(404).json({ error: 'Tenant not found for integration ID' });
        }
        logger.error('Widget: resolve-tenant error', { integrationId: req.params.integrationId, error: error.message });
        next(error);
    }
});

// Get conversation details (read-only)
router.get('/conversations/:conversationId', async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const tenantId = req.headers['x-tenant-id'] || 'default';

        const response = await axios.get(
            `${stateManagerUrl}/state/conversation/${conversationId}`,
            { headers: { 'X-Tenant-ID': tenantId } }
        );
        res.json(response.data);
    } catch (error) {
        if (error.response?.status === 404) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        next(error);
    }
});

// Get conversation messages (read-only)
router.get('/conversations/:conversationId/messages', async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const tenantId = req.headers['x-tenant-id'] || 'default';
        const { limit = 50, offset = 0 } = req.query;

        const response = await axios.get(
            `${stateManagerUrl}/state/conversation/${conversationId}/messages`,
            {
                params: { limit, offset },
                headers: { 'X-Tenant-ID': tenantId }
            }
        );
        res.json(response.data);
    } catch (error) {
        next(error);
    }
});

// Upload media file (widget — no auth)
router.post('/upload-media', upload.single('file'), async (req, res, next) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || 'default';

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const result = await mediaService.uploadMedia(
            req.file.buffer,
            req.file.mimetype,
            tenantId
        );

        res.json({
            url: result.publicUrl,
            mimeType: result.mimeType,
            fileSize: result.fileSize
        });
    } catch (error) {
        logger.error('Widget: upload-media error', { error: error.message });
        next(error);
    }
});

// Send message with optional media (widget — no auth)
router.post('/send-message', async (req, res, next) => {
    const tenantId = req.headers['x-tenant-id'] || req.body.tenant_id || req.body.tenantId || 'default';
    const { conversationId, waId, text, mediaUrl, mediaType, integrationId } = req.body;

    if (!conversationId) {
        return res.status(400).json({ error: 'conversationId is required' });
    }
    if (!text && !mediaUrl) {
        return res.status(400).json({ error: 'Either text or mediaUrl is required' });
    }

    const syntheticWamid = `agent_${uuidv4()}`;
    const tenantHeader = { 'X-Tenant-ID': tenantId };

    try {
        // 1. Resolve mapping from state-manager
        const mappingRes = await axios.get(
            `${stateManagerUrl}/state/conversation/${conversationId}`,
            { headers: tenantHeader }
        );
        const mapping = mappingRes.data;

        if (!mapping?.waId && !waId) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // 2. Store outbound message (queued)
        await axios.post(
            `${stateManagerUrl}/state/message`,
            {
                wamid: syntheticWamid,
                mappingId: mapping.internalId || mapping.id,
                direction: 'outbound',
                status: 'queued',
                metadata: JSON.stringify({
                    text: text || null,
                    mediaUrl: mediaUrl || null,
                    mediaType: mediaType || null,
                    integrationId: integrationId || null
                })
            },
            { headers: tenantHeader }
        ).catch(err => {
            logger.warn('Widget: Failed to store outbound message', { error: err.message });
        });

        // 3. Publish to Queue (instead of direct Genesys call)
        const queuePayload = {
            tenantId,
            conversationId,
            communicationId: mapping.communicationId,
            text,
            mediaUrl,
            mediaType,
            integrationId,
            wamid: syntheticWamid,
            timestamp: new Date().toISOString()
        };

        await rabbitMQService.publishAgentWidgetMessage(queuePayload);

        logger.info('Widget: message queued for Genesys', {
            tenantId,
            conversationId,
            wamid: syntheticWamid,
            hasMedia: !!mediaUrl
        });

        res.json({ success: true, messageId: syntheticWamid });
    } catch (error) {
        logger.error('Widget: send-message error', {
            tenantId, conversationId, error: error.message, status: error.response?.status
        });

        if (error.response?.status === 404) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        if (error.response?.status === 401 || error.response?.status === 403) {
            return res.status(502).json({ error: 'Genesys authentication failed' });
        }
        next(error);
    }
});

module.exports = router;
