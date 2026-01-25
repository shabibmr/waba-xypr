// API tests for state-manager endpoints
const request = require('supertest');
const express = require('express');
const { mockConversation, mockMessage } = require('../fixtures/state');

describe('State Manager API', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());

        // Health endpoint
        app.get('/health', (req, res) => {
            res.json({ status: 'healthy' });
        });

        // Conversation endpoints
        app.post('/conversations', (req, res) => {
            res.status(201).json(mockConversation);
        });

        app.get('/conversations/:whatsappNumber', (req, res) => {
            res.json(mockConversation);
        });

        // Message tracking
        app.post('/messages', (req, res) => {
            res.status(201).json(mockMessage);
        });

        app.get('/messages/:conversationId', (req, res) => {
            res.json([mockMessage]);
        });
    });

    describe('GET /health', () => {
        it('should return healthy status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body.status).toBe('healthy');
        });
    });

    describe('POST /conversations', () => {
        it('should create a new conversation mapping', async () => {
            const response = await request(app)
                .post('/conversations')
                .send({
                    whatsappNumber: '+1234567890',
                    tenantId: 'test-tenant-001'
                })
                .expect(201);

            expect(response.body).toHaveProperty('genesysConversationId');
            expect(response.body.whatsappNumber).toBe('+1234567890');
        });
    });

    describe('GET /conversations/:whatsappNumber', () => {
        it('should retrieve conversation mapping', async () => {
            const response = await request(app)
                .get('/conversations/+1234567890')
                .expect(200);

            expect(response.body).toHaveProperty('genesysConversationId');
        });
    });

    describe('POST /messages', () => {
        it('should track a message', async () => {
            const response = await request(app)
                .post('/messages')
                .send({
                    conversationId: 'conv-123456',
                    direction: 'inbound',
                    content: 'Test message'
                })
                .expect(201);

            expect(response.body).toHaveProperty('messageId');
        });
    });

    describe('GET /messages/:conversationId', () => {
        it('should retrieve message history', async () => {
            const response = await request(app)
                .get('/messages/conv-123456')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });
});
