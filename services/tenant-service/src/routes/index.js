const express = require('express');
const router = express.Router();

const tenantRoutes = require('./tenantRoutes');
const whatsappRoutes = require('./whatsappRoutes');
const credentialRoutes = require('./credentialRoutes');
const whatsappController = require('../controllers/whatsappController');

// Tenant Routes
router.use('/api/tenants', tenantRoutes);

// Helper for mounting tenant-sub-resources that are defined with /tenants/:id prefix in their files
router.use('/api', whatsappRoutes);

// Credential Routes (mounted at /api/tenants to match /:tenantId/credentials inside)
router.use('/api/tenants', credentialRoutes);

// WhatsApp Signup Route
const apiWhatsappRouter = express.Router();
apiWhatsappRouter.post('/signup', whatsappController.handleSignupCallback);
router.use('/api/whatsapp', apiWhatsappRouter);

module.exports = router;
