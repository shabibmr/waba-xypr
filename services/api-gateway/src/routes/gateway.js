const express = require('express');
const createServiceProxy = require('../utils/proxyFactory');
const limiter = require('../middleware/rateLimiter');

const router = express.Router();

// Apply rate limiting to webhook routes
router.use('/webhook', limiter);

// Route to services with proxy middleware
// WhatsApp webhook - support both /webhook/whatsapp and /webhook/meta
router.use('/webhook/whatsapp', createServiceProxy('whatsapp-webhook'));
router.use('/webhook/meta', createServiceProxy('whatsapp-webhook', {
  pathRewrite: { '^/webhook/meta': '/webhook/whatsapp' }
}));
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
router.use('/api/templates', createServiceProxy('agent-portal-service'));

// Genesys API routes
router.use('/genesys', createServiceProxy('genesys-api-service'));





// Frontend routes with prefix stripping
router.use('/agent-portal', createServiceProxy('agent-portal', { 
    pathRewrite: { '^/agent-portal': '/' } 
}));
router.use('/admin-dashboard', createServiceProxy('admin-dashboard', { 
    pathRewrite: { '^/admin-dashboard': '/' } 
}));

// Legacy global asset routing (keep as fallback for absolute /assets requests if needed, but safer to move to specific prefixes)
router.use('/assets', createServiceProxy('agent-portal'));
router.use('/vite.svg', createServiceProxy('agent-portal'));

// Socket.IO proxy to agent-portal-service (must be before /widget)
router.use('/socket.io', createServiceProxy('agent-portal-service', { ws: true }));

// Agent widget routes
router.use('/widget', createServiceProxy('agent-widget'));

// MinIO media proxy
router.use('/whatsapp-media', createServiceProxy('whatsapp-minio'));

module.exports = router;
