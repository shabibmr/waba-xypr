/**
 * Health check routes
 * Service health monitoring endpoints
 */

/**
 * Health check routes
 * Service health monitoring endpoints
 */

import express, { Request, Response } from 'express';
const router = express.Router();

// Health check endpoint
router.get('/', (req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        service: 'genesys-api'
    });
});

export default router;
