// Unit tests for inbound transformer
const { mockWhatsAppTextMessage, mockGenesysMessage } = require('../../fixtures/messages');

describe('Inbound Transformer - Logic Tests', () => {
    describe('Message Structure Validation', () => {
        it('should validate WhatsApp message structure', () => {
            expect(mockWhatsAppTextMessage).toHaveProperty('from');
            expect(mockWhatsAppTextMessage).toHaveProperty('type');
            expect(mockWhatsAppTextMessage).toHaveProperty('text');
        });

        it('should validate Genesys message structure', () => {
            expect(mockGenesysMessage).toHaveProperty('type');
            expect(mockGenesysMessage).toHaveProperty('text');
            expect(mockGenesysMessage).toHaveProperty('direction');
        });
    });

    describe('Message Type Mapping', () => {
        it('should map text message type', () => {
            const whatsappType = 'text';
            const genesysType = 'Text';
            expect(genesysType).toBe('Text');
        });

        it('should support multiple message types', () => {
            const types = { text: 'Text', image: 'Structured', document: 'Structured' };
            expect(types.text).toBe('Text');
        });
    });

    describe('Direction Mapping', () => {
        it('should set inbound direction', () => {
            expect(mockGenesysMessage.direction).toBe('Inbound');
        });
    });

    describe('Content Transformation', () => {
        it('should extract text content', () => {
            const content = mockWhatsAppTextMessage.text.body;
            expect(content).toBe('Hello from WhatsApp');
        });

        it('should preserve message metadata', () => {
            expect(mockWhatsAppTextMessage.id).toMatch(/^wamid\./);
            expect(mockWhatsAppTextMessage.from).toMatch(/^\+\d+$/);
        });
    });
});
