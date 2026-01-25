// Test setup file for auth-service
process.env.NODE_ENV = 'test';
process.env.PORT = '3004';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.GENESYS_CLIENT_ID = 'test-client-id';
process.env.GENESYS_CLIENT_SECRET = 'test-client-secret';
process.env.GENESYS_TOKEN_URL = 'https://login.mypurecloud.com/oauth/token';
