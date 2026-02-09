# State Manager Service - Implementation Plan

## Goal

Build a comprehensive state management system to track conversations, customers, messages, and session context across WhatsApp and Genesys platforms with multi-tenant isolation, real-time synchronization, and analytics capabilities.

## Phased Implementation

### Phase 1: Conversation Mapping (Priority: CRITICAL)
**Duration**: 2 weeks

#### 1.1 Conversation Models & Database Schema
- **Files**:
  - `src/models/Conversation.ts` - Conversation entity
  - `migrations/001_create_conversations.ts` - Database migration
  - `src/repositories/conversationRepository.ts` - Data access layer

- **Schema**:
```typescript
// conversations table
{
  id: uuid,
  tenant_id: uuid,
  whatsapp_conversation_id: string,
  genesys_conversation_id: string,
  customer_id: uuid,
  agent_id: uuid,
  state: enum('active', 'closed', 'waiting', 'error'),
  created_at: timestamp,
  closed_at: timestamp,
  last_activity: timestamp,
  metadata: jsonb
}
```

#### 1.2 Conversation Lifecycle Management
- **Files**:
  - `src/services/conversationService.ts` - Business logic
  - `src/controllers/conversation.controller.ts` - API endpoints
  - `src/routes/conversation.routes.ts` - Route definitions

- **Implementation**:
  - Create conversation on first WhatsApp message
  - Map WhatsApp ID to Genesys conversation ID
  - Update conversation state on events
  - Handle conversation closure and cleanup
  - Support conversation transfer between agents

---

### Phase 2: Customer Information Management (Priority: HIGH)
**Duration**: 1.5 weeks

#### 2.1 Customer Profile Storage
- **Files**:
  - `src/models/Customer.ts` - Customer entity
  - `migrations/002_create_customers.ts` - Database migration
  - `src/repositories/customerRepository.ts` - Data access layer

- **Schema**:
```typescript
// customers table
{
  id: uuid,
  tenant_id: uuid,
  whatsapp_id: string (unique per tenant),
  phone_number: string,
  name: string,
  profile_picture_url: string,
  preferences: jsonb,
  metadata: jsonb,
  created_at: timestamp,
  updated_at: timestamp
}
```

#### 2.2 Customer Service Implementation
- **Files**:
  - `src/services/customerService.ts` - Customer operations
  - `src/controllers/customer.controller.ts` - API endpoints

- **Implementation**:
  - Create or update customer profiles
  - Phone number validation and formatting
  - Customer search and lookup
  - Integration history tracking
  - Customer context retrieval for agents

---

### Phase 3: Message State Tracking (Priority: HIGH)
**Duration**: 2 weeks

#### 3.1 Message Tracking Models
- **Files**:
  - `src/models/Message.ts` - Message entity
  - `migrations/003_create_messages.ts` - Database migration

- **Schema**:
```typescript
// messages table
{
  id: uuid,
  conversation_id: uuid,
  whatsapp_message_id: string,
  genesys_message_id: string,
  direction: enum('inbound', 'outbound'),
  status: enum('sent', 'delivered', 'read', 'failed'),
  content: text,
  media_urls: jsonb,
  sent_at: timestamp,
  delivered_at: timestamp,
  read_at: timestamp,
  error_message: text
}
```

#### 3.2 Message Tracking Service
- **Files**:
  - `src/services/messageTrackingService.ts` - Message status updates
  - `src/controllers/message.controller.ts` - API endpoints

- **Implementation**:
  - Store message ID mappings
  - Track delivery confirmations
  - Update read receipts
  - Handle message failures and retries

---

### Phase 4: Redis Caching Strategy (Priority: HIGH)
**Duration**: 1 week

#### 4.1 Cache Layer Implementation
- **Files**:
  - `src/services/cacheService.ts` - Redis operations
  - `src/config/redis.config.ts` - Redis configuration
  - `src/utils/cacheKeys.ts` - Cache key management

- **Implementation**:
  - Cache active conversations (TTL: 24h)
  - Cache customer profiles (TTL: 1h)
  - Cache conversation-to-ID mappings (TTL: 24h)
  - Implement cache warming on service startup
  - Add cache invalidation on updates

#### 4.2 Cache Coordination
- **Files**:
  - `src/services/cacheInvalidation.ts` - Invalidation logic

- **Implementation**:
  - Publish cache invalidation events
  - Support distributed cache updates
  - Add cache hit/miss metrics

---

### Phase 5: Multi-tenant Data Isolation (Priority: CRITICAL)
**Duration**: 1 week

#### 5.1 Tenant-scoped Queries
- **Files**:
  - `src/middleware/tenantContext.ts` - Tenant context injection
  - `src/repositories/baseTenantRepository.ts` - Base repository with tenant filtering

- **Implementation**:
  - Add tenant_id to all WHERE clauses automatically
  - Implement Row-Level Security (RLS) in PostgreSQL
  - Create tenant-specific database indexes
  - Add tenant validation on all API calls

#### 5.2 Data Retention Policies
- **Files**:
  - `src/jobs/dataRetentionJob.ts` - Scheduled cleanup
  - `src/services/dataRetentionService.ts` - Retention logic

- **Implementation**:
  - Configure retention periods per tenant
  - Archive old conversations and messages
  - Implement GDPR-compliant data deletion

---

### Phase 6: Real-time State Synchronization (Priority: MEDIUM)
**Duration**: 2 weeks

#### 6.1 WebSocket Integration
- **Files**:
  - `src/websocket/stateSocket.ts` - WebSocket server
  - `src/services/statePublisher.ts` - State change publisher

- **Implementation**:
  - Implement Socket.IO or native WebSocket
  - Broadcast conversation state changes
  - Emit message status updates
  - Support room-based subscriptions (per conversation)

#### 6.2 Event-driven Updates
- **Files**:
  - `src/events/stateEvents.ts` - Event definitions
  - `src/services/eventBus.ts` - Internal event bus

- **Implementation**:
  - Emit events on state changes
  - Support event subscriptions from other services
  - Implement event replay for missed updates

---

### Phase 7: Analytics & Reporting (Priority: LOW)
**Duration**: 1.5 weeks

#### 7.1 Metrics Collection
- **Files**:
  - `src/services/analyticsService.ts` - Analytics logic
  - `src/models/ConversationMetrics.ts` - Metrics model

- **Implementation**:
  - Track conversation duration
  - Calculate average response time
  - Count messages per conversation
  - Monitor agent performance

#### 7.2 Reporting Endpoints
- **Files**:
  - `src/controllers/analytics.controller.ts` - Analytics APIs

- **Implementation**:
  - Conversation volume reports
  - Customer engagement metrics
  - Agent performance dashboards
  - Real-time system health metrics

---

### Phase 8: Service Integrations (Priority: HIGH)
**Duration**: 2 weeks

#### 8.1 Inbound Transformer Integration
- **Files**:
  - `src/integrations/inboundTransformer.ts` - Integration client

- **Implementation**:
  - Provide conversation lookup API
  - Create new conversations on first message
  - Return customer context to transformer

#### 8.2 Outbound Transformer Integration
- **Files**:
  - `src/integrations/outboundTransformer.ts` - Integration client

- **Implementation**:
  - Provide WhatsApp ID lookup
  - Update message tracking on sends

#### 8.3 Agent Portal Integration
- **Files**:
  - `src/integrations/agentPortal.ts` - Integration client

- **Implementation**:
  - Provide conversation history API
  - Emit real-time updates via WebSocket
  - Support conversation search

---

## Database Migrations

```bash
# Create migrations
npm run typeorm migration:create -- -n CreateConversations
npm run typeorm migration:create -- -n CreateCustomers
npm run typeorm migration:create -- -n CreateMessages

# Run migrations
npm run typeorm migration:run

# Rollback
npm run typeorm migration:revert
```

---

## Dependencies

```json
{
  "typeorm": "^0.3.17",
  "pg": "^8.11.3",
  "ioredis": "^5.3.2",
  "socket.io": "^4.6.1",
  "libphonenumber-js": "^1.10.44"
}
```

**External Services**:
- PostgreSQL for persistent storage
- Redis for caching
- RabbitMQ for event publishing

---

## Verification Plan

### Unit Tests
- Conversation mapping creation and lookup
- Customer profile CRUD operations
- Message status tracking
- Cache invalidation logic
- Tenant isolation queries

### Integration Tests
- Full conversation lifecycle (create → active → closed)
- Multi-tenant data isolation verification
- WebSocket event delivery
- Cache hit/miss scenarios
- Database transaction rollbacks

### Performance Tests
```bash
# Load test for conversation creation
k6 run tests/load/conversation-creation.js

# Cache performance test
k6 run tests/load/cache-performance.js
```

**Targets**:
- Create conversation: <100ms (p95)
- Lookup conversation: <10ms (p95, cached)
- Message tracking: <50ms (p95)

### Manual Verification
1. Create conversation via API
2. Verify PostgreSQL record created
3. Verify Redis cache entry created
4. Update conversation state
5. Verify WebSocket event emitted
6. Test from different tenants (verify isolation)

---

## Rollback Strategy
- Database migrations are reversible
- Redis cache can be flushed without data loss
- Feature flags for WebSocket functionality
- Archive critical data before cleanup jobs
