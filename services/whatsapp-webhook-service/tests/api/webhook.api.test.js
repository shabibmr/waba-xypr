// API tests for WhatsApp webhook service
const request = require('supertest');
const express = require('express');
const { mockWhatsAppMessage } = require('../fixtures/webhooks');

describe('WhatsApp Webhook API', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());

        // Webhook verification endpoint (GET)
        app.get('/webhook', (req, res) => {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];

            if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
                res.status(200).send(challenge);
            } else {
                res.sendStatus(403);
            }
        });

        // Webhook endpoint (POST)
        app.post('/webhook', (req, res) => {
            const body = req.body;

            if (body.object === 'whatsapp_business_account') {
                res.sendStatus(200);
            } else {
                res.sendStatus(404);
            }
        });

        // Health endpoint
        app.get('/health', (req, res) => {
            res.json({ status: 'healthy' });
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

    describe('GET /webhook (verification)', () => {
        it('should verify webhook with correct token', async () => {
            const response = await request(app)
                .get('/webhook')
                .query({
                    'hub.mode': 'subscribe',
                    'hub.verify_token': 'test-verify-token',
                    'hub.challenge': 'test-challenge'
                })
                .expect(200);

            expect(response.text).toBe('test-challenge');
        });

        it('should reject webhook with incorrect token', async () => {
            await request(app)
                .get('/webhook')
                .query({
                    'hub.mode': 'subscribe',
                    'hub.verify_token': 'wrong-token',
                    'hub.challenge': 'test-challenge'
                })
                .expect(403);
        });
    });

    describe('POST /webhook', () => {
        it('should accept valid WhatsApp webhook', async () => {
            await request(app)
                .post('/webhook')
                .send(mockWhatsAppMessage)
                .expect(200);
        });

        it('should reject invalid webhook object', async () => {
            await request(app)
                .post('/webhook')
                .send({ object: 'invalid' })
                .expect(404);
        });
    });
});
