import { Request, Response } from 'express';
import mappingService from '../services/mappingService.js';

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
            console.error('Mapping error:', error);
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
            const result = await mappingService.getMappingByConversationId(conversationId);

            if (!result) {
                return res.status(404).json({ error: 'Mapping not found' });
            }

            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new MappingController();
