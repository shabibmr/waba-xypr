import { createMockDatabase } from '../../mocks/database.mock';
import { MessageStatus, MessageDirection } from '../../../src/types';

const mockDb = createMockDatabase();

jest.mock('../../../src/config/database', () => ({
    __esModule: true,
    default: mockDb.pool,
}));

import messageService from '../../../src/services/messageService';

describe('MessageService', () => {
    afterEach(() => {
        mockDb.reset();
    });

    // ==================== trackMessage ====================

    describe('trackMessage', () => {
        it('should create new message with wamid', async () => {
            const { messageId, created } = await messageService.trackMessage({
                mapping_id: 'map_123',
                wamid: 'wamid.test_abc',
                direction: MessageDirection.INBOUND,
                status: MessageStatus.RECEIVED,
            });

            expect(created).toBe(true);
            expect(messageId).toBeDefined();
        });

        it('should prevent duplicate wamid insertion', async () => {
            // First insert
            await messageService.trackMessage({
                mapping_id: 'map_123',
                wamid: 'wamid.duplicate',
                direction: MessageDirection.INBOUND,
                status: MessageStatus.RECEIVED,
            });

            // Duplicate attempt
            const { messageId, created } = await messageService.trackMessage({
                mapping_id: 'map_123',
                wamid: 'wamid.duplicate',
                direction: MessageDirection.INBOUND,
                status: MessageStatus.RECEIVED,
            });

            expect(created).toBe(false);
            expect(messageId).toBeDefined();
        });

        it('should create message without wamid (outbound)', async () => {
            const { messageId, created } = await messageService.trackMessage({
                mapping_id: 'map_123',
                genesys_message_id: 'genesys_out_1',
                direction: MessageDirection.OUTBOUND,
                status: MessageStatus.QUEUED,
            });

            expect(created).toBe(true);
            expect(messageId).toBeDefined();
        });

        it('should throw if neither wamid nor genesys_message_id provided', async () => {
            await expect(
                messageService.trackMessage({
                    mapping_id: 'map_123',
                    direction: MessageDirection.INBOUND,
                    status: MessageStatus.RECEIVED,
                })
            ).rejects.toThrow('Either wamid or genesys_message_id is required');
        });

        it('should track message with media_url', async () => {
            const { created } = await messageService.trackMessage({
                mapping_id: 'map_123',
                wamid: 'wamid.media_test',
                direction: MessageDirection.INBOUND,
                status: MessageStatus.RECEIVED,
                media_url: 'https://s3.amazonaws.com/bucket/image.jpg',
            });

            expect(created).toBe(true);
        });
    });

    // ==================== updateStatus ====================

    describe('updateStatus', () => {
        it('should update status with valid transition (SENT → DELIVERED)', async () => {
            mockDb.seed('messages', [{
                id: 'msg_123',
                meta_message_id: 'wamid.test',
                status: MessageStatus.SENT,
                updated_at: new Date('2026-02-12T06:00:00Z'),
            }]);

            const result = await messageService.updateStatus({
                wamid: 'wamid.test',
                new_status: MessageStatus.DELIVERED,
                timestamp: new Date('2026-02-12T06:01:00Z'),
            });

            expect(result.updated).toBe(true);
            expect(result.previous_status).toBe(MessageStatus.SENT);
        });

        it('should reject invalid state transition (DELIVERED → SENT)', async () => {
            mockDb.seed('messages', [{
                id: 'msg_123',
                meta_message_id: 'wamid.test',
                status: MessageStatus.DELIVERED,
                updated_at: new Date('2026-02-12T06:00:00Z'),
            }]);

            const result = await messageService.updateStatus({
                wamid: 'wamid.test',
                new_status: MessageStatus.SENT,
                timestamp: new Date('2026-02-12T06:01:00Z'),
            });

            expect(result.updated).toBe(false);
            expect(result.previous_status).toBe(MessageStatus.DELIVERED);
        });

        it('should reject stale updates (older timestamp)', async () => {
            mockDb.seed('messages', [{
                id: 'msg_123',
                meta_message_id: 'wamid.test',
                status: MessageStatus.SENT,
                updated_at: new Date('2026-02-12T06:05:00Z'),
            }]);

            const result = await messageService.updateStatus({
                wamid: 'wamid.test',
                new_status: MessageStatus.DELIVERED,
                timestamp: new Date('2026-02-12T06:02:00Z'), // Older
            });

            expect(result.updated).toBe(false);
        });

        it('should return updated=false for unknown message', async () => {
            const result = await messageService.updateStatus({
                wamid: 'wamid.nonexistent',
                new_status: MessageStatus.DELIVERED,
                timestamp: new Date(),
            });

            expect(result.updated).toBe(false);
        });

        it('should allow idempotent update (same status)', async () => {
            mockDb.seed('messages', [{
                id: 'msg_123',
                meta_message_id: 'wamid.test',
                status: MessageStatus.SENT,
                updated_at: new Date('2026-02-12T06:00:00Z'),
            }]);

            const result = await messageService.updateStatus({
                wamid: 'wamid.test',
                new_status: MessageStatus.SENT, // same status
                timestamp: new Date('2026-02-12T06:01:00Z'),
            });

            // Idempotent: isValidStateTransition returns true for same→same
            // But the optimistic lock will still try to update
            expect(result.updated).toBe(true);
        });

        it('should throw if neither wamid nor genesys_message_id provided', async () => {
            await expect(
                messageService.updateStatus({
                    new_status: MessageStatus.DELIVERED,
                    timestamp: new Date(),
                })
            ).rejects.toThrow('Either wamid or genesys_message_id is required');
        });
    });
});
