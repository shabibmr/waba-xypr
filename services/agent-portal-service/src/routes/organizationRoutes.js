const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { authenticate } = require('../middleware/authenticate');

// Sync organization users from Genesys (admin only)
router.post('/sync-users', authenticate, organizationController.syncOrganizationUsers);

// Get organization users from local database
router.get('/users', authenticate, organizationController.getOrganizationUsers);

module.exports = router;
