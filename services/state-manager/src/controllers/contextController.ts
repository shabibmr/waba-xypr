import { Request, Response } from 'express';
import contextService from '../services/contextService';

class ContextController {
    async updateContext(req: Request, res: Response) {
        try {
            const { conversationId } = req.params;
            const { context } = req.body;
            await contextService.updateContext(conversationId, context);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async getContext(req: Request, res: Response) {
        try {
            const { conversationId } = req.params;
            const context = await contextService.getContext(conversationId);
            res.json({ context });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new ContextController();
