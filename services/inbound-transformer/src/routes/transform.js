/**
 * Transform Routes
 * Routes for message transformation endpoints
 */

const express = require('express');
const router = express.Router();
const transformController = require('../controllers/transformController');

// POST /transform/inbound - Manual transformation endpoint (for testing)
router.post('/inbound', transformController.transformInbound);

module.exports = router;
