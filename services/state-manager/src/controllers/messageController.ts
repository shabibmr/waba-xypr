import { Request, Response } from 'express';
import messageService from '../services/messageService';
import mappingService from '../services/mappingService';

class MessageController {
    async track(req: Request, res: Response) {
        try {
            const { wamid, mappingId } = req.body;
            if (!wamid || !mappingId) {
                return res.status(400).json({ error: 'wamid and mappingId are required' });
            }
            const tenantId = req.headers['x-tenant-id'] as string;
            const result = await messageService.trackMessageLegacy({ ...req.body, tenantId });
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateStatus(req: Request, res: Response) {
        try {
            const { wamid } = req.params;
            const { status, genesysMessageId } = req.body;
            if (!status) {
                return res.status(400).json({ error: 'status is required' });
            }
            const tenantId = req.headers['x-tenant-id'] as string;
            const result = await messageService.updateStatusLegacy(wamid, status, genesysMessageId, tenantId);
            if (!result.success) {
                return res.status(400).json(result);
            }
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async getMessages(req: Request, res: Response) {
        try {
            const { mappingId } = req.params;
            const { limit = 50, offset = 0 } = req.query;
            const tenantId = req.headers['x-tenant-id'] as string;

            const data = await messageService.getMessagesByMappingId(
                mappingId,
                Number(limit),
                Number(offset),
                tenantId
            );

            res.json(data);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async getMessagesByConversationId(req: Request, res: Response) {
        try {
            const { conversationId } = req.params;
            const { limit = 50, offset = 0 } = req.query;
            const tenantId = req.headers['x-tenant-id'] as string;

            if (!tenantId) {
                return res.status(400).json({ error: 'Tenant ID is required' });
            }

            const mapping = await mappingService.getMappingByConversationId(conversationId, tenantId);
            if (!mapping) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            // 2. Get messages
            const data = await messageService.getMessagesByMappingId(
                mapping.id,
                Number(limit),
                Number(offset),
                tenantId
            );

            // 3. Fetch tenant and integration IDs from tenant-service using phone_number_id
            let resolvedTenantId = tenantId;
            let integrationId = null;

            const tenantServiceUrl = process.env.TENANT_SERVICE_URL || 'http://tenant-service:3007';

            // Try by phone_number_id first, then by communication_id (= genesys_integration_id)
            if (mapping.phone_number_id) {
                try {
                    const resp = await fetch(`${tenantServiceUrl}/tenants/by-phone/${mapping.phone_number_id}`);
                    if (resp.ok) {
                        const tenantData = await resp.json() as any;
                        resolvedTenantId = tenantData.id || tenantData.tenantId || tenantId;
                        integrationId = tenantData.genesysIntegrationId || tenantData.genesys_integration_id || null;
                    }
                } catch (tenantError: any) {
                    console.error('[MessageController] Failed to fetch tenant by phone:', tenantError.message);
                }
            }

            // Fallback: resolve by communication_id → genesys_integration_id
            if (resolvedTenantId === tenantId && mapping.communication_id) {
                try {
                    const resp = await fetch(`${tenantServiceUrl}/tenants/by-integration/${mapping.communication_id}`);
                    if (resp.ok) {
                        const tenantData = await resp.json() as any;
                        resolvedTenantId = tenantData.id || tenantData.tenantId || tenantId;
                        integrationId = tenantData.genesysIntegrationId || tenantData.genesys_integration_id || mapping.communication_id;
                    }
                } catch (tenantError: any) {
                    console.error('[MessageController] Failed to fetch tenant by integration:', tenantError.message);
                }
            }

            res.json({
                ...data,
                tenant_id: resolvedTenantId,
                integrationId: integrationId
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new MessageController();
