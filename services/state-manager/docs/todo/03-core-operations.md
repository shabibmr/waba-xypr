# 03 — Core Operations

**Priority**: P1 (Critical business logic)  
**Dependencies**: 01-foundation, 02-infrastructure  
**Estimated Effort**: 10-12 hours

---

## Overview

Implement the 5 core operations from FRD:
1. **Inbound Message — Identity Resolution** (RabbitMQ → enriched payload)
2. **Outbound Message — Identity Resolution** (RabbitMQ → enriched payload)
3. **Message Status Update (WhatsApp)** (RabbitMQ → DB update)
4. **Message Status Update (Genesys)** (API → DB update)  
5. **Conversation ID Correlation** (API → DB update + cache)

---

## Tasks

### 1. Update `src/services/mappingService.ts`

**Current Issues**:
- Uses HTTP-only flow, needs RabbitMQ integration
- Generates `conversation_id` upfront (wrong — should be NULL until Genesys correlation)
- No distributed locking
- No idempotent `ON CONFLICT` handling
- Doesn't track `last_message_id`
- Cache TTL is 1 hour instead of 24 hours

#### 1.1 Replace entire file contents

```typescript
// src/services/mappingService.ts
import pool from '../config/database';
import redisClient from '../config/redis';
import logger from '../utils/logger';
import { ConversationMapping, ConversationStatus } from '../types';

const { KEYS } = require('../../../../shared/constants');

class MappingService {
  
  // ==================== Inbound: Create mapping with NULL conversation_id ====================
  
  async createMappingForInbound(data: {
    wa_id: string;
    wamid: string;
    contact_name?: string;
    phone_number_id?: string;
    display_phone_number?: string;
  }): Promise<{ mapping: ConversationMapping; isNew: boolean }> {
    
    const { wa_id, wamid, contact_name, phone_number_id, display_phone_number } = data;
    
    logger.debug('Creating/updating mapping for inbound', { 
      operation: 'create_mapping_inbound',
      wa_id, 
      wamid 
    });

    // Idempotent INSERT with ON CONFLICT
    const result = await pool.query<ConversationMapping & { is_insert: boolean }>(
      `INSERT INTO conversation_mappings (
        wa_id, last_message_id, contact_name, phone_number_id, 
        display_phone_number, status, last_activity_at
      ) VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP)
      ON CONFLICT (wa_id) WHERE status = 'active'
      DO UPDATE SET 
        last_message_id = EXCLUDED.last_message_id,
        last_activity_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP,
        contact_name = COALESCE(EXCLUDED.contact_name, conversation_mappings.contact_name)
      RETURNING *, (xmax = 0) AS is_insert`,
      [wa_id, wamid, contact_name, phone_number_id, display_phone_number]
    );

    const mapping = result.rows[0];
    const isNew = mapping.is_insert;

    logger.info(isNew ? 'New mapping created' : 'Existing mapping updated', {
      operation: 'create_mapping_inbound',
      wa_id,
      mapping_id: mapping.id,
      conversation_id: mapping.conversation_id,
      is_new: isNew
    });

    // Cache with 24h TTL
    await this.cacheMapping(mapping);

    return { mapping, isNew };
  }

  // ==================== Correlation: Set conversation_id after Genesys creates conversation ====================
  
  async correlateConversation(data: {
    conversation_id: string;
    communication_id: string;
    whatsapp_message_id: string; // wamid
  }): Promise<ConversationMapping | null> {
    
    const { conversation_id, communication_id, whatsapp_message_id } = data;

    logger.info('Correlating conversation', {
      operation: 'correlate_conversation',
      conversation_id,
      communication_id,
      whatsapp_message_id
    });

    // Idempotent UPDATE - only if conversation_id is NULL
    const result = await pool.query<ConversationMapping>(
      `UPDATE conversation_mappings
       SET conversation_id = $1,
           communication_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE last_message_id = $3 
         AND conversation_id IS NULL
       RETURNING *`,
      [conversation_id, communication_id, whatsapp_message_id]
    );

    if (result.rows.length === 0) {
      logger.warn('Conversation already correlated or message not found', {
        operation: 'correlate_conversation',
        conversation_id,
        whatsapp_message_id
      });
      return null;
    }

    const mapping = result.rows[0];

    logger.info('Conversation correlated successfully', {
      operation: 'correlate_conversation',
      wa_id: mapping.wa_id,
      conversation_id,
      communication_id,
      mapping_id: mapping.id
    });

    // Update cache with both keys
    await this.cacheMapping(mapping);

    return mapping;
  }

  // ==================== Lookup: Cache-first patterns ====================
  
  async getMappingByWaId(wa_id: string): Promise<ConversationMapping | null> {
    const cacheKey = KEYS.mappingWa(wa_id);
    
    // Try cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.debug('Cache hit', { 
        operation: 'get_mapping_by_wa_id', 
        wa_id, 
        cache_hit: true 
      });
      return JSON.parse(cached);
    }

    // Database fallback
    logger.debug('Cache miss, querying DB', { 
      operation: 'get_mapping_by_wa_id', 
      wa_id, 
      cache_hit: false 
    });
    
    const result = await pool.query<ConversationMapping>(
      `SELECT * FROM conversation_mappings 
       WHERE wa_id = $1 AND status = 'active'
       ORDER BY last_activity_at DESC
       LIMIT 1`,
      [wa_id]
    );

    if (result.rows.length === 0) {
      logger.debug('No active mapping found', { 
        operation: 'get_mapping_by_wa_id',
        wa_id 
      });
      return null;
    }

    const mapping = result.rows[0];
    
    // Populate cache
    await this.cacheMapping(mapping);

    return mapping;
  }

  async getMappingByConversationId(conversation_id: string): Promise<ConversationMapping | null> {
    const cacheKey = KEYS.mappingConv(conversation_id);
    
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.debug('Cache hit', { 
        operation: 'get_mapping_by_conv_id', 
        conversation_id, 
        cache_hit: true 
      });
      return JSON.parse(cached);
    }

    logger.debug('Cache miss, querying DB', { 
      operation: 'get_mapping_by_conv_id', 
      conversation_id, 
      cache_hit: false 
    });

    const result = await pool.query<ConversationMapping>(
      `SELECT * FROM conversation_mappings 
       WHERE conversation_id = $1 AND status = 'active'`,
      [conversation_id]
    );

    if (result.rows.length === 0) {
      logger.debug('No active mapping found', { 
        operation: 'get_mapping_by_conv_id',
        conversation_id 
      });
      return null;
    }

    const mapping = result.rows[0];
    await this.cacheMapping(mapping);

    return mapping;
  }

  // ==================== Activity Tracking ====================
  
  async updateActivity(mapping_id: string, message_id: string): Promise<void> {
    await pool.query(
      `UPDATE conversation_mappings
       SET last_activity_at = CURRENT_TIMESTAMP,
           last_message_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [message_id, mapping_id]
    );

    logger.debug('Activity timestamp updated', { 
      operation: 'update_activity',
      mapping_id, 
      message_id 
    });
  }

  // ==================== Caching ====================
  
  async cacheMapping(mapping: ConversationMapping): Promise<void> {
    const ttl = 86400; // 24 hours (FRD spec)

    const cacheData = {
      id: mapping.id,
      wa_id: mapping.wa_id,
      conversation_id: mapping.conversation_id,
      communication_id: mapping.communication_id,
      contact_name: mapping.contact_name,
      phone_number_id: mapping.phone_number_id,
      display_phone_number: mapping.display_phone_number,
      status: mapping.status,
      last_activity_at: mapping.last_activity_at,
      last_message_id: mapping.last_message_id
    };

    // Cache by wa_id
    await redisClient.setEx(
      KEYS.mappingWa(mapping.wa_id), 
      ttl, 
      JSON.stringify(cacheData)
    );

    // Cache by conversation_id (if set)
    if (mapping.conversation_id) {
      await redisClient.setEx(
        KEYS.mappingConv(mapping.conversation_id), 
        ttl, 
        JSON.stringify(cacheData)
      );
    }

    logger.debug('Mapping cached', {
      operation: 'cache_mapping',
      wa_id: mapping.wa_id,
      conversation_id: mapping.conversation_id,
      ttl
    });
  }

  async invalidateCache(wa_id: string, conversation_id?: string): Promise<void> {
    await redisClient.del(KEYS.mappingWa(wa_id));
    
    if (conversation_id) {
      await redisClient.del(KEYS.mappingConv(conversation_id));
    }

    logger.debug('Cache invalidated', { 
      operation: 'invalidate_cache',
      wa_id, 
      conversation_id 
    });
  }

  // ==================== Legacy Methods (keep for backward compatibility) ====================
  
  async getMapping(waId: string) {
    const mapping = await this.getMappingByWaId(waId);
    if (!mapping) return null;

    return this.formatMapping(mapping);
  }

  async getMappingByConversationId_legacy(conversationId: string) {
    const mapping = await this.getMappingByConversationId(conversationId);
    if (!mapping) return null;

    return this.formatMapping(mapping);
  }

  formatMapping(mapping: ConversationMapping) {
    return {
      waId: mapping.wa_id,
      conversationId: mapping.conversation_id,
      contactName: mapping.contact_name,
      phoneNumberId: mapping.phone_number_id,
      displayPhoneNumber: mapping.display_phone_number,
      communicationId: mapping.communication_id,
      status: mapping.status,
      lastActivityAt: mapping.last_activity_at,
      isNew: !mapping.conversation_id,
      internalId: mapping.id
    };
  }
}

export default new MappingService();
```

---

### 2. Update `src/services/messageService.ts`

**Add state machine validation and idempotent message tracking**

```typescript
// src/services/messageService.ts
import pool from '../config/database';
import logger from '../utils/logger';
import { 
  MessageTracking, 
  MessageDirection, 
  MessageStatus, 
  isValidStateTransition 
} from '../types';

class MessageService {
  
  // ==================== Idempotent Message Tracking ====================
  
  async trackMessage(data: {
    mapping_id: string;
    wamid?: string;
    genesys_message_id?: string;
    direction: MessageDirection;
    status: MessageStatus;
    media_url?: string;
  }): Promise<{ messageId: string; created: boolean }> {
    
    const { mapping_id, wamid, genesys_message_id, direction, status, media_url } = data;

    if (!wamid && !genesys_message_id) {
      throw new Error('Either wamid or genesys_message_id is required');
    }

    logger.debug('Tracking message', {
      operation: 'track_message',
      wamid,
      genesys_message_id,
      direction,
      status
    });

    // Idempotent insert if wamid is provided
    if (wamid) {
      const result = await pool.query<MessageTracking & { is_insert: boolean }>(
        `INSERT INTO message_tracking 
         (mapping_id, wamid, genesys_message_id, direction, status, media_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (wamid) DO NOTHING
         RETURNING *, (xmax = 0) AS is_insert`,
        [mapping_id, wamid, genesys_message_id, direction, status, media_url]
      );

      if (result.rows.length === 0) {
        // Conflict occurred - message already tracked
        logger.warn('Duplicate wamid, message already tracked', {
          operation: 'track_message',
          wamid,
          direction
        });

        // Fetch existing message
        const existing = await pool.query<MessageTracking>(
          'SELECT * FROM message_tracking WHERE wamid = $1',
          [wamid]
        );

        return { messageId: existing.rows[0].id, created: false };
      }

      const message = result.rows[0];
      logger.info('Message tracked', {
        operation: 'track_message',
        message_id: message.id,
        wamid,
        direction,
        status,
        created: message.is_insert
      });

      return { messageId: message.id, created: message.is_insert };
    }

    // No wamid - simple insert (outbound without wamid)
    const result = await pool.query<MessageTracking>(
      `INSERT INTO message_tracking 
       (mapping_id, genesys_message_id, direction, status, media_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [mapping_id, genesys_message_id, direction, status, media_url]
    );

    logger.info('Message tracked (no wamid)', {
      operation: 'track_message',
      message_id: result.rows[0].id,
      genesys_message_id,
      direction,
      status
    });

    return { messageId: result.rows[0].id, created: true };
  }

  // ==================== Status Update with State Machine ====================
  
  async updateStatus(data: {
    wamid?: string;
    genesys_message_id?: string;
    new_status: MessageStatus;
    timestamp: Date;
  }): Promise<{ updated: boolean; previous_status?: MessageStatus }> {
    
    const { wamid, genesys_message_id, new_status, timestamp } = data;

    logger.debug('Updating message status', {
      operation: 'update_status',
      wamid,
      genesys_message_id,
      new_status
    });

    // 1. Fetch current message
    let query = 'SELECT * FROM message_tracking WHERE ';
    let params: any[];

    if (wamid) {
      query += 'wamid = $1';
      params = [wamid];
    } else if (genesys_message_id) {
      query += 'genesys_message_id = $1';
      params = [genesys_message_id];
    } else {
      throw new Error('Either wamid or genesys_message_id is required');
    }

    const result = await pool.query<MessageTracking>(query, params);

    if (result.rows.length === 0) {
      logger.warn('Status update for unknown message', {
        operation: 'update_status',
        wamid,
        genesys_message_id,
        new_status
      });
      return { updated: false };
    }

    const message = result.rows[0];
    const current_status = message.status as MessageStatus;

    // 2. Validate state transition
    if (!isValidStateTransition(current_status, new_status)) {
      logger.warn('Invalid state transition', {
        operation: 'update_status',
        wamid,
        current_status,
        new_status,
        valid_transitions: require('../types').MESSAGE_STATE_TRANSITIONS[current_status]
      });
      return { updated: false, previous_status: current_status };
    }

    // 3. Check timestamp (prevent stale updates)
    if (new Date(timestamp) <= new Date(message.updated_at)) {
      logger.info('Ignoring stale status update', {
        operation: 'update_status',
        wamid,
        event_timestamp: timestamp,
        current_timestamp: message.updated_at
      });
      return { updated: false, previous_status: current_status };
    }

    // 4. Optimistic locking update
    const updateResult = await pool.query(
      `UPDATE message_tracking
       SET status = $1, updated_at = $2
       WHERE id = $3 AND status = $4
       RETURNING *`,
      [new_status, timestamp, message.id, current_status]
    );

    if (updateResult.rows.length === 0) {
      logger.info('Status already updated (race condition)', {
        operation: 'update_status',
        wamid,
        message_id: message.id
      });
      return { updated: false, previous_status: current_status };
    }

    logger.info('Message status updated successfully', {
      operation: 'update_status',
      wamid,
      message_id: message.id,
      previous_status: current_status,
      new_status
    });

    return { updated: true, previous_status: current_status };
  }

  // ==================== Legacy Methods ====================

  async getMessagesByConversation(conversationId: string, limit = 50, offset = 0) {
    // Find mapping_id first
    const mappingResult = await pool.query(
      'SELECT id FROM conversation_mappings WHERE conversation_id = $1',
      [conversationId]
    );

    if (mappingResult.rows.length === 0) {
      return { messages: [], total: 0, limit, offset };
    }

    const mapping_id = mappingResult.rows[0].id;

    const result = await pool.query(
      `SELECT * FROM message_tracking 
       WHERE mapping_id = $1 
       ORDER BY created_at ASC 
       LIMIT $2 OFFSET $3`,
      [mapping_id, limit, offset]
    );

    const messages = result.rows.map((row: any) => ({
      id: row.wamid || row.genesys_message_id,
      direction: row.direction,
      status: row.status,
      timestamp: row.created_at,
      delivered_at: row.delivered_at,
      media_url: row.media_url
    }));

    return {
      messages,
      total: result.rowCount || 0,
      limit,
      offset
    };
  }
}

export default new MessageService();
```

---

### 3. Create Operation Handlers `src/services/operationHandlers.ts`

**New file**: Wire RabbitMQ consumers to business logic

```typescript
// src/services/operationHandlers.ts

import mappingService from './mappingService';
import messageService from './messageService';
import lockService from './lockService';
import { rabbitmqService } from './rabbitmq.service';
import logger from '../utils/logger';
import { 
  InboundMessage, 
  OutboundMessage, 
  StatusUpdate,
  EnrichedInboundMessage,
  EnrichedOutboundMessage,
  MessageDirection,
  MessageStatus,
  DLQReason,
  ConversationStatus
} from '../types';

// ==================== Operation 1: Inbound Identity Resolution ====================

export async function handleInboundMessage(msg: InboundMessage): Promise<void> {
  const startTime = Date.now();
  const { wa_id, wamid, contact_name, phone_number_id, display_phone_number, media_url } = msg;

  logger.info('Processing inbound message', {
    operation: 'inbound_identity_resolution',
    wa_id,
    wamid
  });

  try {
    // 1. Acquire distributed lock
    const lockAcquired = await lockService.withLockRetry(wa_id);
    if (!lockAcquired) {
      logger.error('Failed to acquire lock', {
        operation: 'inbound_identity_resolution',
        wa_id,
        wamid
      });
      await rabbitmqService.sendToDLQ(msg, DLQReason.LOCK_TIMEOUT, 'Failed to acquire lock after retries');
      return;
    }

    try {
      // 2. Create or update mapping
      const { mapping, isNew } = await mappingService.createMappingForInbound({
        wa_id,
        wamid,
        contact_name,
        phone_number_id,
        display_phone_number
      });

      // 3. Track inbound message (idempotent)
      await messageService.trackMessage({
        mapping_id: mapping.id,
        wamid,
        direction: MessageDirection.INBOUND,
        status: MessageStatus.RECEIVED,
        media_url
      });

      // 4. Publish to inbound-processed queue
      const enrichedMessage: EnrichedInboundMessage = {
        ...msg,
        mapping_id: mapping.id,
        conversation_id: mapping.conversation_id,
        is_new_conversation: isNew && !mapping.conversation_id
      };

      await rabbitmqService.publishToInboundProcessed(enrichedMessage);

      logger.info('Inbound message processed successfully', {
        operation: 'inbound_identity_resolution',
        wa_id,
        wamid,
        mapping_id: mapping.id,
        conversation_id: mapping.conversation_id,
        is_new: isNew,
        duration_ms: Date.now() - startTime
      });

    } finally {
      // 5. Release lock
      await lockService.releaseLock(wa_id);
    }

  } catch (error: any) {
    logger.error('Inbound processing failed', {
      operation: 'inbound_identity_resolution',
      wa_id,
      wamid,
      error: error.message,
      stack: error.stack
    });
    throw error; // RabbitMQ will requeue
  }
}

// ==================== Operation 2: Outbound Identity Resolution ====================

export async function handleOutboundMessage(msg: OutboundMessage): Promise<void> {
  const startTime = Date.now();
  const { conversation_id, genesys_message_id, message_text, media_url } = msg;

  logger.info('Processing outbound message', {
    operation: 'outbound_identity_resolution',
    conversation_id,
    genesys_message_id
  });

  try {
    // 1. Lookup mapping by conversation_id
    const mapping = await mappingService.getMappingByConversationId(conversation_id);

    if (!mapping) {
      logger.error('No active mapping found', {
        operation: 'outbound_identity_resolution',
        conversation_id
      });
      await rabbitmqService.sendToDLQ(
        msg, 
        DLQReason.MAPPING_NOT_FOUND, 
        `No active mapping for conversation_id=${conversation_id}`
      );
      return;
    }

    // 2. Validate mapping status
    if (mapping.status !== ConversationStatus.ACTIVE) {
      logger.warn('Mapping not active', {
        operation: 'outbound_identity_resolution',
        conversation_id,
        status: mapping.status
      });
      await rabbitmqService.sendToDLQ(
        msg, 
        mapping.status === ConversationStatus.EXPIRED 
          ? DLQReason.MAPPING_STATUS_EXPIRED 
          : DLQReason.MAPPING_STATUS_CLOSED,
        `Mapping status is ${mapping.status}`
      );
      return;
    }

    // 3. Track outbound message
    await messageService.trackMessage({
      mapping_id: mapping.id,
      genesys_message_id,
      direction: MessageDirection.OUTBOUND,
      status: MessageStatus.QUEUED,
      media_url
    });

    // 4. Update activity timestamp
    await mappingService.updateActivity(mapping.id, genesys_message_id);

    // 5. Publish to outbound-processed queue
    const enrichedMessage: EnrichedOutboundMessage = {
      ...msg,
      wa_id: mapping.wa_id,
      mapping_id: mapping.id
    };

    await rabbitmqService.publishToOutboundProcessed(enrichedMessage);

    logger.info('Outbound message processed successfully', {
      operation: 'outbound_identity_resolution',
      conversation_id,
      genesys_message_id,
      wa_id: mapping.wa_id,
      mapping_id: mapping.id,
      duration_ms: Date.now() - startTime
    });

  } catch (error: any) {
    logger.error('Outbound processing failed', {
      operation: 'outbound_identity_resolution',
      conversation_id,
      genesys_message_id,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// ==================== Operation 3: Status Update from WhatsApp ====================

export async function handleStatusUpdate(msg: StatusUpdate): Promise<void> {
  const { wamid, status, timestamp } = msg;

  logger.debug('Processing status update', {
    operation: 'status_update',
    wamid,
    status
  });

  try {
    const result = await messageService.updateStatus({
      wamid,
      new_status: status,
      timestamp: new Date(timestamp)
    });

    if (result.updated) {
      logger.info('Status updated', {
        operation: 'status_update',
        wamid,
        previous_status: result.previous_status,
        new_status: status
      });
    } else {
      logger.debug('Status not updated', {
        operation: 'status_update',
        wamid,
        status,
        reason: 'invalid_transition_or_stale'
      });
    }

  } catch (error: any) {
    logger.error('Status update failed', {
      operation: 'status_update',
      wamid,
      status,
      error: error.message
    });
    throw error;
  }
}

// ==================== Register All Consumers ====================

export async function registerOperationHandlers(): Promise<void> {
  logger.info('Registering operation handlers...');
  
  await rabbitmqService.consumeInbound(handleInboundMessage);
  await rabbitmqService.consumeOutbound(handleOutboundMessage);
  await rabbitmqService.consumeStatus(handleStatusUpdate);

  logger.info('✓ All operation handlers registered', {
    handlers: ['inbound', 'outbound', 'status']
  });
}
```

---

### 4. Wire Handlers in `src/index.ts`

**Modify lines 11-12 to:**

```typescript
// src/index.ts
import express from 'express';
import initDatabase from './utils/dbInit';
import routes from './routes/index';
import statsController from './controllers/statsController';
import { initializeRabbitMQ } from './services/rabbitmq.service';
import { registerOperationHandlers } from './services/operationHandlers';

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

// Initialize database
initDatabase();

// Health check (no auth required)
app.get('/health', statsController.healthCheck);

// Mount routes
app.use('/state', routes);

// Initialize RabbitMQ and operation handlers
(async () => {
  try {
    await initializeRabbitMQ();
    console.log('✓ RabbitMQ connection established');
    
    await registerOperationHandlers();
    console.log('✓ Operation handlers registered');
  } catch (error) {
    console.error('Failed to initialize RabbitMQ:', error);
    process.exit(1);
  }
})();

app.listen(PORT, () => {
  console.log(`State Manager running on port ${PORT}`);
});
```

---

## Verification

### 1. Test Inbound Flow

**Publish test message to RabbitMQ:**

```bash
# Using RabbitMQ management UI or CLI
curl -X POST http://localhost:15672/api/exchanges/%2F/amq.default/publish \
  -u guest:guest \
  -H "content-type:application/json" \
  -d '{
    "properties":{},
    "routing_key":"inboundQueue",
    "payload":"{\"wa_id\":\"919876543210\",\"wamid\":\"wamid.test123\",\"contact_name\":\"Test User\",\"timestamp\":\"2026-02-12T06:00:00Z\"}",
    "payload_encoding":"string"
  }'
```

**Expected logs:**
```json
{"timestamp":"...","level":"INFO","service":"state-manager","message":"Processing inbound message","operation":"inbound_identity_resolution","wa_id":"919876543210","wamid":"wamid.test123"}
{"timestamp":"...","level":"DEBUG","service":"state-manager","message":"Lock acquired","wa_id":"919876543210","lockKey":"lock:mapping:919876543210","ttl":5}
{"timestamp":"...","level":"INFO","service":"state-manager","message":"New mapping created","operation":"create_mapping_inbound","wa_id":"919876543210","mapping_id":"...","is_new":true}
{"timestamp":"...","level":"INFO","service":"state-manager","message":"Message tracked","operation":"track_message","wamid":"wamid.test123","direction":"INBOUND","status":"received"}
{"timestamp":"...","level":"INFO","service":"state-manager","message":"Inbound message processed successfully","duration_ms":...}
```

### 2. Test State Machine

```typescript
import { isValidStateTransition, MessageStatus } from './types';

// Valid transitions
console.log(isValidStateTransition(MessageStatus.QUEUED, MessageStatus.SENT)); // true
console.log(isValidStateTransition(MessageStatus.SENT, MessageStatus.DELIVERED)); // true
console.log(isValidStateTransition(MessageStatus.DELIVERED, MessageStatus.READ)); // true

// Invalid transitions
console.log(isValidStateTransition(MessageStatus.DELIVERED, MessageStatus.SENT)); // false
console.log(isValidStateTransition(MessageStatus.QUEUED, MessageStatus.READ)); // false

// Idempotent
console.log(isValidStateTransition(MessageStatus.SENT, MessageStatus.SENT)); // true
```

### 3. Test Idempotency

Send the same message twice:

```bash
# First time - creates new record
curl ... # same as above

# Second time - ON CONFLICT DO NOTHING
curl ... # same wamid
```

**Expected**: Second attempt logs "Duplicate wamid, message already tracked"

### 4. Database Verification

```sql
-- Check mappings
SELECT id, wa_id, conversation_id, last_message_id, status 
FROM conversation_mappings;

-- Check messages
SELECT id, wamid, direction, status, created_at 
FROM message_tracking;

-- Verify FK relationship
SELECT cm.wa_id, mt.wamid, mt.direction, mt.status
FROM conversation_mappings cm
JOIN message_tracking mt ON mt.mapping_id = cm.id;
```

---

## Next Steps

Proceed to:
- **04-api-lifecycle.md** (Correlation endpoint, enhanced health check, expiry cron)
