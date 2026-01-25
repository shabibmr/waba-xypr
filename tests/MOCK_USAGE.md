# Mock Usage Examples

This guide provides detailed examples of using mocks in different testing scenarios.

## Table of Contents

- [WhatsApp API Mocks](#whatsapp-api-mocks)
- [Genesys API Mocks](#genesys-api-mocks)
- [Internal Service Mocks](#internal-service-mocks)
- [Redis Mocks](#redis-mocks)
- [RabbitMQ Mocks](#rabbitmq-mocks)
- [Integration Testing](#integration-testing)

## WhatsApp API Mocks

### Sending Messages

```javascript
const whatsappMock = require('./mocks/external/whatsapp-api.mock');
const whatsappService = require('../services/whatsapp-api-service/src/services/whatsapp.service');

describe('WhatsApp Message Sending', () => {
  beforeAll(() => whatsappMock.activate());
  afterAll(() => whatsappMock.deactivate());

  it('should send a text message', async () => {
    const result = await whatsappService.sendText(
      'tenant-001',
      '+919876543210',
      'Hello, how can I help you?'
    );

    expect(result).toHaveProperty('messages');
    expect(result.messages[0].id).toBeDefined();
  });

  it('should send an image message', async () => {
    const result = await whatsappService.sendImage(
      'tenant-001',
      '+919876543210',
      'https://example.com/image.jpg',
      'Check this out!'
    );

    expect(result.messages[0].id).toBeDefined();
  });
});
```

### Handling Errors

```javascript
it('should handle rate limit errors', async () => {
  whatsappMock.mockError('/messages', 'rateLimitExceeded');

  await expect(
    whatsappService.sendText('tenant-001', '+919876543210', 'Hello')
  ).rejects.toThrow();
});

it('should handle invalid token errors', async () => {
  whatsappMock.mockError('/messages', 'invalidToken');

  await expect(
    whatsappService.sendText('tenant-001', '+919876543210', 'Hello')
  ).rejects.toThrow();
});
```

### Custom Responses

```javascript
it('should handle custom message response', async () => {
  const customResponse = {
    messaging_product: 'whatsapp',
    contacts: [{ wa_id: '919876543210' }],
    messages: [{ id: 'custom-message-id-123' }]
  };

  whatsappMock.mockSendMessage('123456789012345', customResponse);

  const result = await whatsappService.sendText(
    'tenant-001',
    '+919876543210',
    'Hello'
  );

  expect(result.messages[0].id).toBe('custom-message-id-123');
});
```

## Genesys API Mocks

### Creating Conversations

```javascript
const genesysMock = require('./mocks/external/genesys-api.mock');
const genesysService = require('../services/genesys-api-service/src/services/genesys-api.service');

describe('Genesys Conversation Management', () => {
  beforeAll(() => genesysMock.activate());
  afterAll(() => genesysMock.deactivate());

  it('should create a new conversation', async () => {
    const messageData = {
      from: { id: '+919876543210', nickname: 'John Doe' },
      text: 'I need help',
      metadata: {
        whatsappMessageId: 'wamid.123',
        displayPhoneNumber: '+1 555-0123'
      },
      isNew: true
    };

    const result = await genesysService.sendInboundMessage(
      'tenant-001',
      messageData
    );

    expect(result.success).toBe(true);
    expect(result.conversationId).toBeDefined();
    expect(result.messageId).toBeDefined();
  });

  it('should add message to existing conversation', async () => {
    const messageData = {
      conversationId: 'conv-12345-abcde-67890',
      text: 'Follow-up message',
      metadata: { whatsappMessageId: 'wamid.456' },
      isNew: false
    };

    const result = await genesysService.sendInboundMessage(
      'tenant-001',
      messageData
    );

    expect(result.success).toBe(true);
    expect(result.conversationId).toBe('conv-12345-abcde-67890');
  });
});
```

### Sending Receipts

```javascript
it('should send delivery receipt', async () => {
  const receiptData = {
    conversationId: 'conv-12345-abcde-67890',
    messageId: 'msg-67890',
    status: 'delivered',
    timestamp: new Date().toISOString()
  };

  const result = await genesysService.sendReceipt('tenant-001', receiptData);

  expect(result.success).toBe(true);
});
```

### Error Handling

```javascript
it('should handle unauthorized errors', async () => {
  genesysMock.mockError('/api/v2/conversations', 'unauthorized');

  await expect(
    genesysService.sendInboundMessage('tenant-001', messageData)
  ).rejects.toThrow();
});
```

## Internal Service Mocks

### Tenant Service

```javascript
const { tenantService } = require('./mocks/internal/internal-services.mock');
const axios = require('axios');

describe('Tenant Service Integration', () => {
  beforeAll(() => tenantService.activate());
  afterAll(() => tenantService.deactivate());

  it('should get tenant configuration', async () => {
    const response = await axios.get(
      'http://localhost:3001/tenants/tenant-001'
    );

    expect(response.data.tenantId).toBe('tenant-001');
    expect(response.data.status).toBe('active');
  });

  it('should get WhatsApp credentials', async () => {
    const response = await axios.get(
      'http://localhost:3001/tenants/tenant-001/whatsapp'
    );

    expect(response.data.phoneNumberId).toBeDefined();
    expect(response.data.accessToken).toBeDefined();
  });

  it('should handle tenant not found', async () => {
    tenantService.mockError('tenantNotFound');

    await expect(
      axios.get('http://localhost:3001/tenants/invalid-tenant')
    ).rejects.toThrow();
  });
});
```

### State Manager

```javascript
const { stateManager } = require('./mocks/internal/internal-services.mock');

describe('State Manager Integration', () => {
  beforeAll(() => stateManager.activate());
  afterAll(() => stateManager.deactivate());

  it('should get conversation mapping', async () => {
    const response = await axios.get(
      'http://localhost:3005/state/conversation',
      { params: { whatsappNumber: '+919876543210' } }
    );

    expect(response.data.genesysConversationId).toBeDefined();
    expect(response.data.tenantId).toBeDefined();
  });

  it('should create conversation mapping', async () => {
    const mapping = {
      whatsappNumber: '+919876543211',
      genesysConversationId: 'conv-new-12345',
      tenantId: 'tenant-001'
    };

    const response = await axios.post(
      'http://localhost:3005/state/conversation',
      mapping
    );

    expect(response.data.id).toBeDefined();
  });
});
```

## Redis Mocks

### Basic Usage

```javascript
const redisMock = require('./mocks/redis.mock');

describe('Redis Operations', () => {
  let redisClient;

  beforeAll(() => {
    redisClient = redisMock.createClient();
  });

  afterAll(async () => {
    await redisMock.close();
  });

  beforeEach(async () => {
    await redisMock.clear();
    await redisMock.seedTestData();
  });

  it('should store and retrieve tenant credentials', async () => {
    const credentials = {
      phoneNumberId: '999888777666',
      accessToken: 'test-token-xyz'
    };

    await redisMock.setTenantCredentials('tenant-002', 'whatsapp', credentials);

    const stored = await redisClient.get('tenant:tenant-002:whatsapp');
    const parsed = JSON.parse(stored);

    expect(parsed.phoneNumberId).toBe('999888777666');
  });

  it('should store conversation mappings', async () => {
    const mapping = {
      genesysConversationId: 'conv-xyz-123',
      tenantId: 'tenant-001',
      status: 'active'
    };

    await redisMock.setConversationMapping('+919999999999', mapping);

    const stored = await redisClient.get('conversation:+919999999999');
    const parsed = JSON.parse(stored);

    expect(parsed.genesysConversationId).toBe('conv-xyz-123');
  });
});
```

## RabbitMQ Mocks

### Publishing and Consuming Messages

```javascript
const rabbitmqMock = require('./mocks/rabbitmq.mock');
const MockHelpers = require('./utils/mock-helpers');

describe('RabbitMQ Message Queue', () => {
  let connection, channel;

  beforeAll(async () => {
    connection = await rabbitmqMock.connect();
    channel = await connection.createChannel();
  });

  afterAll(async () => {
    await rabbitmqMock.close();
  });

  beforeEach(() => {
    rabbitmqMock.clearAll();
  });

  it('should publish message to queue', async () => {
    await channel.assertQueue('test-queue');

    const message = { type: 'test', data: 'Hello' };
    channel.sendToQueue('test-queue', Buffer.from(JSON.stringify(message)));

    const messages = MockHelpers.getRabbitMQMessages('test-queue');
    expect(messages).toHaveLength(1);

    const content = JSON.parse(messages[0].content.toString());
    expect(content.type).toBe('test');
  });

  it('should assert message was sent', () => {
    channel.sendToQueue('test-queue', Buffer.from('test message'));

    expect(() => {
      MockHelpers.assertRabbitMQMessage('test-queue');
    }).not.toThrow();
  });

  it('should assert message content', () => {
    const message = { event: 'message.received', tenantId: 'tenant-001' };
    channel.sendToQueue('events', Buffer.from(JSON.stringify(message)));

    expect(() => {
      MockHelpers.assertRabbitMQMessage('events', message);
    }).not.toThrow();
  });
});
```

## Integration Testing

### End-to-End Message Flow

```javascript
const MockHelpers = require('./utils/mock-helpers');
const builders = require('./utils/test-data-builder');

describe('End-to-End Message Flow', () => {
  beforeAll(() => {
    MockHelpers.activateAll();
  });

  afterAll(() => {
    MockHelpers.deactivateAll();
  });

  beforeEach(() => {
    MockHelpers.resetAll();
  });

  it('should process incoming WhatsApp message to Genesys', async () => {
    // 1. Incoming WhatsApp webhook
    const whatsappPayload = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: '+919876543210',
              text: { body: 'I need help' },
              id: 'wamid.123'
            }],
            metadata: {
              phone_number_id: '123456789012345'
            }
          }
        }]
      }]
    };

    // 2. Process through inbound transformer
    // 3. Create Genesys conversation
    // 4. Store state mapping
    
    // Assert RabbitMQ messages were published
    MockHelpers.assertRabbitMQMessage('inbound-messages');
    
    // Assert state was stored in Redis
    const redisMock = MockHelpers.getMocks().redis;
    const keys = await redisMock.getKeys('conversation:*');
    expect(keys.length).toBeGreaterThan(0);
  });

  it('should process outbound Genesys message to WhatsApp', async () => {
    // Setup existing conversation
    const conversation = builders.conversation()
      .withGenesysConversationId('conv-12345')
      .withWhatsAppNumber('+919876543210')
      .build();

    // 1. Genesys webhook notification
    // 2. Process through outbound transformer
    // 3. Send via WhatsApp API

    // Assert message was sent
    const messages = MockHelpers.getRabbitMQMessages('outbound-messages');
    expect(messages.length).toBeGreaterThan(0);
  });
});
```

### Using Test Scenarios

```javascript
describe('Error Scenarios', () => {
  it('should handle WhatsApp rate limiting', async () => {
    MockHelpers.setupScenario('whatsapp-error');

    // Test code that should handle rate limiting gracefully
  });

  it('should handle Genesys authentication failure', async () => {
    MockHelpers.setupScenario('genesys-error');

    // Test code that should handle auth errors
  });

  it('should handle missing tenant configuration', async () => {
    MockHelpers.setupScenario('tenant-not-found');

    // Test code that should handle missing tenant
  });
});
```

## Tips and Best Practices

1. **Always activate mocks before tests**: Use `beforeAll()` to activate mocks
2. **Reset between tests**: Use `beforeEach()` to reset mock state
3. **Use builders for test data**: More maintainable than hardcoded values
4. **Test error scenarios**: Don't just test happy paths
5. **Assert on side effects**: Check RabbitMQ messages, Redis state, etc.
6. **Use scenarios for common setups**: Reduces boilerplate code
