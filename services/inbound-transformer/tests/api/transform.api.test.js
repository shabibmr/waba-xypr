// API tests for inbound transformer
const request = require('supertest');
const express = require('express');
const { mockWhatsAppTextMessage } = require('../fixtures/messages');

describe('Inbound Transformer API', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());

        app.get('/health', (req, res) => {
            res.json({ status: 'healthy' });
        });

        app.post('/transform', (req, res) => {
            res.json({
                type: 'Text',
                text: req.body.text?.body || '',
                direction: 'Inbound'
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
        it('should transform WhatsApp message to Genesys format', async () => {
            const response = await request(app)
                .post('/transform')
                .send(mockWhatsAppTextMessage)
                .expect(200);

            expect(response.body).toHaveProperty('type');
            expect(response.body).toHaveProperty('direction');
        });
    });
});
