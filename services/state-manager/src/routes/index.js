const express = require('express');
const router = express.Router();

const mappingController = require('../controllers/mappingController');
const messageController = require('../controllers/messageController');
const contextController = require('../controllers/contextController');
const statsController = require('../controllers/statsController');

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

module.exports = router;
