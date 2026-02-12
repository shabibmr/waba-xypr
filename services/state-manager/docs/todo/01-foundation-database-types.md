# 01 — Foundation: Database Schema & Types

**Priority**: P0 (Blocking all other work)  
**Dependencies**: None  
**Estimated Effort**: 4-6 hours

---

## Tasks

### 1. Fix Database Schema in `src/utils/dbInit.ts`

#### 1.1 Update `conversation_mappings` table

**Current Issues**:
- ❌ Line 8: `id SERIAL` should be `UUID DEFAULT gen_random_uuid()`
- ❌ Line 9: `wa_id VARCHAR(50) UNIQUE` has global unique — prevents re-use after expiry
- ❌ Line 10: `conversation_id VARCHAR(100) UNIQUE NOT NULL` should be NULLABLE initially
- ❌ Missing: `communication_id VARCHAR(100)`
- ❌ Missing: `last_message_id VARCHAR(255)` with index
- ❌ Missing: Partial unique index on `wa_id WHERE status = 'active'`
- ❌ Missing: Index on `last_activity_at` for expiry queries
- ❌ Missing: Index on `status`
- ❌ Line 17: `status` has no CHECK constraint

**Actions**:
```sql
-- Replace lines 7-19 with:
CREATE TABLE IF NOT EXISTS conversation_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id VARCHAR(50) NOT NULL,
  conversation_id VARCHAR(100),  -- NULLABLE until Genesys correlation
  communication_id VARCHAR(100),
  last_message_id VARCHAR(255),
  contact_name VARCHAR(255),
  phone_number_id VARCHAR(50),
  display_phone_number VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

-- Replace global UNIQUE with partial unique index (line 21):
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_mapping 
ON conversation_mappings (wa_id) 
WHERE status = 'active';

-- Existing indexes (modify line 22):
CREATE INDEX IF NOT EXISTS idx_wa_id ON conversation_mappings(wa_id);
CREATE INDEX IF NOT EXISTS idx_conversation_id ON conversation_mappings(conversation_id);

-- Add missing indexes:
CREATE INDEX IF NOT EXISTS idx_last_message_id ON conversation_mappings(last_message_id);
CREATE INDEX IF NOT EXISTS idx_last_activity_at ON conversation_mappings(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_status ON conversation_mappings(status);
```

**Logging**:
```typescript
console.log('✓ conversation_mappings table created/verified');
console.log('✓ Partial unique index on (wa_id WHERE status=active) created');
console.log('✓ 5 indexes created for conversation_mappings');
```

#### 1.2 Update `message_tracking` table

**Current Issues**:
- ❌ Line 25: `id SERIAL` should be UUID
- ❌ Line 26: `conversation_id VARCHAR(100)` should be `mapping_id UUID REFERENCES conversation_mappings(id)`
- ❌ Missing: `wamid VARCHAR(255) NOT NULL UNIQUE` (critical for idempotency)
- ❌ Line 29: `direction` has no CHECK constraint
- ❌ Line 30: `status` should have state machine values
- ❌ Missing: `media_url TEXT`

**Actions**:
```sql
-- Replace lines 24-34 with:
CREATE TABLE IF NOT EXISTS message_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id UUID NOT NULL REFERENCES conversation_mappings(id) ON DELETE CASCADE,
  wamid VARCHAR(255) NOT NULL UNIQUE,  -- WhatsApp message ID (idempotency key)
  genesys_message_id VARCHAR(100),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  status VARCHAR(20) NOT NULL DEFAULT 'received',
  media_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  metadata JSONB
);

-- Replace indexes (lines 36-37):
CREATE UNIQUE INDEX IF NOT EXISTS idx_wamid ON message_tracking(wamid);
CREATE INDEX IF NOT EXISTS idx_mapping_id ON message_tracking(mapping_id);
CREATE INDEX IF NOT EXISTS idx_genesys_message_id ON message_tracking(genesys_message_id);
CREATE INDEX IF NOT EXISTS idx_direction ON message_tracking(direction);
CREATE INDEX IF NOT EXISTS idx_status ON message_tracking(status);
CREATE INDEX IF NOT EXISTS idx_created_at ON message_tracking(created_at);
```

**Logging**:
```typescript
console.log('✓ message_tracking table created/verified');
console.log('✓ Foreign key to conversation_mappings established');
console.log('✓ wamid UNIQUE constraint created for idempotency');
console.log('✓ 6 indexes created for message_tracking');
```

#### 1.3 Migration Notes

**⚠️ Breaking Change**: This is a schema-breaking change. Options:
1. Drop existing tables (DEV only): `DROP TABLE IF EXISTS message_tracking, conversation_mappings CASCADE;`
2. Create migration script for production data

Add to `dbInit.ts` before schema creation:
```typescript
console.log('🔄 Database schema initialization started...');
const ENV = process.env.NODE_ENV || 'development';
if (ENV === 'development') {
  console.log('⚠️  DEV mode: Dropping existing tables for clean schema');
  await client.query('DROP TABLE IF EXISTS message_tracking, conversation_context, conversation_mappings CASCADE');
}
```

---

### 2. Create Type Definitions in `src/types/index.ts`

**Current Status**: Directory exists but file is empty

**Actions**: Create comprehensive type definitions

```typescript
// src/types/index.ts

// ==================== Database Models ====================

export interface ConversationMapping {
  id: string; // UUID
  wa_id: string;
  conversation_id: string | null; // NULL until Genesys correlation
  communication_id: string | null;
  last_message_id: string | null;
  contact_name: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  status: ConversationStatus;
  last_activity_at: Date;
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any>;
}

export interface MessageTracking {
  id: string; // UUID
  mapping_id: string; // UUID FK to conversation_mappings
  wamid: string; // WhatsApp message ID (unique)
  genesys_message_id: string | null;
  direction: MessageDirection;
  status: MessageStatus;
  media_url: string | null;
  created_at: Date;
  updated_at: Date;
  delivered_at: Date | null;
  metadata?: Record<string, any>;
}

// ==================== Enums ====================

export enum ConversationStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
  EXPIRED = 'expired'
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND'
}

export enum MessageStatus {
  // Outbound statuses
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  
  // Inbound statuses
  RECEIVED = 'received',
  PROCESSED = 'processed',
  
  // Terminal status
  FAILED = 'failed'
}

// ==================== State Machine ====================

export const MESSAGE_STATE_TRANSITIONS: Record<MessageStatus, MessageStatus[]> = {
  [MessageStatus.QUEUED]: [MessageStatus.SENT, MessageStatus.FAILED],
  [MessageStatus.SENT]: [MessageStatus.DELIVERED, MessageStatus.FAILED],
  [MessageStatus.DELIVERED]: [MessageStatus.READ, MessageStatus.FAILED],
  [MessageStatus.READ]: [], // terminal
  [MessageStatus.RECEIVED]: [MessageStatus.PROCESSED, MessageStatus.FAILED],
  [MessageStatus.PROCESSED]: [], // terminal
  [MessageStatus.FAILED]: [] // terminal
};

export function isValidStateTransition(currentStatus: MessageStatus, newStatus: MessageStatus): boolean {
  if (currentStatus === newStatus) {
    return true; // Idempotent update
  }
  return MESSAGE_STATE_TRANSITIONS[currentStatus].includes(newStatus);
}

// ==================== Queue Payloads ====================

export interface InboundMessage {
  wa_id: string;
  wamid: string;
  message_text?: string;
  contact_name?: string;
  timestamp: string; // ISO 8601
  media_url?: string;
  phone_number_id?: string;
  display_phone_number?: string;
}

export interface OutboundMessage {
  conversation_id: string;
  genesys_message_id: string;
  message_text?: string;
  media_url?: string;
}

export interface StatusUpdate {
  wamid: string;
  status: MessageStatus;
  timestamp: string; // ISO 8601
}

export interface ConversationCorrelation {
  conversation_id: string;
  communication_id: string;
  whatsapp_message_id: string; // wamid
}

// ==================== Enriched Payloads ====================

export interface EnrichedInboundMessage extends InboundMessage {
  mapping_id: string;
  conversation_id: string | null;
  is_new_conversation: boolean;
}

export interface EnrichedOutboundMessage extends OutboundMessage {
  wa_id: string;
  mapping_id: string;
}

// ==================== DLQ ====================

export enum DLQReason {
  LOCK_TIMEOUT = 'lock_timeout',
  MAPPING_NOT_FOUND = 'mapping_not_found',
  INVALID_PAYLOAD = 'invalid_payload',
  STATE_VIOLATION = 'state_violation',
  MAPPING_STATUS_EXPIRED = 'mapping_status_expired',
  MAPPING_STATUS_CLOSED = 'mapping_status_closed',
  DATABASE_ERROR = 'database_error',
  INVALID_MEDIA_URL = 'invalid_media_url'
}

export interface DLQMessage<T = any> {
  original_payload: T;
  reason: DLQReason;
  error_message?: string;
  retry_count: number;
  timestamp: string;
}

// ==================== API Responses ====================

export interface MappingResponse {
  waId: string;
  conversationId: string | null;
  contactName: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  communicationId: string | null;
  lastActivityAt: string;
  status: ConversationStatus;
  isNew: boolean;
  internalId: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: {
      status: 'ok' | 'error';
      latency_ms?: number;
      error?: string;
    };
    redis: {
      status: 'ok' | 'error';
      latency_ms?: number;
      error?: string;
    };
    rabbitmq?: {
      status: 'ok' | 'error';
      queue_depth?: number;
      error?: string;
    };
  };
  uptime_seconds?: number;
}
```

**Logging**:
```typescript
// Add to top of file:
console.log('✓ Type definitions loaded');
```

---

### 3. Add Logging Utility in `src/utils/logger.ts`

**Purpose**: Structured logging for debugging

**Actions**: Create logger utility

```typescript
// src/utils/logger.ts

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

interface LogContext {
  operation?: string;
  wa_id?: string;
  wamid?: string;
  mapping_id?: string;
  conversation_id?: string;
  duration_ms?: number;
  [key: string]: any;
}

class Logger {
  private minLevel: LogLevel = LogLevel.DEBUG;

  constructor() {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() as LogLevel;
    if (envLevel && Object.values(LogLevel).includes(envLevel)) {
      this.minLevel = envLevel;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.CRITICAL];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    if (!this.shouldLog(level)) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'state-manager',
      message,
      ...context
    };

    const output = JSON.stringify(logEntry);
    console.log(output);
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext) {
    this.log(LogLevel.ERROR, message, context);
  }

  critical(message: string, context?: LogContext) {
    this.log(LogLevel.CRITICAL, message, context);
  }
}

export const logger = new Logger();
export default logger;
```

**Usage Example**:
```typescript
logger.info('Mapping resolved successfully', {
  operation: 'inbound_identity_resolution',
  wa_id: '919876543210',
  wamid: 'wamid.xxx',
  mapping_id: 'uuid-456',
  cache_hit: true,
  is_new_conversation: false,
  duration_ms: 8
});
```

---

## Verification

After completing all tasks:

1. **Test DB schema**:
```bash
npm run dev
# Check logs for schema creation messages
```

2. **Test types**:
```typescript
import { ConversationMapping, MessageStatus, isValidStateTransition } from './types';
console.log(isValidStateTransition(MessageStatus.QUEUED, MessageStatus.SENT)); // true
console.log(isValidStateTransition(MessageStatus.DELIVERED, MessageStatus.SENT)); // false
```

3. **Test logger**:
```typescript
import logger from './utils/logger';
logger.info('Test message', { operation: 'test', wa_id: '123' });
```

---

## Next Steps

Once complete, proceed to:
- **02-infrastructure-rabbitmq-redis.md** (RabbitMQ setup, Redis enhancements, locking)
