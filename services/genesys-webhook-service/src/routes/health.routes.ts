import express, { Request, Response } from 'express';
// @ts-ignore
import rabbitMQService from '../services/rabbitmq.service';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        service: 'genesys-webhook-service',
        rabbitmq: rabbitMQService.isConnected ? 'connected' : 'disconnected'
    });
});

export default router;
