const express = require('express');
const createServiceProxy = require('../utils/proxyFactory');
const limiter = require('../middleware/rateLimiter');

const router = express.Router();

// Apply rate limiting to webhook routes
router.use('/webhook', limiter);

// Route to services with proxy middleware
router.use('/webhook/meta', createServiceProxy('whatsapp-webhook'));
router.use('/webhook/genesys', createServiceProxy('genesys-webhook'));
router.use('/transform/inbound', createServiceProxy('inbound-transformer'));
router.use('/transform/outbound', createServiceProxy('outbound-transformer'));
router.use('/auth', createServiceProxy('auth-service'));
router.use('/state', createServiceProxy('state-manager'));

// Tenant service routes
router.use('/api/tenants', createServiceProxy('tenant-service'));

// Agent portal routes
router.use('/api/agents', createServiceProxy('agent-portal-service'));
router.use('/api/conversations', createServiceProxy('agent-portal-service'));
router.use('/api/messages', createServiceProxy('agent-portal-service'));
router.use('/api/organization', createServiceProxy('agent-portal-service'));
router.use('/api/onboarding', createServiceProxy('agent-portal-service'));
router.use('/api/dashboard', createServiceProxy('agent-portal-service'));
router.use('/api/whatsapp', createServiceProxy('agent-portal-service'));

// Genesys API routes
router.use('/genesys', createServiceProxy('genesys-api-service'));

module.exports = router;
