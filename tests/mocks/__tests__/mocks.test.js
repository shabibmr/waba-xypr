/**
 * Mock Verification Tests
 * Tests to verify that the mocks themselves work correctly
 */

const nock = require('nock');
const whatsappMock = require('../../mocks/external/whatsapp-api.mock');
const genesysMock = require('../../mocks/external/genesys-api.mock');
const { tenantService, stateManager, authService } = require('../../mocks/internal/internal-services.mock');
const redisMock = require('../../mocks/redis.mock');
const rabbitmqMock = require('../../mocks/rabbitmq.mock');
const MockHelpers = require('../../utils/mock-helpers');

describe('Mock Verification', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    describe('WhatsApp API Mock', () => {
        beforeEach(() => whatsappMock.activate());
        afterEach(() => whatsappMock.deactivate());

        it('should mock message sending endpoint', async () => {
            const axios = require('axios');

            const response = await axios.post(
                'https://graph.facebook.com/v18.0/123456789012345/messages',
                { messaging_product: 'whatsapp', to: '+919876543210', type: 'text' }
            );

            expect(response.status).toBe(200);
            expect(response.data).toHaveProperty('messages');
        });

        it('should mock token exchange', async () => {
            const axios = require('axios');

            const response = await axios.get(
                'https://graph.facebook.com/v18.0/oauth/access_token',
                { params: { code: 'test-code' } }
            );

            expect(response.status).toBe(200);
            expect(response.data).toHaveProperty('access_token');
        });

        it('should mock error responses', async () => {
            whatsappMock.mockError('/messages', 'rateLimitExceeded');
            const axios = require('axios');

            await expect(
                axios.post('https://graph.facebook.com/v18.0/123456789012345/messages', {})
            ).rejects.toThrow();
        });
    });

    describe('Genesys API Mock', () => {
        beforeEach(() => genesysMock.activate());
        afterEach(() => genesysMock.deactivate());

        it('should mock OAuth token endpoint', async () => {
            const axios = require('axios');

            const response = await axios.post(
                'https://login.mypurecloud.com/oauth/token',
                'grant_type=client_credentials'
            );

            expect(response.status).toBe(200);
            expect(response.data).toHaveProperty('access_token');
        });

        it('should mock conversation creation', async () => {
            const axios = require('axios');

            const response = await axios.post(
                'https://api.mypurecloud.com/api/v2/conversations/messages',
                { direction: 'Inbound', text: 'Test' }
            );

            expect(response.status).toBe(200);
            expect(response.data).toHaveProperty('id');
        });

        it('should mock error responses', async () => {
            genesysMock.mockError('/api/v2/conversations', 'unauthorized');
            const axios = require('axios');

            await expect(
                axios.post('https://api.mypurecloud.com/api/v2/conversations/messages', {})
            ).rejects.toThrow();
        });
    });

    describe('Internal Service Mocks', () => {
        beforeEach(() => {
            tenantService.activate();
            stateManager.activate();
            authService.activate();
        });

        afterEach(() => {
            tenantService.deactivate();
            stateManager.deactivate();
            authService.deactivate();
        });

        it('should mock tenant service', async () => {
            const axios = require('axios');

            const response = await axios.get('http://localhost:3001/tenants/tenant-001');

            expect(response.status).toBe(200);
            expect(response.data).toHaveProperty('tenantId');
        });

        it('should mock state manager', async () => {
            const axios = require('axios');

            const response = await axios.get(
                'http://localhost:3005/state/conversation',
                { params: { whatsappNumber: '+919876543210' } }
            );

            expect(response.status).toBe(200);
            expect(response.data).toHaveProperty('genesysConversationId');
        });

        it('should mock auth service', async () => {
            const axios = require('axios');

            const response = await axios.get('http://localhost:3004/auth/token');

            expect(response.status).toBe(200);
            expect(response.data).toHaveProperty('token');
        });
    });

    describe('Redis Mock', () => {
        let redisClient;

        beforeEach(() => {
            redisClient = redisMock.createClient();
        });

        afterEach(async () => {
            await redisMock.close();
        });

        it('should create mock client', () => {
            expect(redisClient).toBeDefined();
        });

        it('should seed test data', async () => {
            const token = await redisClient.get('genesys:oauth:token');
            expect(token).toBeDefined();
        });

        it('should set and get values', async () => {
            await redisClient.set('test-key', 'test-value');
            const value = await redisClient.get('test-key');
            expect(value).toBe('test-value');
        });
    });

    describe('RabbitMQ Mock', () => {
        let connection, channel;

        beforeEach(async () => {
            connection = await rabbitmqMock.connect();
            channel = await connection.createChannel();
        });

        afterEach(async () => {
            await rabbitmqMock.close();
        });

        it('should create connection and channel', () => {
            expect(connection).toBeDefined();
            expect(channel).toBeDefined();
        });

        it('should assert queue', async () => {
            const result = await channel.assertQueue('test-queue');
            expect(result.queue).toBe('test-queue');
        });

        it('should send and receive messages', async () => {
            await channel.assertQueue('test-queue');

            const message = { test: 'data' };
            channel.sendToQueue('test-queue', Buffer.from(JSON.stringify(message)));

            const messages = rabbitmqMock.getQueueMessages('test-queue');
            expect(messages).toHaveLength(1);
        });
    });

    describe('Mock Helpers', () => {
        afterEach(() => {
            MockHelpers.deactivateAll();
        });

        it('should activate all mocks', () => {
            expect(() => MockHelpers.activateAll()).not.toThrow();
        });

        it('should deactivate all mocks', () => {
            MockHelpers.activateAll();
            expect(() => MockHelpers.deactivateAll()).not.toThrow();
        });

        it('should setup scenarios', () => {
            expect(() => MockHelpers.setupScenario('happy-path')).not.toThrow();
            expect(() => MockHelpers.setupScenario('whatsapp-error')).not.toThrow();
        });

        it('should get mock instances', () => {
            const mocks = MockHelpers.getMocks();
            expect(mocks).toHaveProperty('whatsapp');
            expect(mocks).toHaveProperty('genesys');
            expect(mocks).toHaveProperty('redis');
            expect(mocks).toHaveProperty('rabbitmq');
        });
    });
});
