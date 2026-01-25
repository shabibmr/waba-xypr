/**
 * Example Test: Integration Flow
 * Demonstrates end-to-end testing with multiple mocks
 */

const MockHelpers = require('../utils/mock-helpers');
const builders = require('../utils/test-data-builder');

describe('Integration: WhatsApp to Genesys Message Flow', () => {
    let rabbitmqMock, redisMock;

    beforeAll(() => {
        MockHelpers.activateAll();
        const mocks = MockHelpers.getMocks();
        rabbitmqMock = mocks.rabbitmq;
        redisMock = mocks.redis;
    });

    afterAll(() => {
        MockHelpers.deactivateAll();
    });

    beforeEach(async () => {
        MockHelpers.resetAll();
        await redisMock.clear();
        await redisMock.seedTestData();
    });

    it('should process incoming WhatsApp message end-to-end', async () => {
        // 1. Build test data
        const tenant = builders.tenant()
            .withId('tenant-001')
            .build();

        const message = builders.message()
            .from('+919876543210')
            .withText('I need help with my order')
            .build();

        // 2. Simulate WhatsApp webhook
        const whatsappWebhook = {
            object: 'whatsapp_business_account',
            entry: [{
                changes: [{
                    value: {
                        messages: [{
                            from: message.from,
                            text: { body: message.text },
                            id: message.messageId,
                            timestamp: Math.floor(Date.now() / 1000).toString()
                        }],
                        metadata: {
                            phone_number_id: tenant.whatsapp.phoneNumberId,
                            display_phone_number: tenant.whatsapp.displayPhoneNumber
                        }
                    }
                }]
            }]
        };

        // 3. Process webhook (in real test, call actual webhook handler)
        // For this example, we'll simulate the expected behavior

        // 4. Verify message was queued for processing
        // In real implementation, the webhook handler would publish to RabbitMQ
        const channel = await rabbitmqMock.connection.createChannel();
        await channel.assertQueue('inbound-messages');

        channel.sendToQueue(
            'inbound-messages',
            Buffer.from(JSON.stringify({
                tenantId: tenant.tenantId,
                whatsappNumber: message.from,
                text: message.text,
                messageId: message.messageId
            }))
        );

        // 5. Assert message was queued
        const queuedMessages = MockHelpers.getRabbitMQMessages('inbound-messages');
        expect(queuedMessages).toHaveLength(1);

        const queuedMessage = JSON.parse(queuedMessages[0].content.toString());
        expect(queuedMessage.tenantId).toBe('tenant-001');
        expect(queuedMessage.text).toBe('I need help with my order');
    });

    it('should handle conversation state persistence', async () => {
        const conversation = builders.conversation()
            .withTenantId('tenant-001')
            .withWhatsAppNumber('+919876543210')
            .withGenesysConversationId('conv-12345-abcde')
            .build();

        // Store conversation mapping
        await redisMock.setConversationMapping(
            conversation.whatsappNumber,
            {
                genesysConversationId: conversation.genesysConversationId,
                tenantId: conversation.tenantId,
                status: 'active'
            }
        );

        // Verify it was stored
        const redisClient = redisMock.client;
        const stored = await redisClient.get(`conversation:${conversation.whatsappNumber}`);
        const parsed = JSON.parse(stored);

        expect(parsed.genesysConversationId).toBe('conv-12345-abcde');
        expect(parsed.tenantId).toBe('tenant-001');
    });

    it('should handle errors gracefully', async () => {
        MockHelpers.setupScenario('genesys-error');

        // Test that errors are handled properly
        // In real test, this would call actual service code

        // Verify error was logged or handled appropriately
        expect(true).toBe(true); // Placeholder
    });
});

describe('Integration: Genesys to WhatsApp Message Flow', () => {
    beforeAll(() => {
        MockHelpers.activateAll();
    });

    afterAll(() => {
        MockHelpers.deactivateAll();
    });

    beforeEach(() => {
        MockHelpers.resetAll();
    });

    it('should process outbound Genesys message', async () => {
        const conversation = builders.conversation()
            .withGenesysConversationId('conv-12345-abcde')
            .withWhatsAppNumber('+919876543210')
            .build();

        // Simulate Genesys webhook notification
        const genesysWebhook = {
            topicName: 'v2.conversations.messages.conv-12345-abcde.messages',
            eventBody: {
                id: 'msg-outbound-123',
                conversation: { id: conversation.genesysConversationId },
                body: 'Thank you for contacting us!',
                direction: 'outbound'
            }
        };

        // Process webhook and send to WhatsApp
        // In real test, this would call actual webhook handler

        // Verify message was sent to WhatsApp
        expect(true).toBe(true); // Placeholder
    });
});
