import { createMockDatabase } from '../mocks/database.mock';
import { createMockRedis } from '../mocks/redis.mock';
import { createMockRabbitMQ } from '../mocks/rabbitmq.mock';
import { fixtures } from '../mocks/fixtures';

// Create mocks BEFORE importing modules
const mockDb = createMockDatabase();
const mockRedis = createMockRedis();
const mockRabbitMQ = createMockRabbitMQ();

jest.mock('../../src/config/database', () => ({
    __esModule: true,
    default: mockDb.pool,
}));

jest.mock('../../src/config/redis', () => ({
    __esModule: true,
    default: mockRedis,
}));

jest.mock('../../src/services/rabbitmq.service', () => ({
    __esModule: true,
    rabbitmqService: mockRabbitMQ,
}));

import { handleInboundMessage, handleOutboundMessage, handleStatusUpdate } from '../../src/services/operationHandlers';
import { MessageStatus, ConversationStatus } from '../../src/types';

describe('Inbound Message Flow (Integration)', () => {
    afterEach(() => {
        mockDb.reset();
        mockRedis.reset();
        mockRabbitMQ.reset();
    });

    it('should process new inbound message end-to-end', async () => {
        await handleInboundMessage(fixtures.inboundMessage);

        // Verify mapping created
        const mappings = mockDb.getData('mappings');
        expect(mappings.length).toBe(1);
        expect(mappings[0].wa_id).toBe(fixtures.inboundMessage.wa_id);
        expect(mappings[0].conversation_id).toBeNull();

        // Verify message tracked
        const messages = mockDb.getData('messages');
        expect(messages.length).toBe(1);
        expect(messages[0].wamid).toBe(fixtures.inboundMessage.wamid);
        expect(messages[0].direction).toBe('INBOUND');
        expect(messages[0].status).toBe('received');

        // Verify published to inbound-processed queue
        const queue = mockRabbitMQ.getQueue('inbound-processed');
        expect(queue.length).toBe(1);
        expect(queue[0].wa_id).toBe(fixtures.inboundMessage.wa_id);
        expect(queue[0].is_new_conversation).toBe(true);

        // Verify cache populated
        const cached = await mockRedis.get(`mapping:wa:${fixtures.inboundMessage.wa_id}`);
        expect(cached).not.toBeNull();
    });

    it('should handle duplicate wamid gracefully', async () => {
        await handleInboundMessage(fixtures.inboundMessage);
        await handleInboundMessage(fixtures.inboundMessage); // Duplicate

        const messages = mockDb.getData('messages');
        expect(messages.length).toBe(1); // Only one message stored

        // Both published (downstream handles dedup)
        const queue = mockRabbitMQ.getQueue('inbound-processed');
        expect(queue.length).toBe(2);
    });

    it('should send invalid wa_id to DLQ', async () => {
        await handleInboundMessage({
            ...fixtures.inboundMessage,
            wa_id: '0invalid',
        });

        const dlq = mockRabbitMQ.getQueue('dlq');
        expect(dlq.length).toBe(1);
        expect(dlq[0].reason).toBe('invalid_payload');
    });

    it('should send invalid media_url to DLQ', async () => {
        await handleInboundMessage({
            ...fixtures.inboundMessage,
            media_url: 'https://evil.com/malware.exe',
        });

        const dlq = mockRabbitMQ.getQueue('dlq');
        expect(dlq.length).toBe(1);
        expect(dlq[0].reason).toBe('invalid_media_url');
    });
});

describe('Outbound Message Flow (Integration)', () => {
    afterEach(() => {
        mockDb.reset();
        mockRedis.reset();
        mockRabbitMQ.reset();
    });

    it('should process outbound message for active mapping', async () => {
        mockDb.seed('mappings', [{ ...fixtures.mapping }]);

        await handleOutboundMessage(fixtures.outboundMessage);

        // Verify message tracked
        const messages = mockDb.getData('messages');
        expect(messages.length).toBe(1);
        expect(messages[0].direction).toBe('OUTBOUND');
        expect(messages[0].status).toBe('queued');

        // Verify published
        const queue = mockRabbitMQ.getQueue('outbound-processed');
        expect(queue.length).toBe(1);
        expect(queue[0].wa_id).toBe(fixtures.mapping.wa_id);
    });

    it('should send to DLQ when no mapping found', async () => {
        await handleOutboundMessage(fixtures.outboundMessage);

        const dlq = mockRabbitMQ.getQueue('dlq');
        expect(dlq.length).toBe(1);
        expect(dlq[0].reason).toBe('mapping_not_found');
    });

    it('should send to DLQ when mapping is expired', async () => {
        mockDb.seed('mappings', [{
            ...fixtures.mapping,
            status: ConversationStatus.EXPIRED,
        }]);

        // getMappingByConversationId will not find it because mock filters by status=active
        await handleOutboundMessage(fixtures.outboundMessage);

        const dlq = mockRabbitMQ.getQueue('dlq');
        expect(dlq.length).toBe(1);
        expect(dlq[0].reason).toBe('mapping_not_found');
    });
});

describe('Status Update Flow (Integration)', () => {
    afterEach(() => {
        mockDb.reset();
        mockRedis.reset();
        mockRabbitMQ.reset();
    });

    it('should update message status for valid transition', async () => {
        mockDb.seed('messages', [{
            id: 'msg_123',
            wamid: 'wamid.test_abc123',
            status: MessageStatus.SENT,
            updated_at: new Date('2026-02-12T06:00:00Z'),
        }]);

        await handleStatusUpdate({
            wamid: 'wamid.test_abc123',
            status: MessageStatus.DELIVERED,
            timestamp: '2026-02-12T06:02:00Z',
        });

        const messages = mockDb.getData('messages');
        expect(messages[0].status).toBe(MessageStatus.DELIVERED);
    });

    it('should not throw for invalid transition (silently ignored)', async () => {
        mockDb.seed('messages', [{
            id: 'msg_123',
            wamid: 'wamid.test_abc123',
            status: MessageStatus.DELIVERED,
            updated_at: new Date('2026-02-12T06:00:00Z'),
        }]);

        // DELIVERED → SENT is invalid, should not throw
        await expect(
            handleStatusUpdate({
                wamid: 'wamid.test_abc123',
                status: MessageStatus.SENT,
                timestamp: '2026-02-12T06:02:00Z',
            })
        ).resolves.not.toThrow();
    });
});
