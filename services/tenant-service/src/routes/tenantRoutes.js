const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');

// Create new tenant
router.post('/', tenantController.createTenant);

// List all tenants (no auth for admin dashboard)
router.get('/', tenantController.getAllTenants);

// Get tenant details
router.get('/:tenantId', tenantController.getTenantById);

// Get tenant by Genesys organization ID (for agent auto-provisioning)
// Get tenant by Genesys organization ID (for agent auto-provisioning)
router.get('/by-genesys-org/:genesysOrgId', tenantController.getTenantByGenesysOrg);

// Provision tenant for Genesys organization (Get or Create)
router.post('/provision/genesys', tenantController.provisionGenesysTenant);

// Update tenant
router.patch('/:tenantId', tenantController.updateTenant);

// Delete tenant
router.delete('/:tenantId', tenantController.deleteTenant);

// Set Genesys OAuth credentials for a tenant
router.put('/:tenantId/genesys/credentials', tenantController.setGenesysCredentials);

// Get Genesys OAuth credentials for a tenant (masked)
router.get('/:tenantId/genesys/credentials', tenantController.getGenesysCredentials);

module.exports = router;
