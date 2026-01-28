/**
 * Transform Routes
 * Routes for message transformation endpoints
 */

import express from 'express';
// @ts-ignore
import transformController from '../controllers/transformController';

const router = express.Router();

// POST /transform/inbound - Manual transformation endpoint (for testing)
router.post('/inbound', transformController.transformInbound);

export default router;
