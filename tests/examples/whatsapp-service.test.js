/**
 * Example Test: WhatsApp Service
 * Demonstrates testing WhatsApp API integration with mocks
 */

const whatsappMock = require('../mocks/external/whatsapp-api.mock');
const MockHelpers = require('../utils/mock-helpers');
const builders = require('../utils/test-data-builder');

// Mock the actual service (you would import the real service in actual tests)
const whatsappService = {
    sendText: async (tenantId, to, text) => {
        const axios = require('axios');
        const response = await axios.post(
            'https://graph.facebook.com/v18.0/123456789012345/messages',
            {
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { body: text }
            },
            {
                headers: {
                    'Authorization': 'Bearer test-token',
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    }
};

describe('WhatsApp Service', () => {
    beforeAll(() => {
        whatsappMock.activate();
    });

    afterAll(() => {
        whatsappMock.deactivate();
    });

    beforeEach(() => {
        whatsappMock.reset();
    });

    describe('sendText', () => {
        it('should send a text message successfully', async () => {
            const result = await whatsappService.sendText(
                'tenant-001',
                '+919876543210',
                'Hello, how can I help you?'
            );

            expect(result).toHaveProperty('messaging_product', 'whatsapp');
            expect(result).toHaveProperty('messages');
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]).toHaveProperty('id');
        });

        it('should handle rate limit errors', async () => {
            whatsappMock.mockError('/messages', 'rateLimitExceeded');

            await expect(
                whatsappService.sendText('tenant-001', '+919876543210', 'Hello')
            ).rejects.toThrow();
        });

        it('should handle invalid token errors', async () => {
            whatsappMock.mockError('/messages', 'invalidToken');

            await expect(
                whatsappService.sendText('tenant-001', '+919876543210', 'Hello')
            ).rejects.toThrow();
        });
    });

    describe('with custom responses', () => {
        it('should handle custom message ID', async () => {
            const customResponse = {
                messaging_product: 'whatsapp',
                contacts: [{ wa_id: '919876543210' }],
                messages: [{ id: 'custom-msg-id-xyz' }]
            };

            whatsappMock.mockSendMessage('123456789012345', customResponse);

            const result = await whatsappService.sendText(
                'tenant-001',
                '+919876543210',
                'Test message'
            );

            expect(result.messages[0].id).toBe('custom-msg-id-xyz');
        });
    });

    describe('using test data builders', () => {
        it('should send message using builder', async () => {
            const message = builders.message()
                .from('+919876543210')
                .to('+1 555-0123')
                .withText('Built message')
                .build();

            const result = await whatsappService.sendText(
                'tenant-001',
                message.to,
                message.text
            );

            expect(result.messages[0]).toHaveProperty('id');
        });
    });
});
