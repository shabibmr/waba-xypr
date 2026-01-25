// Test setup for state-manager
process.env.NODE_ENV = 'test';
process.env.PORT = '3005';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
