import { Request, Response } from 'express';
import messageService from '../services/messageService';

class MessageController {
    async track(req: Request, res: Response) {
        try {
            const { wamid, mappingId } = req.body;
            if (!wamid || !mappingId) {
                return res.status(400).json({ error: 'wamid and mappingId are required' });
            }
            const result = await messageService.trackMessageLegacy(req.body);
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
            const result = await messageService.updateStatusLegacy(wamid, status, genesysMessageId);
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

            const data = await messageService.getMessagesByMappingId(
                mappingId,
                Number(limit),
                Number(offset)
            );

            res.json(data);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new MessageController();
