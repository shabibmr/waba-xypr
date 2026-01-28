/**
 * Transform Controller
 * Handles transformation request endpoints
 */

import { Request, Response } from 'express';
// @ts-ignore
import { processInboundMessage } from '../services/transformerService';

/**
 * Handle manual transformation request (for testing)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function transformInbound(req: Request, res: Response): Promise<void> {
    try {
        await processInboundMessage(req.body);
        res.json({ success: true, message: 'Message transformed and sent' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
