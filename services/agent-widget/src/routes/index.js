// services/agent-widget/src/routes/index.js
const express = require('express');
const router = express.Router();
const widgetRoutes = require('./widget.routes');
const widgetController = require('../controllers/widget.controller');

// Health check
router.get('/health', widgetController.health);

// Mount widget routes at / (server already mounts this router at /widget)
router.use('/', widgetRoutes);

module.exports = router;
