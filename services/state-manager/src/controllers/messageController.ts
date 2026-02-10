import { Request, Response } from 'express';
import messageService from '../services/messageService';

class MessageController {
    async track(req: Request, res: Response) {
        try {
            await messageService.trackMessage(req.body);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateStatus(req: Request, res: Response) {
        try {
            const { messageId } = req.params;
            const { status, genesysMessageId } = req.body;
            await messageService.updateStatus(messageId, status, genesysMessageId);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async getMessages(req: Request, res: Response) {
        try {
            const { conversationId } = req.params;
            const { limit = 50, offset = 0 } = req.query;

            const data = await messageService.getMessagesByConversation(
                conversationId,
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
