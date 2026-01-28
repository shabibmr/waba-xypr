/**
 * Health Routes
 * Routes for health check endpoints
 */

import express from 'express';
// @ts-ignore
import healthController from '../controllers/healthController';

const router = express.Router();

// GET /health - Health check endpoint
router.get('/', healthController.healthCheck);

export default router;
