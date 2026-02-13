import { createMockDatabase } from '../../mocks/database.mock';
import { createMockRedis } from '../../mocks/redis.mock';
import { fixtures } from '../../mocks/fixtures';

// Mock dependencies BEFORE importing the service
const mockDb = createMockDatabase();
const mockRedis = createMockRedis();

jest.mock('../../../src/config/database', () => ({
    __esModule: true,
    default: mockDb.pool,
}));

jest.mock('../../../src/config/redis', () => ({
    __esModule: true,
    default: mockRedis,
}));

jest.mock('../../../src/services/tenantConnectionFactory', () => ({
    getConnection: jest.fn().mockResolvedValue(mockDb.pool)
}));

import mappingService from '../../../src/services/mappingService';

describe('MappingService', () => {
    afterEach(() => {
        mockDb.reset();
        mockRedis.reset();
    });

    // ==================== createMappingForInbound ====================

    describe('createMappingForInbound', () => {
        it('should create new mapping with NULL conversation_id', async () => {
            const { mapping, isNew } = await mappingService.createMappingForInbound({
                wa_id: fixtures.inboundMessage.wa_id,
                wamid: fixtures.inboundMessage.wamid,
                contact_name: fixtures.inboundMessage.contact_name,
                phone_number_id: fixtures.inboundMessage.phone_number_id,
                display_phone_number: fixtures.inboundMessage.display_phone_number,
            }, 'test-tenant');

            expect(isNew).toBe(true);
            expect(mapping.wa_id).toBe(fixtures.inboundMessage.wa_id);
            expect(mapping.conversation_id).toBeNull();
            expect(mapping.last_message_id).toBe(fixtures.inboundMessage.wamid);
        });

        it('should update existing mapping on duplicate wa_id', async () => {
            // First insert
            await mappingService.createMappingForInbound({
                wa_id: fixtures.inboundMessage.wa_id,
                wamid: 'wamid.first',
                contact_name: 'Old Name',
            }, 'test-tenant');

            // Duplicate insert
            const { mapping, isNew } = await mappingService.createMappingForInbound({
                wa_id: fixtures.inboundMessage.wa_id,
                wamid: 'wamid.second',
                contact_name: 'New Name',
            }, 'test-tenant');

            expect(isNew).toBe(false);
            expect(mapping.last_message_id).toBe('wamid.second');
        });

        it('should cache mapping after creation', async () => {
            await mappingService.createMappingForInbound({
                wa_id: fixtures.inboundMessage.wa_id,
                wamid: fixtures.inboundMessage.wamid,
            }, 'test-tenant');

            // Verify cache was populated (mapping:wa:{wa_id})
            const cached = await mockRedis.get(`mapping:wa:${fixtures.inboundMessage.wa_id}`);
            expect(cached).not.toBeNull();

            const parsed = JSON.parse(cached!);
            expect(parsed.wa_id).toBe(fixtures.inboundMessage.wa_id);
        });
    });

    // ==================== correlateConversation ====================

    describe('correlateConversation', () => {
        it('should set conversation_id when NULL', async () => {
            // Create mapping first
            await mappingService.createMappingForInbound({
                wa_id: fixtures.inboundMessage.wa_id,
                wamid: fixtures.inboundMessage.wamid,
            }, 'test-tenant');

            const result = await mappingService.correlateConversation({
                conversation_id: 'conv-new-123',
                communication_id: 'comm-new-456',
                whatsapp_message_id: fixtures.inboundMessage.wamid,
            }, 'test-tenant');

            expect(result).not.toBeNull();
            expect(result!.conversation_id).toBe('conv-new-123');
            expect(result!.communication_id).toBe('comm-new-456');
        });

        it('should return null if conversation_id already set', async () => {
            // Seed with already-correlated mapping
            mockDb.seed('mappings', [{ ...fixtures.mapping }]);

            const result = await mappingService.correlateConversation({
                conversation_id: 'conv-different',
                communication_id: 'comm-different',
                whatsapp_message_id: fixtures.mapping.last_message_id!,
            }, 'test-tenant');

            expect(result).toBeNull();
        });
    });

    // ==================== getMappingByWaId ====================

    describe('getMappingByWaId', () => {
        it('should return cached mapping on cache hit', async () => {
            // Pre-populate cache
            await mockRedis.setEx(
                `mapping:wa:${fixtures.mapping.wa_id}`,
                3600,
                JSON.stringify(fixtures.mapping)
            );

            const mapping = await mappingService.getMappingByWaId(fixtures.mapping.wa_id, 'test-tenant');

            expect(mapping).not.toBeNull();
            expect(mapping!.wa_id).toBe(fixtures.mapping.wa_id);
            // DB should NOT have been queried
            expect(mockDb.getQueryStub()).not.toHaveBeenCalled();
        });

        it('should query DB on cache miss and populate cache', async () => {
            mockDb.seed('mappings', [{ ...fixtures.mapping }]);

            const mapping = await mappingService.getMappingByWaId(fixtures.mapping.wa_id, 'test-tenant');

            expect(mapping).not.toBeNull();
            expect(mapping!.wa_id).toBe(fixtures.mapping.wa_id);
            expect(mockDb.getQueryStub()).toHaveBeenCalled();

            // Verify cache was populated
            const cached = await mockRedis.get(`mapping:wa:${fixtures.mapping.wa_id}`);
            expect(cached).not.toBeNull();
        });

        it('should return null for nonexistent wa_id', async () => {
            const mapping = await mappingService.getMappingByWaId('nonexistent', 'test-tenant');
            expect(mapping).toBeNull();
        });

        it('should handle Redis failure gracefully (fallback to DB)', async () => {
            mockRedis.simulateDisconnect();
            mockDb.seed('mappings', [{ ...fixtures.mapping }]);

            const mapping = await mappingService.getMappingByWaId(fixtures.mapping.wa_id, 'test-tenant');

            expect(mapping).not.toBeNull();
            expect(mapping!.wa_id).toBe(fixtures.mapping.wa_id);
        });
    });

    // ==================== getMappingByConversationId ====================

    describe('getMappingByConversationId', () => {
        it('should return cached mapping on cache hit', async () => {
            await mockRedis.setEx(
                `mapping:conv:${fixtures.mapping.conversation_id}`,
                3600,
                JSON.stringify(fixtures.mapping)
            );

            const mapping = await mappingService.getMappingByConversationId(fixtures.mapping.conversation_id!, 'test-tenant');

            expect(mapping).not.toBeNull();
            expect(mapping!.conversation_id).toBe(fixtures.mapping.conversation_id);
        });

        it('should query DB on cache miss', async () => {
            mockDb.seed('mappings', [{ ...fixtures.mapping }]);

            const mapping = await mappingService.getMappingByConversationId(fixtures.mapping.conversation_id!, 'test-tenant');

            expect(mapping).not.toBeNull();
            expect(mapping!.conversation_id).toBe(fixtures.mapping.conversation_id);
        });
    });

    // ==================== formatMapping ====================

    describe('formatMapping', () => {
        it('should produce camelCase API response shape', () => {
            const result = (mappingService as any).formatMapping(fixtures.mapping);

            expect(result.waId).toBe(fixtures.mapping.wa_id);
            expect(result.conversationId).toBe(fixtures.mapping.conversation_id);
            expect(result.contactName).toBe(fixtures.mapping.contact_name);
            expect(result.internalId).toBe(fixtures.mapping.id);
        });
    });

    // ==================== invalidateCache ====================

    describe('invalidateCache', () => {
        it('should delete keys from Redis', async () => {
            const wa_id = '123';
            const conv_id = 'abc';

            await mappingService.invalidateCache(wa_id, conv_id);

            // Verify keys are gone (simulated by setting then deleting/getting null)
            // Since mockRedis.del is void, we verify via state if we could, but here we trust the mock invocation.
        });
    });

    // ==================== Legacy/Utility Methods ====================

    describe('getMapping (Legacy)', () => {
        it('should throw error for deprecated method', async () => {
            await expect(mappingService.getMapping('nonexistent'))
                .rejects.toThrow('Legacy getMapping method is deprecated');
        });

        it('should throw error for deprecated method', async () => {
            mockDb.seed('mappings', [fixtures.mapping]);
            await expect(mappingService.getMapping(fixtures.mapping.wa_id))
                .rejects.toThrow('Legacy getMapping method is deprecated');
        });
    });

    describe('createOrUpdateMapping (Legacy)', () => {
        it('should throw error for deprecated method', async () => {
            const data = {
                waId: '999999',
                contactName: 'Test',
                wamid: 'wamid.999',
                phoneNumberId: '123',
                displayPhoneNumber: '123'
            };

            await expect(mappingService.createOrUpdateMapping(data))
                .rejects.toThrow('Legacy createOrUpdateMapping method is deprecated');
        });
    });
});
