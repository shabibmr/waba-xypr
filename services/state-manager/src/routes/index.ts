import express from 'express';
const router = express.Router();

import mappingController from '../controllers/mappingController';
import messageController from '../controllers/messageController';
import contextController from '../controllers/contextController';
import statsController from '../controllers/statsController';

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
