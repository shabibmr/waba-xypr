const express = require('express');
const router = express.Router();
const credentialController = require('../controllers/credentialController');

// Store tenant credentials (Genesys, etc.)
router.post('/:tenantId/credentials', credentialController.storeCredentials);

// Get tenant credentials
router.get('/:tenantId/credentials/:type', credentialController.getCredentials);

module.exports = router;
