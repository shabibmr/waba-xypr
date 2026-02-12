// Mock for ../../../../shared/constants used by mappingService
export const KEYS = {
    mappingWa: (waId: string) => `mapping:wa:${waId}`,
    mappingConv: (conversationId: string) => `mapping:conv:${conversationId}`,
    tenant: (tenantId: string) => `tenant:${tenantId}:config`,
    tenantMappingWa: (tenantId: string, waId: string) => `tenant:${tenantId}:mapping:wa:${waId}`,
    tenantMappingConv: (tenantId: string, conversationId: string) => `tenant:${tenantId}:mapping:conv:${conversationId}`,
    TTL: {
        MAPPING: 3600,
        TOKEN_BUFFER: 300,
        RATE_LIMIT: 60,
    }
};

module.exports = { KEYS };
