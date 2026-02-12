import { Request, Response } from 'express';
import mappingService from '../services/mappingService';
import logger from '../utils/logger';

class MappingController {
    async createOrUpdate(req: Request, res: Response) {
        try {
            const { waId } = req.body;
            if (!waId) {
                return res.status(400).json({ error: 'waId is required' });
            }

            const result = await mappingService.createOrUpdateMapping(req.body);
            res.json(result);
        } catch (error: any) {
            logger.error('Mapping error', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    }

    async getByWaId(req: Request, res: Response) {
        try {
            const { waId } = req.params;
            const result = await mappingService.getMapping(waId);

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
            const mapping = await mappingService.getMappingByConversationId(conversationId);

            if (!mapping) {
                return res.status(404).json({ error: 'Mapping not found' });
            }

            res.json(mappingService.formatMapping(mapping));
        } catch (error: any) {
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
            });

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
