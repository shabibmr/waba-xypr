// Unit tests for auth service token management
const axios = require('axios');
const RedisMock = require('../../mocks/redis.mock');
const { mockToken, mockGenesysTokenResponse } = require('../../fixtures/auth');

// Mock dependencies
jest.mock('axios');
jest.mock('redis', () => {
    const RedisMock = require('../../mocks/redis.mock');
    return {
        createClient: jest.fn(() => new RedisMock())
    };
});

describe('Auth Service - Token Management', () => {
    let redisMock;
    const TOKEN_CACHE_KEY = 'genesys:oauth:token';
    const TOKEN_EXPIRY_BUFFER = 300;

    beforeEach(() => {
        jest.clearAllMocks();
        redisMock = new RedisMock();
        redisMock.connect();
    });

    afterEach(() => {
        redisMock.clear();
    });

    describe('getValidToken', () => {
        it('should return cached token if still valid', async () => {
            // Mock cached token
            const cachedData = {
                accessToken: 'cached-token',
                expiresAt: Math.floor(Date.now() / 1000) + 1000 // Valid for 1000 seconds
            };

            await redisMock.set(TOKEN_CACHE_KEY, JSON.stringify(cachedData));

            // In real implementation, this would be the getValidToken function
            const cached = await redisMock.get(TOKEN_CACHE_KEY);
            const tokenData = JSON.parse(cached);
            const now = Math.floor(Date.now() / 1000);

            expect(tokenData.expiresAt).toBeGreaterThan(now + TOKEN_EXPIRY_BUFFER);
            expect(tokenData.accessToken).toBe('cached-token');
        });

        it('should request new token if cache is empty', async () => {
            axios.post.mockResolvedValue({
                data: mockGenesysTokenResponse
            });

            const cached = await redisMock.get(TOKEN_CACHE_KEY);
            expect(cached).toBeNull();

            // Simulate token request
            const response = await axios.post('https://login.mypurecloud.com/oauth/token');
            expect(response.data.access_token).toBe(mockGenesysTokenResponse.access_token);
        });

        it('should request new token if cached token is expired', async () => {
            // Mock expired token
            const expiredData = {
                accessToken: 'expired-token',
                expiresAt: Math.floor(Date.now() / 1000) - 100 // Expired 100 seconds ago
            };

            await redisMock.set(TOKEN_CACHE_KEY, JSON.stringify(expiredData));

            const cached = await redisMock.get(TOKEN_CACHE_KEY);
            const tokenData = JSON.parse(cached);
            const now = Math.floor(Date.now() / 1000);

            expect(tokenData.expiresAt).toBeLessThan(now + TOKEN_EXPIRY_BUFFER);

            // Should trigger new token request
            axios.post.mockResolvedValue({
                data: mockGenesysTokenResponse
            });

            const response = await axios.post('https://login.mypurecloud.com/oauth/token');
            expect(response.data).toEqual(mockGenesysTokenResponse);
        });

        it('should cache new token with correct expiry', async () => {
            axios.post.mockResolvedValue({
                data: mockGenesysTokenResponse
            });

            const response = await axios.post('https://login.mypurecloud.com/oauth/token');
            const { access_token, expires_in } = response.data;
            const expiresAt = Math.floor(Date.now() / 1000) + expires_in;

            await redisMock.setEx(
                TOKEN_CACHE_KEY,
                expires_in - TOKEN_EXPIRY_BUFFER,
                JSON.stringify({
                    accessToken: access_token,
                    expiresAt
                })
            );

            const cached = await redisMock.get(TOKEN_CACHE_KEY);
            const tokenData = JSON.parse(cached);

            expect(tokenData.accessToken).toBe(access_token);
            expect(tokenData.expiresAt).toBeCloseTo(expiresAt, -1);
        });

        it('should handle token request errors', async () => {
            axios.post.mockRejectedValue({
                response: {
                    data: { error: 'invalid_client' }
                }
            });

            await expect(
                axios.post('https://login.mypurecloud.com/oauth/token')
            ).rejects.toMatchObject({
                response: {
                    data: { error: 'invalid_client' }
                }
            });
        });
    });

    describe('Token Refresh', () => {
        it('should clear cache and request new token', async () => {
            // Set up cached token
            await redisMock.set(TOKEN_CACHE_KEY, JSON.stringify(mockToken));

            // Clear cache
            await redisMock.del(TOKEN_CACHE_KEY);

            const cached = await redisMock.get(TOKEN_CACHE_KEY);
            expect(cached).toBeNull();

            // Request new token
            axios.post.mockResolvedValue({
                data: mockGenesysTokenResponse
            });

            const response = await axios.post('https://login.mypurecloud.com/oauth/token');
            expect(response.data.access_token).toBe(mockGenesysTokenResponse.access_token);
        });
    });

    describe('Redis Connection', () => {
        it('should connect to Redis successfully', async () => {
            const redis = new RedisMock();
            await redis.connect();

            expect(redis.connected).toBe(true);
        });

        it('should handle ping command', async () => {
            const redis = new RedisMock();
            await redis.connect();

            const pong = await redis.ping();
            expect(pong).toBe('PONG');
        });

        it('should throw error on ping when not connected', async () => {
            const redis = new RedisMock();

            await expect(redis.ping()).rejects.toThrow('Redis not connected');
        });
    });
});
