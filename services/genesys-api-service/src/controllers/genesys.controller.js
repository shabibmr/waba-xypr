/**
 * Genesys controller
 * Handles all Genesys API-related request/response logic
 */

const genesysApiService = require('../services/genesys-api.service');
const { mapStatusToGenesys } = require('../utils/status-mapper');
const logger = require('../utils/logger');

/**
 * Send inbound message to Genesys
 */
async function sendInboundMessage(req, res, next) {
    try {
        const { conversationId, from, text, metadata, isNew = false } = req.body;
        const tenantId = req.tenant.id;

        const result = await genesysApiService.sendInboundMessage(tenantId, {
            conversationId,
            from,
            text,
            metadata,
            isNew
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * Send delivery receipt to Genesys
 */
async function sendReceipt(req, res, next) {
    try {
        const { conversationId, messageId, status, timestamp } = req.body;
        const tenantId = req.tenant.id;

        if (!conversationId || !messageId || !status) {
            return res.status(400).json({
                error: 'conversationId, messageId, and status are required'
            });
        }

        const result = await genesysApiService.sendReceipt(tenantId, {
            conversationId,
            messageId,
            status: mapStatusToGenesys(status),
            timestamp
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * Get conversation details
 */
async function getConversation(req, res, next) {
    try {
        const { conversationId } = req.params;
        const tenantId = req.tenant.id;

        const result = await genesysApiService.getConversation(tenantId, conversationId);

        res.json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * Update conversation attributes
 */
async function updateConversationAttributes(req, res, next) {
    try {
        const { conversationId } = req.params;
        const { attributes } = req.body;
        const tenantId = req.tenant.id;

        const result = await genesysApiService.updateConversationAttributes(
            tenantId,
            conversationId,
            attributes
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * Disconnect conversation
 */
async function disconnectConversation(req, res, next) {
    try {
        const { conversationId } = req.params;
        const tenantId = req.tenant.id;

        const result = await genesysApiService.disconnectConversation(tenantId, conversationId);

        res.json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * Send typing indicator
 */
async function sendTypingIndicator(req, res, next) {
    try {
        const { conversationId } = req.params;
        const { isTyping = true } = req.body;
        const tenantId = req.tenant.id;

        const result = await genesysApiService.sendTypingIndicator(
            tenantId,
            conversationId,
            isTyping
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * Get conversation messages
 */
async function getConversationMessages(req, res, next) {
    try {
        const { conversationId } = req.params;
        const tenantId = req.tenant.id;

        const result = await genesysApiService.getConversationMessages(tenantId, conversationId);

        res.json(result);
    } catch (error) {
        next(error);
    }
}


/**
 * Get organization users
 */
async function getOrganizationUsers(req, res, next) {
    try {
        const tenantId = req.headers['x-tenant-id'] || req.tenant?.id;
        const { pageSize, pageNumber } = req.query;

        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID required (X-Tenant-ID header or auth context)' });
        }

        const result = await genesysApiService.getOrganizationUsers(tenantId, {
            pageSize: parseInt(pageSize) || 100,
            pageNumber: parseInt(pageNumber) || 1
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * Get organization details
 */
async function getOrganizationDetails(req, res, next) {
    try {
        const tenantId = req.headers['x-tenant-id'] || req.tenant?.id;

        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID required (X-Tenant-ID header or auth context)' });
        }

        const result = await genesysApiService.getOrganizationDetails(tenantId);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * Get specific Genesys user
 */
async function getGenesysUser(req, res, next) {
    try {
        const tenantId = req.headers['x-tenant-id'] || req.tenant?.id;
        const { userId } = req.params;

        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID required (X-Tenant-ID header or auth context)' });
        }

        const result = await genesysApiService.getGenesysUser(tenantId, userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    sendInboundMessage,
    sendReceipt,
    getConversation,
    updateConversationAttributes,
    disconnectConversation,
    sendTypingIndicator,
    getConversationMessages,
    getOrganizationUsers,
    getOrganizationDetails,
    getGenesysUser
};
