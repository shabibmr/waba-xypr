/**
 * Shared Redis Key Patterns
 * Helper functions to generate consistent Redis keys
 */

module.exports = {
    // Tenant Keys
    tenant: (tenantId) => `tenant:${tenantId}`,
    tenantMappingWa: (tenantId, waId) => `tenant:${tenantId}:mapping:wa:${waId}`,
    tenantMappingConv: (tenantId, conversationId) => `tenant:${tenantId}:mapping:conv:${conversationId}`,

    // State Manager Keys (Global/Legacy)
    mappingWa: (waId) => `mapping:wa:${waId}`,
    mappingConv: (conversationId) => `mapping:conv:${conversationId}`,

    // Auth Keys
    genesysToken: (tenantId) => `genesys:oauth:token:${tenantId}`,
    genesysCreds: (tenantId) => `tenant:${tenantId}:genesys_creds`,
    whatsappConfig: (tenantId) => `tenant:${tenantId}:whatsapp`,

    // Rate Limiting
    rateLimit: (tenantId, minute) => `ratelimit:${tenantId}:${minute}`,

    // Cache TTLs (in seconds)
    TTL: {
        MAPPING: 3600, // 1 hour
        TOKEN_BUFFER: 300, // 5 minutes buffer
        RATE_LIMIT: 60 // 1 minute
    }
};
