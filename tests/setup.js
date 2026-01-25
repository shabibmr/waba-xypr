/**
 * Global test setup
 * Configures Jest environment and sets up default mocks
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

// Default service URLs for testing
process.env.TENANT_SERVICE_URL = 'http://localhost:3001';
process.env.AUTH_SERVICE_URL = 'http://localhost:3004';
process.env.STATE_MANAGER_URL = 'http://localhost:3005';
process.env.WHATSAPP_API_SERVICE_URL = 'http://localhost:3002';
process.env.GENESYS_API_SERVICE_URL = 'http://localhost:3003';

// Redis configuration
process.env.REDIS_URL = 'redis://localhost:6379';

// RabbitMQ configuration
process.env.RABBITMQ_URL = 'amqp://localhost:5672';

// WhatsApp/Meta configuration
process.env.META_APP_ID = 'test-app-id';
process.env.META_APP_SECRET = 'test-app-secret';
process.env.META_GRAPH_API_VERSION = 'v18.0';

// Genesys configuration
process.env.GENESYS_CLIENT_ID = 'test-client-id';
process.env.GENESYS_CLIENT_SECRET = 'test-client-secret';
process.env.GENESYS_REGION = 'mypurecloud.com';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Global test utilities
global.testUtils = {
    // Helper to wait for async operations
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    // Helper to generate test IDs
    generateId: (prefix = 'test') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

    // Helper to create test timestamps
    timestamp: () => new Date().toISOString()
};

console.log('Test environment initialized');
