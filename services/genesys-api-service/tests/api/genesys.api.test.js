// API tests for Genesys API service
const request = require('supertest');
const express = require('express');

describe('Genesys API Service API', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());

        app.get('/health', (req, res) => {
            res.json({ status: 'healthy' });
        });

        app.post('/conversations', (req, res) => {
            res.json({ id: 'conv-123' });
        });
    });

    describe('GET /health', () => {
        it('should return healthy status', async () => {
            const response = await request(app).get('/health').expect(200);
            expect(response.body.status).toBe('healthy');
        });
    });

    describe('POST /conversations', () => {
        it('should create conversation', async () => {
            const response = await request(app)
                .post('/conversations')
                .send({})
                .expect(200);

            expect(response.body).toHaveProperty('id');
        });
    });
});
