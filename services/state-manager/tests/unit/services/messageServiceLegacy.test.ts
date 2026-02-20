import { createMockDatabase } from '../../mocks/database.mock';
import { MessageStatus, MessageDirection } from '../../../src/types';

const mockDb = createMockDatabase();

jest.mock('../../../src/config/database', () => ({
    __esModule: true,
    default: mockDb.pool,
}));

import messageService from '../../../src/services/messageService';

describe('MessageService - Legacy & Retrieval', () => {
    afterEach(() => {
        mockDb.reset();
    });

    // ==================== Legacy Methods ====================

    describe('trackMessageLegacy', () => {
        it('should call trackMessage and return formatted result', async () => {
            const spy = jest.spyOn(messageService, 'trackMessage');

            const result = await messageService.trackMessageLegacy({
                wamid: 'wamid.legacy',
                mappingId: 'map_1',
                genesysMessageId: 'gen_1',
                direction: MessageDirection.INBOUND,
                status: MessageStatus.RECEIVED
            });

            expect(spy).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.id).toBeDefined();
        });
    });

    describe('updateStatusLegacy', () => {
        it('should update status using raw SQL', async () => {
            mockDb.seed('messages', [{
                id: 'msg_1',
                meta_message_id: 'wamid.legacy',
                status: MessageStatus.SENT,
                updated_at: new Date()
            }]);

            const result = await messageService.updateStatusLegacy('wamid.legacy', MessageStatus.DELIVERED);

            expect(result.success).toBe(true);

            const msgs = mockDb.getData('messages');
            expect(msgs[0].status).toBe(MessageStatus.DELIVERED);
        });

        it('should return error if message not found', async () => {
            const result = await messageService.updateStatusLegacy('nonexistent', MessageStatus.DELIVERED);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Message not found');
        });

        it('should return error on invalid transition', async () => {
            mockDb.seed('messages', [{
                id: 'msg_1',
                meta_message_id: 'wamid.legacy',
                status: MessageStatus.DELIVERED,
                updated_at: new Date()
            }]);

            const result = await messageService.updateStatusLegacy('wamid.legacy', MessageStatus.SENT);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid transition');
        });
    });

    // ==================== Retrieval Methods ====================

    describe('getMessagesByMappingId', () => {
        it('should retrieve messages for a mapping', async () => {
            mockDb.seed('messages', [
                { id: '1', mapping_id: 'map_1', meta_message_id: 'w1', created_at: new Date() },
                { id: '2', mapping_id: 'map_1', meta_message_id: 'w2', created_at: new Date() },
                { id: '3', mapping_id: 'map_2', meta_message_id: 'w3', created_at: new Date() } // Different mapping
            ]);

            const result = await messageService.getMessagesByMappingId('map_1');

            expect(result.messages.length).toBe(2);
            expect(result.messages[0].wamid).toBe('w1');
            expect(result.total).toBe(2);
        });

        it('should return empty list if no messages found', async () => {
            const result = await messageService.getMessagesByMappingId('empty_map');
            expect(result.messages.length).toBe(0);
            expect(result.total).toBe(0);
        });
    });

    describe('getMessageByWamid', () => {
        it('should return message if found', async () => {
            mockDb.seed('messages', [{ id: '1', meta_message_id: 'w1', status: 'sent' }]);
            const msg = await messageService.getMessageByWamid('w1');
            expect(msg).toBeDefined();
            expect(msg.meta_message_id).toBe('w1');
        });

        it('should return null if not found', async () => {
            const msg = await messageService.getMessageByWamid('nonexistent');
            expect(msg).toBeNull();
        });
    });
});
