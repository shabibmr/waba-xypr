import { Request, Response, NextFunction } from 'express';
// @ts-ignore
import { processOutboundMessage } from '../services/message-processor.service';

/**
 * Manual transform endpoint handler (for testing)
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 */
export async function transformOutbound(req: Request, res: Response, next: NextFunction) {
    try {
        await processOutboundMessage(req.body);
        res.json({ success: true, message: 'Message transformed and sent' });
    } catch (error) {
        next(error);
    }
}
