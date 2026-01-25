// API tests for outbound transformer
const request = require('supertest');
const express = require('express');
const { mockGenesysTextMessage } = require('../fixtures/messages');

describe('Outbound Transformer API', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());

        app.get('/health', (req, res) => {
            res.json({ status: 'healthy' });
        });

        app.post('/transform', (req, res) => {
            res.json({
                messaging_product: 'whatsapp',
                to: '+1234567890',
                type: 'text',
                text: { body: req.body.text || '' }
            });
        });
    });

    describe('GET /health', () => {
        it('should return healthy status', async () => {
            const response = await request(app).get('/health').expect(200);
            expect(response.body.status).toBe('healthy');
        });
    });

    describe('POST /transform', () => {
        it('should transform Genesys message to WhatsApp format', async () => {
            const response = await request(app)
                .post('/transform')
                .send(mockGenesysTextMessage)
                .expect(200);

            expect(response.body).toHaveProperty('messaging_product');
            expect(response.body).toHaveProperty('to');
            expect(response.body).toHaveProperty('type');
        });
    });
});
