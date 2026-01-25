// Test setup file
// This file runs before each test suite

// Suppress console output during tests (optional)
global.console = {
    ...console,
    // Uncomment to suppress logs during tests
    // log: jest.fn(),
    // debug: jest.fn(),
    // info: jest.fn(),
    // warn: jest.fn(),
    error: console.error, // Keep errors visible
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3007';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
