import { Request, Response, NextFunction } from 'express';
import { processOutboundMessage } from '../services/message-processor.service';
import { validateInputMessage } from '../services/validator.service';
import { InputMessage } from '../types/messages';

/**
 * Manual transform endpoint handler (for testing)
 */
export async function transformOutbound(req: Request, res: Response, next: NextFunction) {
    try {
        const validation = validateInputMessage(req.body);
        if (!validation.valid) {
            return res.status(400).json({ error: 'Validation failed', details: validation.errors });
        }

        await processOutboundMessage(req.body as InputMessage);
        res.json({ success: true, message: 'Message transformed and dispatched' });
    } catch (error) {
        next(error);
    }
}
