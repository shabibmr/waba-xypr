/**
 * Health Routes
 * Routes for health check endpoints
 */

import express from 'express';
// @ts-ignore
import { healthCheck } from '../controllers/healthController';

const router = express.Router();

// GET /health - Health check endpoint
router.get('/', healthCheck);

export default router;
