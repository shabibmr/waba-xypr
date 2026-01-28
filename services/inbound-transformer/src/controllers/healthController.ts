/**
 * Health Controller
 * Handles health check endpoints
 */

import { Request, Response } from 'express';
// @ts-ignore
import { getChannel } from '../consumers/inboundConsumer';

/**
 * Health check endpoint handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export function healthCheck(req: Request, res: Response): void {
    const channel = getChannel();

    res.json({
        status: 'healthy',
        rabbitmq: channel ? 'connected' : 'disconnected'
    });
}
