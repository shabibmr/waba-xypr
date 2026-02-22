/**
 * Genesys controller
 * Handles all Genesys API-related request/response logic
 */

import { Request, Response, NextFunction } from 'express';
// @ts-ignore
import * as genesysApiService from '../services/genesys-api.service';
// @ts-ignore
import { mapStatusToGenesys } from '../utils/status-mapper';
// @ts-ignore
import * as logger from '../utils/logger';

/**
 * Send delivery receipt to Genesys
 */
export async function sendReceipt(req: any, res: Response, next: NextFunction) {
    try {
        const { conversationId, messageId, status, timestamp } = req.body;
        const tenantId = req.headers['x-tenant-id'] as string;

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
export async function getConversation(req: any, res: Response, next: NextFunction) {
    try {
        const { conversationId } = req.params;
        const tenantId = req.headers['x-tenant-id'] as string;

        const result = await genesysApiService.getConversation(tenantId, conversationId);

        res.json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * Update conversation attributes
 */
export async function updateConversationAttributes(req: any, res: Response, next: NextFunction) {
    try {
        const { conversationId } = req.params;
        const { attributes } = req.body;
        const tenantId = req.headers['x-tenant-id'] as string;

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
export async function disconnectConversation(req: any, res: Response, next: NextFunction) {
    try {
        const { conversationId } = req.params;
        const tenantId = req.headers['x-tenant-id'] as string;

        const result = await genesysApiService.disconnectConversation(tenantId, conversationId);

        res.json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * Send typing indicator
 */
export async function sendTypingIndicator(req: any, res: Response, next: NextFunction) {
    try {
        const { from, isTyping = true } = req.body;
        const tenantId = req.headers['x-tenant-id'] as string;

        if (!from || !from.id) {
            return res.status(400).json({
                error: 'from object with id field is required'
            });
        }

        const result = await genesysApiService.sendTypingIndicator(
            tenantId,
            from,
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
export async function getConversationMessages(req: any, res: Response, next: NextFunction) {
    try {
        const { conversationId } = req.params;
        const tenantId = req.headers['x-tenant-id'] as string;

        const result = await genesysApiService.getConversationMessages(tenantId, conversationId);

        res.json(result);
    } catch (error) {
        next(error);
    }
}


/**
 * Get organization users
 */
export async function getOrganizationUsers(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = req.headers['x-tenant-id'] || req.tenant?.id;
        const { pageSize, pageNumber } = req.query;

        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID required (X-Tenant-ID header or auth context)' });
        }

        const result = await genesysApiService.getOrganizationUsers(tenantId, {
            pageSize: parseInt(pageSize as string) || 100,
            pageNumber: parseInt(pageNumber as string) || 1
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * Get organization details
 */
export async function getOrganizationDetails(req: any, res: Response, next: NextFunction) {
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
export async function getGenesysUser(req: any, res: Response, next: NextFunction) {
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
