import { Request, Response } from 'express';
import messageService from '../services/messageService.js';

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
            const { status } = req.body;
            await messageService.updateStatus(messageId, status);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new MessageController();
