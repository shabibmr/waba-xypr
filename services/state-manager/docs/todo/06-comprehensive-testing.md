# 06 — Comprehensive Testing Guide

**Priority**: P2 (Required before production)  
**Dependencies**: All (01-05)  
**Estimated Effort**: 8-10 hours

---

## Overview

Comprehensive test suite covering:
- ✅ **Unit Tests** (services, utilities) with mocks
- ✅ **Integration Tests** (full operation flows)
- ✅ **State Machine Tests** (all valid/invalid transitions)
- ✅ **Concurrency Tests** (race conditions, distributed locks)
- ✅ **Error Handling** (DB failures, RabbitMQ disconnects, Redis degradation)
- ✅ **Performance Tests** (load, latency, cache effectiveness)

**Framework**: Jest + Sinon (mocking)  
**Coverage Target**: 85%+

---

## Setup

### 1. Install Dependencies

```bash
cd services/state-manager

npm install --save-dev \
  jest \
  @types/jest \
  ts-jest \
  sinon \
  @types/sinon \
  supertest \
  @types/supertest
```

### 2. Configure Jest

**Create `jest.config.js`:**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/**/*.d.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000
};
```

### 3. Update `package.json`

```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e"
  }
}
```

---

## Test Structure

```
tests/
├── setup.ts                    # Global test setup/teardown
├── mocks/
│   ├── database.mock.ts        # PostgreSQL mock
│   ├── redis.mock.ts           # Redis mock
│   ├── rabbitmq.mock.ts        # RabbitMQ mock
│   └── fixtures.ts             # Test data fixtures
├── unit/
│   ├── services/
│   │   ├── mappingService.test.ts
│   │   ├── messageService.test.ts
│   │   ├── lockService.test.ts
│   │   └── rabbitmq.service.test.ts
│   ├── utils/
│   │   ├── logger.test.ts
│   │   └── validators.test.ts
│   └── types/
│       └── statemachine.test.ts
├── integration/
│   ├── inbound-flow.test.ts
│   ├── outbound-flow.test.ts
│   ├── status-update.test.ts
│   ├── correlation.test.ts
│   └── expiry.test.ts
└── e2e/
    └── full-message-lifecycle.test.ts
```

---

## Mock Implementations

### 1. Database Mock (`tests/mocks/database.mock.ts`)

```typescript
import { Pool, PoolClient } from 'pg';
import sinon from 'sinon';

export class MockDatabase {
  public pool: sinon.SinonStubbedInstance<Pool>;
  public client: sinon.SinonStubbedInstance<PoolClient>;
  
  private storage: Map<string, any[]> = new Map();

  constructor() {
    this.client = {
      query: sinon.stub(),
      release: sinon.stub()
    } as any;

    this.pool = {
      query: sinon.stub(),
      connect: sinon.stub().resolves(this.client),
      end: sinon.stub()
    } as any;

    this.setupDefaultBehavior();
  }

  private setupDefaultBehavior() {
    // Default query behavior
    this.pool.query.callsFake(async (query: string, params: any[]) => {
      return this.handleQuery(query, params);
    });
  }

  private handleQuery(query: string, params: any[]): any {
    const normalized = query.toLowerCase().trim();

    // INSERT with ON CONFLICT
    if (normalized.startsWith('insert into conversation_mappings')) {
      return this.handleMappingInsert(params);
    }

    // INSERT message_tracking
    if (normalized.startsWith('insert into message_tracking')) {
      return this.handleMessageInsert(params);
    }

    // UPDATE status
    if (normalized.includes('update message_tracking')) {
      return this.handleStatusUpdate(params);
    }

    // SELECT by wa_id
    if (normalized.includes('where wa_id =')) {
      return this.getMappingByWaId(params[0]);
    }

    // SELECT by conversation_id
    if (normalized.includes('where conversation_id =')) {
      return this.getMappingByConversationId(params[0]);
    }

    return { rows: [], rowCount: 0 };
  }

  private handleMappingInsert(params: any[]) {
    const [wa_id, last_message_id, contact_name, phone_number_id, display_phone_number] = params;
    const existing = this.storage.get('mappings')?.find((m: any) => m.wa_id === wa_id);

    if (existing) {
      // ON CONFLICT DO UPDATE
      existing.last_message_id = last_message_id;
      existing.last_activity_at = new Date();
      existing.updated_at = new Date();
      return { rows: [{ ...existing, is_insert: false }], rowCount: 1 };
    }

    // New insert
    const newMapping = {
      id: `map_${Date.now()}`,
      wa_id,
      conversation_id: null,
      communication_id: null,
      last_message_id,
      contact_name,
      phone_number_id,
      display_phone_number,
      status: 'active',
      last_activity_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
      is_insert: true
    };

    if (!this.storage.has('mappings')) {
      this.storage.set('mappings', []);
    }
    this.storage.get('mappings')!.push(newMapping);

    return { rows: [newMapping], rowCount: 1 };
  }

  private handleMessageInsert(params: any[]) {
    const [mapping_id, wamid, genesys_message_id, direction, status, media_url] = params;
    
    // Check for duplicate wamid
    const existing = this.storage.get('messages')?.find((m: any) => m.wamid === wamid);
    if (existing) {
      return { rows: [], rowCount: 0 }; // ON CONFLICT DO NOTHING
    }

    const newMessage = {
      id: `msg_${Date.now()}`,
      mapping_id,
      wamid,
      genesys_message_id,
      direction,
      status,
      media_url,
      created_at: new Date(),
      updated_at: new Date(),
      is_insert: true
    };

    if (!this.storage.has('messages')) {
      this.storage.set('messages', []);
    }
    this.storage.get('messages')!.push(newMessage);

    return { rows: [newMessage], rowCount: 1 };
  }

  private handleStatusUpdate(params: any[]) {
    const [new_status, timestamp, message_id, current_status] = params;
    const messages = this.storage.get('messages') || [];
    const message = messages.find((m: any) => m.id === message_id && m.status === current_status);

    if (!message) {
      return { rows: [], rowCount: 0 }; // Race condition or stale update
    }

    message.status = new_status;
    message.updated_at = timestamp;

    return { rows: [message], rowCount: 1 };
  }

  private getMappingByWaId(wa_id: string) {
    const mappings = this.storage.get('mappings') || [];
    const mapping = mappings.find((m: any) => m.wa_id === wa_id && m.status === 'active');
    return mapping ? { rows: [mapping], rowCount: 1 } : { rows: [], rowCount: 0 };
  }

  private getMappingByConversationId(conversation_id: string) {
    const mappings = this.storage.get('mappings') || [];
    const mapping = mappings.find((m: any) => m.conversation_id === conversation_id && m.status === 'active');
    return mapping ? { rows: [mapping], rowCount: 1 } : { rows: [], rowCount: 0 };
  }

  // Test utilities
  seed(table: string, data: any[]) {
    this.storage.set(table, [...data]);
  }

  clear() {
    this.storage.clear();
  }

  getData(table: string) {
    return this.storage.get(table) || [];
  }

  reset() {
    this.clear();
    sinon.reset();
  }
}

export const createMockDatabase = () => new MockDatabase();
```

### 2. Redis Mock (`tests/mocks/redis.mock.ts`)

```typescript
import sinon from 'sinon';

export class MockRedis {
  private cache: Map<string, { value: string; expiry: number }> = new Map();
  private isConnected: boolean = true;

  public get = sinon.stub().callsFake(async (key: string) => {
    if (!this.isConnected) throw new Error('Redis disconnected');
    
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  });

  public setEx = sinon.stub().callsFake(async (key: string, ttl: number, value: string) => {
    if (!this.isConnected) throw new Error('Redis disconnected');
    
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl * 1000
    });
    return 'OK';
  });

  public del = sinon.stub().callsFake(async (key: string) => {
    if (!this.isConnected) throw new Error('Redis disconnected');
    
    return this.cache.delete(key) ? 1 : 0;
  });

  public set = sinon.stub().callsFake(async (key: string, value: string, options?: any) => {
    if (!this.isConnected) throw new Error('Redis disconnected');
    
    const ttl = options?.EX || options?.PX ? (options.EX || options.PX / 1000) : 86400;
    return this.setEx(key, ttl, value);
  });

  // Test utilities
  simulateDisconnect() {
    this.isConnected = false;
  }

  simulateReconnect() {
    this.isConnected = true;
  }

  clear() {
    this.cache.clear();
  }

  getCacheSize() {
    return this.cache.size;
  }

  reset() {
    this.clear();
    this.isConnected = true;
    sinon.reset();
  }
}

export const createMockRedis = () => new MockRedis();
```

### 3. RabbitMQ Mock (`tests/mocks/rabbitmq.mock.ts`)

```typescript
import sinon from 'sinon';

export class MockRabbitMQ {
  private queues: Map<string, any[]> = new Map();
  private isConnected: boolean = true;
  
  public publishToInboundProcessed = sinon.stub().callsFake(async (msg: any) => {
    if (!this.isConnected) throw new Error('RabbitMQ disconnected');
    
    if (!this.queues.has('inbound-processed')) {
      this.queues.set('inbound-processed', []);
    }
    this.queues.get('inbound-processed')!.push(msg);
  });

  public publishToOutboundProcessed = sinon.stub().callsFake(async (msg: any) => {
    if (!this.isConnected) throw new Error('RabbitMQ disconnected');
    
    if (!this.queues.has('outbound-processed')) {
      this.queues.set('outbound-processed', []);
    }
    this.queues.get('outbound-processed')!.push(msg);
  });

  public sendToDLQ = sinon.stub().callsFake(async (msg: any, reason: any, error: string) => {
    if (!this.queues.has('dlq')) {
      this.queues.set('dlq', []);
    }
    this.queues.get('dlq')!.push({ msg, reason, error });
  });

  public consumeInbound = sinon.stub();
  public consumeOutbound = sinon.stub();
  public consumeStatus = sinon.stub();

  // Test utilities
  getQueue(name: string) {
    return this.queues.get(name) || [];
  }

  simulateDisconnect() {
    this.isConnected = false;
  }

  simulateReconnect() {
    this.isConnected = true;
  }

  clear() {
    this.queues.clear();
  }

  reset() {
    this.clear();
    this.isConnected = true;
    sinon.reset();
  }
}

export const createMockRabbitMQ = () => new MockRabbitMQ();
```

### 4. Test Fixtures (`tests/mocks/fixtures.ts`)

```typescript
export const fixtures = {
  inboundMessage: {
    wa_id: '919876543210',
    wamid: 'wamid.test_abc123',
    contact_name: 'Test User',
    phone_number_id: '12345',
    display_phone_number: '+91 98765 43210',
    timestamp: '2026-02-12T06:00:00Z',
    message_text: 'Hello from WhatsApp',
    media_url: null
  },

  outboundMessage: {
    conversation_id: 'conv-abc-123',
    communication_id: 'comm-xyz-456',
    genesys_message_id: 'genesys_msg_789',
    message_text: 'Hello from Genesys',
    timestamp: '2026-02-12T06:01:00Z',
    media_url: null
  },

  statusUpdate: {
    wamid: 'wamid.test_abc123',
    status: 'delivered',
    timestamp: '2026-02-12T06:02:00Z'
  },

  mapping: {
    id: 'map_123',
    wa_id: '919876543210',
    conversation_id: 'conv-abc-123',
    communication_id: 'comm-xyz-456',
    contact_name: 'Test User',
    phone_number_id: '12345',
    display_phone_number: '+91 98765 43210',
    status: 'active',
    last_activity_at: new Date('2026-02-12T06:00:00Z'),
    last_message_id: 'wamid.test_abc123',
    created_at: new Date('2026-02-12T06:00:00Z'),
    updated_at: new Date('2026-02-12T06:00:00Z')
  }
};
```

---

## Unit Tests

### 1. `tests/unit/services/mappingService.test.ts`

```typescript
import { createMockDatabase } from '../../mocks/database.mock';
import { createMockRedis } from '../../mocks/redis.mock';
import { fixtures } from '../../mocks/fixtures';

// Mock dependencies before import
jest.mock('../../../src/config/database');
jest.mock('../../../src/config/redis');

import mappingService from '../../../src/services/mappingService';

describe('MappingService', () => {
  let mockDb: ReturnType<typeof createMockDatabase>;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockDb = createMockDatabase();
    mockRedis = createMockRedis();

    // Inject mocks
    (require('../../../src/config/database').default as any) = mockDb.pool;
    (require('../../../src/config/redis').default as any) = mockRedis;
  });

  afterEach(() => {
    mockDb.reset();
    mockRedis.reset();
  });

  describe('createMappingForInbound', () => {
    it('should create new mapping with NULL conversation_id', async () => {
      const { mapping, isNew } = await mappingService.createMappingForInbound({
        wa_id: fixtures.inboundMessage.wa_id,
        wamid: fixtures.inboundMessage.wamid,
        contact_name: fixtures.inboundMessage.contact_name,
        phone_number_id: fixtures.inboundMessage.phone_number_id,
        display_phone_number: fixtures.inboundMessage.display_phone_number
      });

      expect(isNew).toBe(true);
      expect(mapping.wa_id).toBe(fixtures.inboundMessage.wa_id);
      expect(mapping.conversation_id).toBeNull();
      expect(mapping.last_message_id).toBe(fixtures.inboundMessage.wamid);
    });

    it('should update existing mapping on duplicate wa_id', async () => {
      // First insert
      await mappingService.createMappingForInbound({
        wa_id: fixtures.inboundMessage.wa_id,
        wamid: 'wamid.first',
        contact_name: 'Old Name'
      });

      // Duplicate insert
      const { mapping, isNew } = await mappingService.createMappingForInbound({
        wa_id: fixtures.inboundMessage.wa_id,
        wamid: 'wamid.second',
        contact_name: 'New Name'
      });

      expect(isNew).toBe(false);
      expect(mapping.last_message_id).toBe('wamid.second');
      expect(mapping.contact_name).toBe('New Name');
    });

    it('should cache mapping with 24h TTL', async () => {
      await mappingService.createMappingForInbound({
        wa_id: fixtures.inboundMessage.wa_id,
        wamid: fixtures.inboundMessage.wamid
      });

      expect(mockRedis.setEx.calledOnce).toBe(true);
      const [key, ttl, value] = mockRedis.setEx.firstCall.args;
      expect(ttl).toBe(86400); // 24 hours
    });
  });

  describe('correlateConversation', () => {
    it('should set conversation_id when NULL', async () => {
      // Setup: Create mapping without conversation_id
      mockDb.seed('mappings', [{
        ...fixtures.mapping,
        conversation_id: null,
        last_message_id: 'wamid.test_abc123'
      }]);

      const result = await mappingService.correlateConversation({
        conversation_id: 'conv-new-123',
        communication_id: 'comm-new-456',
        whatsapp_message_id: 'wamid.test_abc123'
      });

      expect(result).not.toBeNull();
      expect(result!.conversation_id).toBe('conv-new-123');
      expect(result!.communication_id).toBe('comm-new-456');
    });

    it('should reject correlation if conversation_id already set', async () => {
      // Setup: Mapping already correlated
      mockDb.seed('mappings', [fixtures.mapping]);

      const result = await mappingService.correlateConversation({
        conversation_id: 'conv-different',
        communication_id: 'comm-different',
        whatsapp_message_id: fixtures.mapping.last_message_id
      });

      expect(result).toBeNull();
    });
  });

  describe('getMappingByWaId', () => {
    it('should return cached mapping on cache hit', async () => {
      mockRedis.setEx('mapping:wa:919876543210', 3600, JSON.stringify(fixtures.mapping));

      const mapping = await mappingService.getMappingByWaId('919876543210');

      expect(mapping!.wa_id).toBe('919876543210');
      expect(mockDb.pool.query.called).toBe(false); // DB not queried
    });

    it('should query DB on cache miss', async () => {
      mockDb.seed('mappings', [fixtures.mapping]);

      const mapping = await mappingService.getMappingByWaId(fixtures.mapping.wa_id);

      expect(mapping!.wa_id).toBe(fixtures.mapping.wa_id);
      expect(mockDb.pool.query.called).toBe(true);
    });

    it('should handle Redis failure gracefully', async () => {
      mockRedis.simulateDisconnect();
      mockDb.seed('mappings', [fixtures.mapping]);

      const mapping = await mappingService.getMappingByWaId(fixtures.mapping.wa_id);

      expect(mapping!.wa_id).toBe(fixtures.mapping.wa_id);
    });
  });
});
```

### 2. `tests/unit/services/messageService.test.ts`

```typescript
import { createMockDatabase } from '../../mocks/database.mock';
import { MessageStatus, MessageDirection } from '../../../src/types';

jest.mock('../../../src/config/database');

import messageService from '../../../src/services/messageService';

describe('MessageService', () => {
  let mockDb: ReturnType<typeof createMockDatabase>;

  beforeEach(() => {
    mockDb = createMockDatabase();
    (require('../../../src/config/database').default as any) = mockDb.pool;
  });

  afterEach(() => {
    mockDb.reset();
  });

  describe('trackMessage', () => {
    it('should create new message with wamid', async () => {
      const { messageId, created } = await messageService.trackMessage({
        mapping_id: 'map_123',
        wamid: 'wamid.test_abc',
        direction: MessageDirection.INBOUND,
        status: MessageStatus.RECEIVED
      });

      expect(created).toBe(true);
      expect(messageId).toBeDefined();
    });

    it('should prevent duplicate wamid insertion', async () => {
      // First insert
      await messageService.trackMessage({
        mapping_id: 'map_123',
        wamid: 'wamid.duplicate',
        direction: MessageDirection.INBOUND,
        status: MessageStatus.RECEIVED
      });

      // Duplicate attempt
      const { messageId, created } = await messageService.trackMessage({
        mapping_id: 'map_123',
        wamid: 'wamid.duplicate',
        direction: MessageDirection.INBOUND,
        status: MessageStatus.RECEIVED
      });

      expect(created).toBe(false);
    });
  });

  describe('updateStatus', () => {
    it('should update status with valid transition', async () => {
      mockDb.seed('messages', [{
        id: 'msg_123',
        wamid: 'wamid.test',
        status: MessageStatus.SENT,
        updated_at: new Date('2026-02-12T06:00:00Z')
      }]);

      const result = await messageService.updateStatus({
        wamid: 'wamid.test',
        new_status: MessageStatus.DELIVERED,
        timestamp: new Date('2026-02-12T06:01:00Z')
      });

      expect(result.updated).toBe(true);
      expect(result.previous_status).toBe(MessageStatus.SENT);
    });

    it('should reject invalid state transition', async () => {
      mockDb.seed('messages', [{
        id: 'msg_123',
        wamid: 'wamid.test',
        status: MessageStatus.DELIVERED,
        updated_at: new Date('2026-02-12T06:00:00Z')
      }]);

      const result = await messageService.updateStatus({
        wamid: 'wamid.test',
        new_status: MessageStatus.SENT, // Invalid: DELIVERED -> SENT
        timestamp: new Date('2026-02-12T06:01:00Z')
      });

      expect(result.updated).toBe(false);
    });

    it('should reject stale updates', async () => {
      mockDb.seed('messages', [{
        id: 'msg_123',
        wamid: 'wamid.test',
        status: MessageStatus.SENT,
        updated_at: new Date('2026-02-12T06:05:00Z')
      }]);

      const result = await messageService.updateStatus({
        wamid: 'wamid.test',
        new_status: MessageStatus.DELIVERED,
        timestamp: new Date('2026-02-12T06:02:00Z') // Older timestamp
      });

      expect(result.updated).toBe(false);
    });
  });
});
```

### 3. `tests/unit/types/statemachine.test.ts`

```typescript
import { 
  MessageStatus, 
  isValidStateTransition, 
  MESSAGE_STATE_TRANSITIONS 
} from '../../../src/types';

describe('Message State Machine', () => {
  describe('Valid Transitions', () => {
    test('QUEUED -> SENT', () => {
      expect(isValidStateTransition(MessageStatus.QUEUED, MessageStatus.SENT)).toBe(true);
    });

    test('SENT -> DELIVERED', () => {
      expect(isValidStateTransition(MessageStatus.SENT, MessageStatus.DELIVERED)).toBe(true);
    });

    test('DELIVERED -> READ', () => {
      expect(isValidStateTransition(MessageStatus.DELIVERED, MessageStatus.READ)).toBe(true);
    });

    test('SENT -> FAILED', () => {
      expect(isValidStateTransition(MessageStatus.SENT, MessageStatus.FAILED)).toBe(true);
    });

    test('Idempotent transitions', () => {
      expect(isValidStateTransition(MessageStatus.SENT, MessageStatus.SENT)).toBe(true);
      expect(isValidStateTransition(MessageStatus.DELIVERED, MessageStatus.DELIVERED)).toBe(true);
    });
  });

  describe('Invalid Transitions', () => {
    test('DELIVERED -> SENT (backward)', () => {
      expect(isValidStateTransition(MessageStatus.DELIVERED, MessageStatus.SENT)).toBe(false);
    });

    test('READ -> DELIVERED (backward)', () => {
      expect(isValidStateTransition(MessageStatus.READ, MessageStatus.DELIVERED)).toBe(false);
    });

    test('QUEUED -> READ (skip steps)', () => {
      expect(isValidStateTransition(MessageStatus.QUEUED, MessageStatus.READ)).toBe(false);
    });

    test('FAILED -> DELIVERED (no retry)', () => {
      expect(isValidStateTransition(MessageStatus.FAILED, MessageStatus.DELIVERED)).toBe(false);
    });
  });

  describe('Completeness Check', () => {
    it('should have transition rules for all statuses', () => {
      const allStatuses = Object.values(MessageStatus);
      
      allStatuses.forEach(status => {
        expect(MESSAGE_STATE_TRANSITIONS[status]).toBeDefined();
        expect(Array.isArray(MESSAGE_STATE_TRANSITIONS[status])).toBe(true);
      });
    });
  });
});
```

---

## Integration Tests

### `tests/integration/inbound-flow.test.ts`

```typescript
import { createMockDatabase } from '../mocks/database.mock';
import { createMockRedis } from '../mocks/redis.mock';
import { createMockRabbitMQ } from '../mocks/rabbitmq.mock';
import { fixtures } from '../mocks/fixtures';
import { handleInboundMessage } from '../../src/services/operationHandlers';

describe('Inbound Message Flow (Integration)', () => {
  let mockDb: any, mockRedis: any, mockRabbitMQ: any;

  beforeEach(() => {
    mockDb = createMockDatabase();
    mockRedis = createMockRedis();
    mockRabbitMQ = createMockRabbitMQ();

    // Inject mocks
    jest.mock('../../src/config/database', () => ({ default: mockDb.pool }));
    jest.mock('../../src/config/redis', () => ({ default: mockRedis }));
    jest.mock('../../src/services/rabbitmq.service', () => ({ rabbitmqService: mockRabbitMQ }));
  });

  afterEach(() => {
    mockDb.reset();
    mockRedis.reset();
    mockRabbitMQ.reset();
  });

  it('should process new inbound message end-to-end', async () => {
    await handleInboundMessage(fixtures.inboundMessage);

    // Verify mapping created
    const mappings = mockDb.getData('mappings');
    expect(mappings.length).toBe(1);
    expect(mappings[0].wa_id).toBe(fixtures.inboundMessage.wa_id);
    expect(mappings[0].conversation_id).toBeNull();

    // Verify message tracked
    const messages = mockDb.getData('messages');
    expect(messages.length).toBe(1);
    expect(messages[0].wamid).toBe(fixtures.inboundMessage.wamid);
    expect(messages[0].direction).toBe('inbound');
    expect(messages[0].status).toBe('received');

    // Verify published to queue
    const queue = mockRabbitMQ.getQueue('inbound-processed');
    expect(queue.length).toBe(1);
    expect(queue[0].wa_id).toBe(fixtures.inboundMessage.wa_id);
    expect(queue[0].is_new_conversation).toBe(true);

    // Verify cache populated
    expect(mockRedis.setEx.called).toBe(true);
  });

  it('should handle duplicate wamid gracefully', async () => {
    await handleInboundMessage(fixtures.inboundMessage);
    await handleInboundMessage(fixtures.inboundMessage); // Duplicate

    const messages = mockDb.getData('messages');
    expect(messages.length).toBe(1); // Only one message

    const queue = mockRabbitMQ.getQueue('inbound-processed');
    expect(queue.length).toBe(2); // Both published (idempotent consumer downstream)
  });
});
```

---

## Performance Tests

### `tests/performance/concurrency.test.ts`

```typescript
describe('Concurrency Tests', () => {
  it('should handle 100 concurrent inbound messages without race conditions', async () => {
    const promises = Array.from({ length: 100 }, (_, i) => 
      handleInboundMessage({
        ...fixtures.inboundMessage,
        wamid: `wamid.concurrent_${i}`
      })
    );

    await Promise.all(promises);

    const messages = mockDb.getData('messages');
    expect(messages.length).toBe(100);

    // Verify no duplicate wamids
    const wamids = messages.map((m: any) => m.wamid);
    expect(new Set(wamids).size).toBe(100);
  });

  it('should respect distributed locks', async () => {
    const wa_id = '919876543210';

    const promises = [
      handleInboundMessage({ ...fixtures.inboundMessage, wa_id, wamid: 'wamid.1' }),
      handleInboundMessage({ ...fixtures.inboundMessage, wa_id, wamid: 'wamid.2' }),
      handleInboundMessage({ ...fixtures.inboundMessage, wa_id, wamid: 'wamid.3' })
    ];

    await Promise.all(promises);

    const mappings = mockDb.getData('mappings');
    expect(mappings.length).toBe(1); // Only one mapping for same wa_id
    expect(mappings[0].wa_id).toBe(wa_id);
  });
});
```

---

## Running Tests

```bash
# All tests with coverage
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Watch mode
npm run test:watch

# Coverage report
npm test -- --coverage --coverageReporters=html
open coverage/index.html
```

---

## Coverage Targets

| Component | Target | Critical Paths |
|-----------|--------|----------------|
| **mappingService** | 90% | Create, correlate, cache |
| **messageService** | 90% | Track, state transitions |
| **operationHandlers** | 85% | All 5 operations |
| **lockService** | 95% | Acquire, release, retry |
| **State Machine** | 100% | All transitions |
| **Overall** | 85% | - |

---

## Next Steps

1. Implement unit tests for each service
2. Add integration tests for complete flows
3. Run coverage report and fix gaps
4. Add E2E tests with real dependencies (Docker Compose)
5. Integrate into CI/CD pipeline
