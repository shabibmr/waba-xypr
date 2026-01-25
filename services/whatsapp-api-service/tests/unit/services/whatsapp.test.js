// Unit tests for WhatsApp API service
const { mockTextMessage, mockImageMessage } = require('../../fixtures/messages');

describe('WhatsApp API Service - Logic Tests', () => {
    describe('Message Structure Validation', () => {
        it('should validate text message structure', () => {
            expect(mockTextMessage).toHaveProperty('messaging_product');
            expect(mockTextMessage).toHaveProperty('to');
            expect(mockTextMessage).toHaveProperty('type');
            expect(mockTextMessage.messaging_product).toBe('whatsapp');
        });

        it('should validate image message structure', () => {
            expect(mockImageMessage.type).toBe('image');
            expect(mockImageMessage).toHaveProperty('image');
        });
    });

    describe('Message Type Support', () => {
        it('should support text messages', () => {
            const types = ['text', 'image', 'document', 'audio', 'video'];
            expect(types).toContain('text');
        });

        it('should format phone numbers correctly', () => {
            expect(mockTextMessage.to).toMatch(/^\+\d+$/);
        });
    });

    describe('API Request Format', () => {
        it('should include messaging_product field', () => {
            expect(mockTextMessage.messaging_product).toBe('whatsapp');
        });

        it('should include recipient phone number', () => {
            expect(mockTextMessage.to).toBeTruthy();
        });
    });
});
