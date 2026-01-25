// API tests for Genesys webhook service
const request = require('supertest');
const express = require('express');
const { mockGenesysEvent } = require('../fixtures/events');

describe('Genesys Webhook API', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());

        app.get('/health', (req, res) => {
            res.json({ status: 'healthy' });
        });

        app.post('/webhook', (req, res) => {
            res.sendStatus(200);
        });
    });

    describe('GET /health', () => {
        it('should return healthy status', async () => {
            const response = await request(app).get('/health').expect(200);
            expect(response.body.status).toBe('healthy');
        });
    });

    describe('POST /webhook', () => {
        it('should accept Genesys webhook', async () => {
            await request(app)
                .post('/webhook')
                .send(mockGenesysEvent)
                .expect(200);
        });
    });
});
