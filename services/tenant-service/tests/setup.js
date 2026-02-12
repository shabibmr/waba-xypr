'use strict';

process.env.NODE_ENV = 'test';
process.env.PORT = '3099';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'test';
process.env.META_APP_ID = 'test-app-id';
process.env.META_APP_SECRET = 'test-app-secret';

// Suppress noisy logs during test runs; keep errors visible.
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
