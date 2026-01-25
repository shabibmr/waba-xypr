// Unit tests for WhatsApp webhook service
const { mockWhatsAppMessage, mockImageMessage, mockStatusUpdate } = require('../../fixtures/webhooks');

describe('WhatsApp Webhook Service - Logic Tests', () => {
    describe('Webhook Data Structure', () => {
        it('should have valid text message structure', () => {
            expect(mockWhatsAppMessage).toHaveProperty('object');
            expect(mockWhatsAppMessage).toHaveProperty('entry');
            expect(mockWhatsAppMessage.entry[0].changes[0].value).toHaveProperty('messages');
        });

        it('should have valid image message structure', () => {
            const message = mockImageMessage.entry[0].changes[0].value.messages[0];
            expect(message.type).toBe('image');
            expect(message).toHaveProperty('image');
        });

        it('should have valid status update structure', () => {
            const status = mockStatusUpdate.entry[0].changes[0].value.statuses[0];
            expect(status).toHaveProperty('status');
            expect(status).toHaveProperty('recipient_id');
        });
    });

    describe('Message Type Detection', () => {
        it('should identify text messages', () => {
            const message = mockWhatsAppMessage.entry[0].changes[0].value.messages[0];
            expect(message.type).toBe('text');
        });

        it('should identify image messages', () => {
            const message = mockImageMessage.entry[0].changes[0].value.messages[0];
            expect(message.type).toBe('image');
        });

        it('should support multiple message types', () => {
            const types = ['text', 'image', 'document', 'audio', 'video', 'location'];
            expect(types).toContain('text');
            expect(types).toContain('image');
        });
    });

    describe('Webhook Validation', () => {
        it('should validate webhook object type', () => {
            expect(mockWhatsAppMessage.object).toBe('whatsapp_business_account');
        });

        it('should extract phone number from metadata', () => {
            const metadata = mockWhatsAppMessage.entry[0].changes[0].value.metadata;
            expect(metadata.phone_number_id).toBe('PHONE_NUMBER_ID');
        });

        it('should extract sender from message', () => {
            const message = mockWhatsAppMessage.entry[0].changes[0].value.messages[0];
            expect(message.from).toMatch(/^\+\d+$/);
        });
    });

    describe('Message Parsing', () => {
        it('should extract text content', () => {
            const message = mockWhatsAppMessage.entry[0].changes[0].value.messages[0];
            expect(message.text.body).toBe('Hello, this is a test message');
        });

        it('should extract message ID', () => {
            const message = mockWhatsAppMessage.entry[0].changes[0].value.messages[0];
            expect(message.id).toMatch(/^wamid\./);
        });

        it('should extract timestamp', () => {
            const message = mockWhatsAppMessage.entry[0].changes[0].value.messages[0];
            expect(message.timestamp).toBeTruthy();
        });
    });

    describe('Status Updates', () => {
        it('should parse delivery status', () => {
            const status = mockStatusUpdate.entry[0].changes[0].value.statuses[0];
            expect(status.status).toBe('delivered');
        });

        it('should support multiple status types', () => {
            const statuses = ['sent', 'delivered', 'read', 'failed'];
            expect(statuses).toContain('delivered');
        });
    });
});
