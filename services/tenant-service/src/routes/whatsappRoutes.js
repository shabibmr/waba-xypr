const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// Store WhatsApp WABA credentials
router.post('/tenants/:tenantId/whatsapp', whatsappController.updateWhatsAppConfig);

// Get WhatsApp configuration (masked for security)
router.get('/tenants/:tenantId/whatsapp', whatsappController.getWhatsAppConfig);

module.exports = router;
