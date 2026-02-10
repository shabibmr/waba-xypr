const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// Store WhatsApp WABA credentials
router.post('/tenants/:tenantId/whatsapp', whatsappController.updateWhatsAppConfig);

// Get WhatsApp configuration (masked for security)
router.get('/tenants/:tenantId/whatsapp', whatsappController.getWhatsAppConfig);

// Lookup tenant by WhatsApp phone number ID
router.get('/tenants/by-phone/:phoneNumberId', whatsappController.getTenantByPhone);

// Get Meta credentials for a tenant
router.get('/tenants/:tenantId/credentials/meta', whatsappController.getMetaCredentials);

module.exports = router;
