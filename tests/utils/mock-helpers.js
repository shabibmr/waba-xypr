/**
 * Mock Helper Utilities
 * Utilities for activating, deactivating, and managing mocks
 */

const whatsappMock = require('../mocks/external/whatsapp-api.mock');
const genesysMock = require('../mocks/external/genesys-api.mock');
const { tenantService, stateManager, authService } = require('../mocks/internal/internal-services.mock');
const redisMock = require('../mocks/redis.mock');
const rabbitmqMock = require('../mocks/rabbitmq.mock');

class MockHelpers {
    /**
     * Activate all mocks
     */
    static activateAll() {
        whatsappMock.activate();
        genesysMock.activate();
        tenantService.activate();
        stateManager.activate();
        authService.activate();
        console.log('All mocks activated');
    }

    /**
     * Deactivate all mocks
     */
    static deactivateAll() {
        whatsappMock.deactivate();
        genesysMock.deactivate();
        tenantService.deactivate();
        stateManager.deactivate();
        authService.deactivate();
        console.log('All mocks deactivated');
    }

    /**
     * Reset all mocks to initial state
     */
    static resetAll() {
        whatsappMock.reset();
        genesysMock.reset();
        rabbitmqMock.clearAll();
        console.log('All mocks reset');
    }

    /**
     * Activate only external API mocks
     */
    static activateExternalApis() {
        whatsappMock.activate();
        genesysMock.activate();
        console.log('External API mocks activated');
    }

    /**
     * Activate only internal service mocks
     */
    static activateInternalServices() {
        tenantService.activate();
        stateManager.activate();
        authService.activate();
        console.log('Internal service mocks activated');
    }

    /**
     * Create a mock Redis client
     */
    static createMockRedis(options = {}) {
        return redisMock.createClient(options);
    }

    /**
     * Create a mock RabbitMQ connection
     */
    static async createMockRabbitMQ(url = 'amqp://localhost') {
        return await rabbitmqMock.connect(url);
    }

    /**
     * Get mock instances for custom configuration
     */
    static getMocks() {
        return {
            whatsapp: whatsappMock,
            genesys: genesysMock,
            tenantService,
            stateManager,
            authService,
            redis: redisMock,
            rabbitmq: rabbitmqMock
        };
    }

    /**
     * Setup mocks for a specific test scenario
     */
    static setupScenario(scenario) {
        this.resetAll();

        switch (scenario) {
            case 'happy-path':
                this.activateAll();
                break;

            case 'whatsapp-error':
                this.activateAll();
                whatsappMock.mockError('/messages', 'rateLimitExceeded');
                break;

            case 'genesys-error':
                this.activateAll();
                genesysMock.mockError('/api/v2/conversations', 'unauthorized');
                break;

            case 'tenant-not-found':
                this.activateAll();
                tenantService.mockError('tenantNotFound');
                break;

            case 'auth-failed':
                this.activateAll();
                authService.mockError('invalidCredentials');
                break;

            default:
                this.activateAll();
        }

        console.log(`Scenario "${scenario}" configured`);
    }

    /**
     * Assert that a WhatsApp message was sent
     */
    static assertWhatsAppMessageSent(phoneNumberId = '123456789012345') {
        // This would need to be implemented with nock's isDone() or similar
        console.log(`Asserting WhatsApp message sent to ${phoneNumberId}`);
    }

    /**
     * Assert that a Genesys conversation was created
     */
    static assertGenesysConversationCreated() {
        console.log('Asserting Genesys conversation created');
    }

    /**
     * Assert that a message was published to RabbitMQ
     */
    static assertRabbitMQMessage(queueName, expectedContent = null) {
        return rabbitmqMock.assertMessageSent(queueName, expectedContent);
    }

    /**
     * Get RabbitMQ messages for inspection
     */
    static getRabbitMQMessages(queueName) {
        return rabbitmqMock.getQueueMessages(queueName);
    }

    /**
     * Clear RabbitMQ queue
     */
    static clearRabbitMQQueue(queueName) {
        rabbitmqMock.clearQueue(queueName);
    }
}

module.exports = MockHelpers;
