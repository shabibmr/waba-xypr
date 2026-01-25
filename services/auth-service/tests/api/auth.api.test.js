// API tests for auth-service endpoints
const request = require('supertest');
const express = require('express');
const RedisMock = require('../mocks/redis.mock');
const { mockGenesysTokenResponse } = require('../fixtures/auth');
const axios = require('axios');

jest.mock('axios');

describe('Auth Service API', () => {
    let app;
    let redisMock;
    const TOKEN_CACHE_KEY = 'genesys:oauth:token';

    beforeAll(() => {
        // Create Express app with minimal routes for testing
        app = express();
        app.use(express.json());

        redisMock = new RedisMock();
        redisMock.connect();

        // Health endpoint
        app.get('/health', async (req, res) => {
            try {
                await redisMock.ping();
                res.json({
                    status: 'healthy',
                    redis: 'connected'
                });
            } catch (error) {
                res.status(503).json({
                    status: 'unhealthy',
                    redis: 'disconnected',
                    error: error.message
                });
            }
        });

        // Get token endpoint
        app.get('/auth/token', async (req, res) => {
            try {
                // Check cache
                const cached = await redisMock.get(TOKEN_CACHE_KEY);
                if (cached) {
                    const tokenData = JSON.parse(cached);
                    return res.json({
                        token: tokenData.accessToken,
                        type: 'Bearer'
                    });
                }

                // Request new token
                const response = await axios.post('https://login.mypurecloud.com/oauth/token');
                const { access_token } = response.data;

                res.json({
                    token: access_token,
                    type: 'Bearer'
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Refresh token endpoint
        app.post('/auth/refresh', async (req, res) => {
            try {
                await redisMock.del(TOKEN_CACHE_KEY);

                const response = await axios.post('https://login.mypurecloud.com/oauth/token');
                const { access_token } = response.data;

                res.json({
                    token: access_token,
                    type: 'Bearer',
                    refreshed: true
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Token info endpoint
        app.get('/auth/info', async (req, res) => {
            try {
                const cached = await redisMock.get(TOKEN_CACHE_KEY);

                if (!cached) {
                    return res.json({
                        cached: false,
                        message: 'No token in cache'
                    });
                }

                const tokenData = JSON.parse(cached);
                const now = Math.floor(Date.now() / 1000);
                const timeRemaining = tokenData.expiresAt - now;

                res.json({
                    cached: true,
                    expiresAt: new Date(tokenData.expiresAt * 1000).toISOString(),
                    timeRemaining,
                    timeRemainingMinutes: Math.floor(timeRemaining / 60),
                    isValid: timeRemaining > 300
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        redisMock.clear();
    });

    describe('GET /health', () => {
        it('should return healthy status when Redis is connected', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toEqual({
                status: 'healthy',
                redis: 'connected'
            });
        });
    });

    describe('GET /auth/token', () => {
        it('should return cached token if available', async () => {
            const cachedToken = {
                accessToken: 'cached-token-123',
                expiresAt: Math.floor(Date.now() / 1000) + 3600
            };

            await redisMock.set(TOKEN_CACHE_KEY, JSON.stringify(cachedToken));

            const response = await request(app)
                .get('/auth/token')
                .expect(200);

            expect(response.body).toEqual({
                token: 'cached-token-123',
                type: 'Bearer'
            });
        });

        it('should request new token if cache is empty', async () => {
            axios.post.mockResolvedValue({
                data: mockGenesysTokenResponse
            });

            const response = await request(app)
                .get('/auth/token')
                .expect(200);

            expect(response.body).toEqual({
                token: mockGenesysTokenResponse.access_token,
                type: 'Bearer'
            });
        });

        it('should handle token request errors', async () => {
            axios.post.mockRejectedValue(new Error('Token request failed'));

            const response = await request(app)
                .get('/auth/token')
                .expect(500);

            expect(response.body.error).toBe('Token request failed');
        });
    });

    describe('POST /auth/refresh', () => {
        it('should clear cache and return new token', async () => {
            // Set up cached token
            await redisMock.set(TOKEN_CACHE_KEY, JSON.stringify({
                accessToken: 'old-token',
                expiresAt: Math.floor(Date.now() / 1000) + 3600
            }));

            axios.post.mockResolvedValue({
                data: mockGenesysTokenResponse
            });

            const response = await request(app)
                .post('/auth/refresh')
                .expect(200);

            expect(response.body).toEqual({
                token: mockGenesysTokenResponse.access_token,
                type: 'Bearer',
                refreshed: true
            });

            // Verify cache was cleared
            const cached = await redisMock.get(TOKEN_CACHE_KEY);
            expect(cached).toBeNull();
        });
    });

    describe('GET /auth/info', () => {
        it('should return token info when cached', async () => {
            const expiresAt = Math.floor(Date.now() / 1000) + 3600;
            await redisMock.set(TOKEN_CACHE_KEY, JSON.stringify({
                accessToken: 'test-token',
                expiresAt
            }));

            const response = await request(app)
                .get('/auth/info')
                .expect(200);

            expect(response.body.cached).toBe(true);
            expect(response.body.timeRemaining).toBeGreaterThan(0);
            expect(response.body.isValid).toBe(true);
        });

        it('should return no cache message when token not cached', async () => {
            const response = await request(app)
                .get('/auth/info')
                .expect(200);

            expect(response.body).toEqual({
                cached: false,
                message: 'No token in cache'
            });
        });
    });
});
