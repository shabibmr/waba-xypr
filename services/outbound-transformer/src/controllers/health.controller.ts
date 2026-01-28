import { Request, Response } from 'express';
import { getChannel } from '../services/rabbitmq.service';

/**
 * Health check endpoint handler
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
export function healthCheck(req: Request, res: Response) {
    const rabbitChannel = getChannel();

    res.json({
        status: 'healthy',
        rabbitmq: rabbitChannel ? 'connected' : 'disconnected'
    });
}
