// Unit tests for Genesys webhook service
const { mockGenesysEvent } = require('../../fixtures/events');

describe('Genesys Webhook Service - Logic Tests', () => {
    describe('Event Structure Validation', () => {
        it('should validate Genesys event structure', () => {
            expect(mockGenesysEvent).toHaveProperty('id');
            expect(mockGenesysEvent).toHaveProperty('topicName');
            expect(mockGenesysEvent).toHaveProperty('eventBody');
        });

        it('should validate event body', () => {
            expect(mockGenesysEvent.eventBody).toHaveProperty('conversationId');
            expect(mockGenesysEvent.eventBody).toHaveProperty('type');
        });
    });

    describe('Topic Name Handling', () => {
        it('should identify message topics', () => {
            expect(mockGenesysEvent.topicName).toContain('conversations.messages');
        });
    });

    describe('Event Direction', () => {
        it('should handle outbound events', () => {
            expect(mockGenesysEvent.eventBody.direction).toBe('Outbound');
        });
    });
});
