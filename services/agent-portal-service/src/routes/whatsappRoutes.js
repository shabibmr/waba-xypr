const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { authenticate } = require('../middleware/authenticate');

// WhatsApp status (read-only for agents - shows tenant's WABA)
router.get('/whatsapp/status', authenticate, whatsappController.getWhatsAppStatus);

// Complete WhatsApp setup
router.post('/whatsapp/setup', authenticate, whatsappController.completeSetup);

// Skip setup (demo mode)
router.post('/whatsapp/setup/skip', authenticate, whatsappController.skipSetup);

module.exports = router;
