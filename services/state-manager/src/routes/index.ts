import express from 'express';
const router = express.Router();

import mappingController from '../controllers/mappingController';
import messageController from '../controllers/messageController';
import contextController from '../controllers/contextController';
import statsController from '../controllers/statsController';

// Mapping routes
router.get('/mapping/:waId', mappingController.getByWaId);
router.get('/conversation/:conversationId', mappingController.getByConversationId);
router.post('/correlate', mappingController.correlate);
router.post('/correlation', mappingController.correlate);

// Message routes
router.post('/message', messageController.track);
router.patch('/message/:wamid/status', messageController.updateStatus);
router.get('/mapping/:mappingId/messages', messageController.getMessages);
router.get('/conversation/:conversationId/messages', messageController.getMessagesByConversationId);

// Context routes
router.post('/context/:conversationId', contextController.updateContext);
router.get('/context/:conversationId', contextController.getContext);

// Stats route
router.get('/stats', statsController.getStats);
router.get('/stats/summary', statsController.getStatsSummary);
router.get('/analytics/metrics', statsController.getMetrics);

export default router;
