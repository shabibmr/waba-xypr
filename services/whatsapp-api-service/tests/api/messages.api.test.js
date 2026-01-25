// API tests for WhatsApp API service
const request = require('supertest');
const express = require('express');
const { mockTextMessage } = require('../fixtures/messages');

describe('WhatsApp API Service API', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());

        app.get('/health', (req, res) => {
            res.json({ status: 'healthy' });
        });

        app.post('/messages', (req, res) => {
            res.json({ message_id: 'wamid.test123', status: 'sent' });
        });
    });

    describe('GET /health', () => {
        it('should return healthy status', async () => {
            const response = await request(app).get('/health').expect(200);
            expect(response.body.status).toBe('healthy');
        });
    });

    describe('POST /messages', () => {
        it('should send message successfully', async () => {
            const response = await request(app)
                .post('/messages')
                .send(mockTextMessage)
                .expect(200);

            expect(response.body).toHaveProperty('message_id');
            expect(response.body).toHaveProperty('status');
        });
    });
});
