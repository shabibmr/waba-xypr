const express = require('express');
const router = express.Router();

const tenantRoutes = require('./tenantRoutes');
const whatsappRoutes = require('./whatsappRoutes');
const credentialRoutes = require('./credentialRoutes');
const whatsappController = require('../controllers/whatsappController');

// WhatsApp routes first (has /tenants/by-phone which must match before /:tenantId)
router.use('/api', whatsappRoutes);
router.use('/', whatsappRoutes);

// Tenant Routes
router.use('/api/tenants', tenantRoutes);
router.use('/tenants', tenantRoutes);

// Credential Routes (mounted at both /api/tenants and /tenants)
router.use('/api/tenants', credentialRoutes);
router.use('/tenants', credentialRoutes);

// WhatsApp Signup Route
const apiWhatsappRouter = express.Router();
apiWhatsappRouter.post('/signup', whatsappController.handleSignupCallback);
router.use('/api/whatsapp', apiWhatsappRouter);

module.exports = router;
