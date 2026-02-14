# Testing Guide

This directory contains comprehensive mocks and test infrastructure for the WhatsApp-Genesys integration platform.

## Quick Start

```bash
# Install dependencies
cd tests
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Directory Structure

```
tests/
├── package.json              # Test dependencies
├── setup.js                  # Global test setup
├── teardown.js               # Global test teardown
├── fixtures/                 # Test data fixtures
│   ├── whatsapp-fixtures.js
│   ├── genesys-fixtures.js
│   └── internal-fixtures.js
├── mocks/                    # Mock implementations
│   ├── external/
│   │   ├── whatsapp-api.mock.js
│   │   └── genesys-api.mock.js
│   ├── internal/
│   │   └── internal-services.mock.js
│   ├── redis.mock.js
│   └── rabbitmq.mock.js
├── utils/                    # Test utilities
│   ├── mock-helpers.js
│   └── test-data-builder.js
├── examples/                 # Example tests
└── __tests__/               # Actual test files
```

## Using Mocks

### Basic Usage

```javascript
const MockHelpers = require('./utils/mock-helpers');

describe('My Service', () => {
  beforeAll(() => {
    // Activate all mocks
    MockHelpers.activateAll();
  });

  afterAll(() => {
    // Deactivate all mocks
    MockHelpers.deactivateAll();
  });

  beforeEach(() => {
    // Reset mocks between tests
    MockHelpers.resetAll();
  });

  it('should send a WhatsApp message', async () => {
    // Your test code here
  });
});
```

### Activating Specific Mocks

```javascript
// Activate only external APIs
MockHelpers.activateExternalApis();

// Activate only internal services
MockHelpers.activateInternalServices();

// Get individual mock instances
const mocks = MockHelpers.getMocks();
mocks.whatsapp.activate();
mocks.genesys.activate();
```

### Test Scenarios

```javascript
// Setup predefined scenarios
MockHelpers.setupScenario('happy-path');
MockHelpers.setupScenario('whatsapp-error');
MockHelpers.setupScenario('genesys-error');
MockHelpers.setupScenario('tenant-not-found');
```

### Using Test Data Builders

```javascript
const builders = require('./utils/test-data-builder');

// Build a tenant
const tenant = builders.tenant()
  .withId('tenant-001')
  .withName('Test Tenant')
  .build();

// Build a message
const message = builders.message()
  .from('+919876543210')
  .withText('Hello!')
  .build();

// Build a conversation
const conversation = builders.conversation()
  .withTenantId('tenant-001')
  .withWhatsAppNumber('+919876543210')
  .addMessage(message)
  .build();
```

## Mock Details

### WhatsApp Graph API Mock

Mocks all Meta WhatsApp Business API endpoints:

```javascript
const whatsappMock = require('./mocks/external/whatsapp-api.mock');

// Activate all endpoints
whatsappMock.activate();

// Mock specific responses
whatsappMock.mockSendMessage('123456789012345', customResponse);
whatsappMock.mockError('/messages', 'rateLimitExceeded');
```

**Available Endpoints:**
- OAuth token exchange
- Debug token
- Phone number details
- Send message (text, image, document, location, template)
- Mark as read
- Media upload/download

### Genesys Cloud API Mock

Mocks all Genesys Cloud Platform API endpoints:

```javascript
const genesysMock = require('./mocks/external/genesys-api.mock');

genesysMock.activate();
genesysMock.mockCreateConversation(customResponse);
genesysMock.mockError('/api/v2/conversations', 'unauthorized');
```

**Available Endpoints:**
- OAuth token
- Create/manage conversations
- Send messages
- Receipts
- Typing indicators
- Organization details

### Internal Service Mocks

```javascript
const { tenantService, stateManager, authService } = 
  require('./mocks/internal/internal-services.mock');

tenantService.activate();
stateManager.activate();
authService.activate();
```

### Redis Mock

```javascript
const redisMock = require('./mocks/redis.mock');

// Create mock client
const redisClient = redisMock.createClient();

// Seed test data
await redisMock.setTenantCredentials('tenant-001', 'whatsapp', credentials);
await redisMock.setConversationMapping('+919876543210', mapping);
```

### RabbitMQ Mock

```javascript
const rabbitmqMock = require('./mocks/rabbitmq.mock');

// Create mock connection
const connection = await rabbitmqMock.connect();
const channel = await connection.createChannel();

// Assert messages
MockHelpers.assertRabbitMQMessage('queue-name', expectedContent);

// Get messages for inspection
const messages = MockHelpers.getRabbitMQMessages('queue-name');
```

## Writing Tests

### Example: Testing WhatsApp Service

```javascript
const whatsappService = require('../services/whatsapp-api-service/src/services/whatsapp.service');
const MockHelpers = require('./utils/mock-helpers');
const builders = require('./utils/test-data-builder');

describe('WhatsApp Service', () => {
  beforeAll(() => MockHelpers.activateAll());
  afterAll(() => MockHelpers.deactivateAll());
  beforeEach(() => MockHelpers.resetAll());

  it('should send a text message', async () => {
    const result = await whatsappService.sendText(
      'tenant-001',
      '+919876543210',
      'Hello!'
    );

    expect(result).toHaveProperty('messages');
    expect(result.messages[0]).toHaveProperty('id');
  });

  it('should handle rate limit errors', async () => {
    const mocks = MockHelpers.getMocks();
    mocks.whatsapp.mockError('/messages', 'rateLimitExceeded');

    await expect(
      whatsappService.sendText('tenant-001', '+919876543210', 'Hello!')
    ).rejects.toThrow();
  });
});
```

## Best Practices

1. **Always reset mocks between tests** to avoid test pollution
2. **Use builders** for creating test data instead of hardcoding
3. **Use scenarios** for common test setups
4. **Assert on mock calls** to verify integration points
5. **Keep tests isolated** - each test should work independently

## Troubleshooting

### Mocks not working

Ensure mocks are activated before running tests:
```javascript
beforeAll(() => MockHelpers.activateAll());
```

### Unexpected responses

Check if mocks are properly reset between tests:
```javascript
beforeEach(() => MockHelpers.resetAll());
```

### Port conflicts

Mocks use HTTP interception (nock), not real ports. No port conflicts should occur.

## Next Steps

See [MOCK_USAGE.md](./MOCK_USAGE.md) for detailed examples of using each mock in different scenarios.
