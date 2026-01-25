// API tests for Webhook Handler
const request = require('supertest');
const express = require('express');

describe('Webhook Handler API', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());

        app.get('/health', (req, res) => {
            res.json({ status: 'healthy' });
        });
    });

    describe('GET /health', () => {
        it('should return healthy status', async () => {
            const response = await request(app).get('/health').expect(200);
            expect(response.body.status).toBe('healthy');
        });
    });
});
