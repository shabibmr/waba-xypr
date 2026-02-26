import { Request, Response } from 'express';
import mappingService from '../services/mappingService';
import logger from '../utils/logger';

class MappingController {
    async getByWaId(req: Request, res: Response) {
        try {
            const { waId } = req.params;
            const tenantId = req.query.tenantId as string || '';
            const result = await mappingService.getMappingByWaId(waId, tenantId);

            if (!result) {
                return res.status(404).json({ error: 'Mapping not found' });
            }

            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async getByConversationId(req: Request, res: Response) {
        try {
            const { conversationId } = req.params;
            const tenantId = req.query.tenantId as string || '';

            logger.info('Fetching mapping by conversation ID (init data request)', { conversationId, tenantId });

            const mapping = await mappingService.getMappingByConversationId(conversationId, tenantId);

            if (!mapping) {
                logger.warn('Mapping not found for conversation ID', { conversationId, tenantId });
                return res.status(404).json({ error: 'Mapping not found' });
            }

            logger.info('Successfully fetched mapping for conversation ID', { conversationId, tenantId });
            res.json(mappingService.formatMapping(mapping));
        } catch (error: any) {
            logger.error('Error fetching mapping by conversation ID', { conversationId: req.params.conversationId, error: error.message });
            res.status(500).json({ error: error.message });
        }
    }

    async updateConversation(req: Request, res: Response) {
        try {
            const { conversationId } = req.params;
            const tenantId = req.headers['x-tenant-id'] as string || req.query.tenantId as string || '';
            const { communicationId } = req.body;

            if (!communicationId) {
                return res.status(400).json({ error: 'communicationId is required' });
            }

            const mapping = await mappingService.updateConversationMapping(
                conversationId,
                { communicationId },
                tenantId
            );

            if (!mapping) {
                return res.status(404).json({ error: 'Active mapping not found for conversation' });
            }

            res.json(mappingService.formatMapping(mapping));
        } catch (error: any) {
            logger.error('Error updating conversation mapping', { conversationId: req.params.conversationId, error: error.message });
            res.status(500).json({ error: error.message });
        }
    }

    async correlate(req: Request, res: Response) {
        try {
            const { conversation_id, communication_id, whatsapp_message_id } = req.body;

            if (!conversation_id || !communication_id || !whatsapp_message_id) {
                return res.status(400).json({
                    error: 'conversation_id, communication_id, and whatsapp_message_id are required'
                });
            }

            const mapping = await mappingService.correlateConversation({
                conversation_id,
                communication_id,
                whatsapp_message_id
            }, req.body.tenantId || '');

            if (!mapping) {
                return res.status(409).json({
                    error: 'Conversation already correlated or message not found'
                });
            }

            res.json(mappingService.formatMapping(mapping));
        } catch (error: any) {
            logger.error('Correlation failed', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    }
}

export default new MappingController();
