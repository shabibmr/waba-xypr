// Global test setup for state-manager
process.env.NODE_ENV = 'test';
process.env.PORT = '3005';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.RABBITMQ_URL = 'amqp://localhost:5672';
process.env.LOCK_TTL_SECONDS = '5';
process.env.LOCK_RETRY_COUNT = '3';

// Suppress logger output during tests
jest.mock('../src/utils/logger', () => ({
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        critical: jest.fn(),
    },
    __esModule: true,
}));
