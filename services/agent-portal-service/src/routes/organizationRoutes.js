const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { authenticate } = require('../middleware/authenticate');

// Sync organization users from Genesys (admin only)
router.post('/sync-users', authenticate, organizationController.syncOrganizationUsers);

// Get organization users from local database
router.get('/users', authenticate, organizationController.getOrganizationUsers);

// Organization profile management
router.get('/profile', authenticate, organizationController.getOrganizationProfile);
router.put('/profile', authenticate, organizationController.updateOrganizationProfile);

// Onboarding completion
router.post('/complete-onboarding', authenticate, organizationController.completeOnboarding);

module.exports = router;
