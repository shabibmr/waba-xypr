const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { authenticate } = require('../middleware/authenticate');
const validate = require('../middleware/validation');
const organizationSchemas = require('../middleware/validation/organization.schema');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Temporary storage before MinIO upload

// Sync organization users from Genesys (admin only)
router.post('/sync-users', authenticate, organizationController.syncOrganizationUsers);

// Get organization users from local database
router.get('/users', authenticate, organizationController.getOrganizationUsers);

// Organization profile management
router.get('/profile', authenticate, organizationController.getOrganizationProfile);
router.put('/profile', authenticate, validate(organizationSchemas.updateProfile), organizationController.updateOrganizationProfile);

// Logo upload
router.put('/profile/logo', authenticate, upload.single('logo'), organizationController.updateLogo);

// WhatsApp token update
router.put('/whatsapp-token', authenticate, organizationController.updateWhatsAppToken);

// Onboarding completion


module.exports = router;
