import express from 'express';
const router = express.Router();

import mappingController from '../controllers/mappingController.js';
import messageController from '../controllers/messageController.js';
import contextController from '../controllers/contextController.js';
import statsController from '../controllers/statsController.js';

// Mapping routes
router.post('/mapping', mappingController.createOrUpdate);
router.get('/mapping/:waId', mappingController.getByWaId);
router.get('/conversation/:conversationId', mappingController.getByConversationId);

// Message routes
router.post('/message', messageController.track);
router.patch('/message/:messageId', messageController.updateStatus);

// Context routes
router.post('/context/:conversationId', contextController.updateContext);
router.get('/context/:conversationId', contextController.getContext);

// Stats route
router.get('/stats', statsController.getStats);

export default router;
