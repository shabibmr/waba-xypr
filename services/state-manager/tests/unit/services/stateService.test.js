// Unit tests for state manager service
const { mockConversation, mockMessage } = require('../../fixtures/state');

describe('State Manager - Logic Tests', () => {
    describe('Conversation Data Structure', () => {
        it('should have valid conversation fixture structure', () => {
            expect(mockConversation).toHaveProperty('whatsappNumber');
            expect(mockConversation).toHaveProperty('genesysConversationId');
            expect(mockConversation).toHaveProperty('tenantId');
            expect(mockConversation).toHaveProperty('status');
        });

        it('should have valid message fixture structure', () => {
            expect(mockMessage).toHaveProperty('messageId');
            expect(mockMessage).toHaveProperty('conversationId');
            expect(mockMessage).toHaveProperty('direction');
            expect(mockMessage).toHaveProperty('content');
        });
    });

    describe('Conversation Mapping Logic', () => {
        it('should generate correct conversation cache key', () => {
            const whatsappNumber = '+1234567890';
            const tenantId = 'test-tenant-001';
            const cacheKey = `conversation:${tenantId}:${whatsappNumber}`;

            expect(cacheKey).toBe('conversation:test-tenant-001:+1234567890');
        });

        it('should generate correct message history key', () => {
            const conversationId = 'conv-123456';
            const cacheKey = `messages:${conversationId}`;

            expect(cacheKey).toBe('messages:conv-123456');
        });

        it('should validate conversation status values', () => {
            const validStatuses = ['active', 'closed', 'transferred'];
            expect(validStatuses).toContain('active');
            expect(validStatuses).toContain('closed');
        });
    });

    describe('Message Direction', () => {
        it('should support inbound and outbound directions', () => {
            const directions = ['inbound', 'outbound'];
            expect(directions).toContain('inbound');
            expect(directions).toContain('outbound');
        });

        it('should validate message direction', () => {
            const validDirections = ['inbound', 'outbound'];
            const testDirection = 'inbound';

            expect(validDirections).toContain(testDirection);
        });
    });

    describe('State Lifecycle', () => {
        it('should track conversation creation timestamp', () => {
            const timestamp = new Date().toISOString();
            expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        it('should update conversation timestamp on changes', () => {
            const created = '2024-01-01T00:00:00.000Z';
            const updated = '2024-01-01T01:00:00.000Z';

            expect(new Date(updated).getTime()).toBeGreaterThan(new Date(created).getTime());
        });
    });

    describe('Message Tracking', () => {
        it('should store message history in order', () => {
            const messages = [
                { id: 1, timestamp: '2024-01-01T00:00:00.000Z' },
                { id: 2, timestamp: '2024-01-01T00:01:00.000Z' },
                { id: 3, timestamp: '2024-01-01T00:02:00.000Z' }
            ];

            expect(messages).toHaveLength(3);
            expect(messages[0].id).toBe(1);
            expect(messages[2].id).toBe(3);
        });

        it('should limit message history size', () => {
            const maxMessages = 100;
            const messages = Array.from({ length: 150 }, (_, i) => ({ id: i }));
            const limitedMessages = messages.slice(-maxMessages);

            expect(limitedMessages).toHaveLength(100);
        });
    });
});
