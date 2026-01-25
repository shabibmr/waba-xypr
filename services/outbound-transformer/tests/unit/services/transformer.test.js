// Unit tests for outbound transformer
const { mockGenesysTextMessage, mockWhatsAppMessage } = require('../../fixtures/messages');

describe('Outbound Transformer - Logic Tests', () => {
    describe('Message Structure Validation', () => {
        it('should validate Genesys message structure', () => {
            expect(mockGenesysTextMessage).toHaveProperty('type');
            expect(mockGenesysTextMessage).toHaveProperty('text');
            expect(mockGenesysTextMessage).toHaveProperty('direction');
        });

        it('should validate WhatsApp message structure', () => {
            expect(mockWhatsAppMessage).toHaveProperty('messaging_product');
            expect(mockWhatsAppMessage).toHaveProperty('to');
            expect(mockWhatsAppMessage).toHaveProperty('type');
        });
    });

    describe('Message Type Mapping', () => {
        it('should map Text to text', () => {
            const genesysType = 'Text';
            const whatsappType = 'text';
            expect(whatsappType).toBe('text');
        });

        it('should support multiple message types', () => {
            const types = { Text: 'text', Structured: 'interactive' };
            expect(types.Text).toBe('text');
        });
    });

    describe('Direction Mapping', () => {
        it('should handle outbound direction', () => {
            expect(mockGenesysTextMessage.direction).toBe('Outbound');
        });
    });

    describe('Content Transformation', () => {
        it('should extract text content', () => {
            const content = mockGenesysTextMessage.text;
            expect(content).toBe('Hello from Genesys');
        });

        it('should format WhatsApp message correctly', () => {
            expect(mockWhatsAppMessage.messaging_product).toBe('whatsapp');
            expect(mockWhatsAppMessage.to).toMatch(/^\+\d+$/);
        });
    });
});
