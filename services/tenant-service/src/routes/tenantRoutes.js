const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');

// Create new tenant
router.post('/', tenantController.createTenant);

// List all tenants (no auth for admin dashboard)
router.get('/', tenantController.getAllTenants);

// Tenant resolution routes (MUST come before /:tenantId to avoid conflicts)
router.get('/by-phone/:phoneNumberId', tenantController.getTenantByPhoneNumberId);
router.get('/by-integration/:integrationId', tenantController.getTenantByIntegrationId);
router.get('/by-genesys-org/:genesysOrgId', tenantController.getTenantByGenesysOrg);

// Provision tenant for Genesys organization (Get or Create)
router.post('/provision/genesys', tenantController.provisionGenesysTenant);

// Get tenant details (generic route - must come after specific routes)
router.get('/:tenantId', tenantController.getTenantById);

// Update tenant
router.patch('/:tenantId', tenantController.updateTenant);

// Delete tenant
router.delete('/:tenantId', tenantController.deleteTenant);

// Set Genesys OAuth credentials for a tenant
router.put('/:tenantId/genesys/credentials', tenantController.setGenesysCredentials);

// Get Genesys OAuth credentials for a tenant (masked)
router.get('/:tenantId/genesys/credentials', tenantController.getGenesysCredentials);

// Complete onboarding for a tenant
router.post('/:tenantId/complete-onboarding', tenantController.completeOnboarding);

module.exports = router;
