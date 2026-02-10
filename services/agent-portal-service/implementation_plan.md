# Agent Portal Service (Backend) - Implementation Plan

## Goal

Build a comprehensive backend API for the agent portal that manages conversations, messages, real-time synchronization, template management, and customer information with multi-tenant data isolation.

## Phased Implementation

### Phase 1: Conversation Management APIs (Priority: CRITICAL)
**Duration**: 2 weeks

#### 1.1 Conversation CRUD Operations
- **Files**:
  - `src/controllers/conversation.controller.ts` - API endpoints
  - `src/services/conversationService.ts` - Business logic
  - `src/routes/conversation.routes.ts` - Route definitions

- **Endpoints**:
  - `GET /api/conversations` - List conversations (paginated, filtered)
  - `GET /api/conversations/:id` - Get conversation details
  - `PATCH /api/conversations/:id` - Update conversation (assign agent, update state)
  - `POST /api/conversations/:id/transfer` - Transfer to another agent
  - `POST /api/conversations/:id/close` - Close conversation

#### 1.2 Conversation Filters & Search
- **Implementation**:
  - Filter by state (active, waiting, closed)
  - Filter by assigned agent
  - Search by customer name/phone
  - Sort by last activity, created date

---

### Phase 2: Message Management (Priority: CRITICAL)
**Duration**: 1.5 weeks

#### 2.1 Message APIs
- **Files**:
  - `src/controllers/message.controller.ts` - Message endpoints
  - `src/services/messageService.ts` - Message logic
  - `src/repositories/messageRepository.ts` - Data access

- **Endpoints**:
  - `GET /api/conversations/:id/messages` - Get message history (paginated)
  - `POST /api/conversations/:id/messages` - Send message
  - `GET /api/messages/:id` - Get message details
  - `PATCH /api/messages/:id/status` - Update message status

#### 2.2 Message Storage
- **Files**:
  - `src/models/Message.ts` - Message model
  - `migrations/xxx_create_messages.ts` - Database migration

- **Implementation**:
  - Store all messages in PostgreSQL
  - Index by conversation_id and created_at
  - Support full-text search
  - Track message status (sent, delivered, read, failed)

---

### Phase 3: Real-time Synchronization (Priority: CRITICAL)
**Duration**: 2 weeks

#### 3.1 Socket.IO Integration
- **Files**:
  - `src/websocket/socket.ts` - Socket.IO server
  - `src/services/socketService.ts` - Socket management
  - `src/middleware/socketAuth.ts` - Socket authentication

- **Events to Emit**:
  - `conversation:new` - New conversation created
  - `conversation:updated` - Conversation state changed
  - `message:new` - New message received
  - `message:status` - Message status updated

#### 3.2 RabbitMQ Consumer
- **Files**:
  - `src/queue/consumer.ts` - RabbitMQ consumer
  - `src/services/messageDispatcher.ts` - Message routing

- **Implementation**:
  - Consume from `agent.notifications` queue
  - Broadcast to connected agents via Socket.IO
  - Support room-based subscriptions (per conversation)
  - Handle agent reconnections

---

### Phase 4: Template Management (Priority: HIGH)
**Duration**: 1 week

#### 4.1 Template APIs
- **Files**:
  - `src/controllers/template.controller.ts` - Template endpoints
  - `src/services/templateService.ts` - Template logic
  - `src/integrations/whatsappAPI.client.ts` - WhatsApp template API

- **Endpoints**:
  - `GET /api/templates` - List available templates
  - `GET /api/templates/:id` - Get template details
  - `POST /api/templates/validate` - Validate template parameters

#### 4.2 Template Caching
- **Implementation**:
  - Cache templates in Redis (TTL: 24h)
  - Sync from WhatsApp Business API
  - Filter by approval status
  - Support template search

---

### Phase 5: Customer Information (Priority: HIGH)
**Duration**: 1 week

#### 5.1 Customer Profile APIs
- **Files**:
  - `src/controllers/customer.controller.ts` - Customer endpoints
  - `src/services/customerService.ts` - Customer logic
  - `src/integrations/stateManager.client.ts` - State manager integration

- **Endpoints**:
  - `GET /api/customers/:id` - Get customer profile
  - `GET /api/customers/:id/history` - Get interaction history
  - `PATCH /api/customers/:id` - Update customer info

---

### Phase 6: Multi-tenant Data Isolation (Priority: CRITICAL)
**Duration**: 1 week

#### 6.1 Tenant Middleware
- **Files**:
  - `src/middleware/tenantContext.ts` - Tenant context
  - `src/repositories/baseTenantRepository.ts` - Base repository

- **Implementation**:
  - Extract tenant from JWT token
  - Add tenant_id to all database queries
  - Implement Row-Level Security (RLS)
  - Verify agent belongs to tenant

---

### Phase 7: Integration with Core Services (Priority: HIGH)
**Duration**: 1 week

#### 7.1 Service Integrations
- **Files**:
  - `src/integrations/stateManager.client.ts` - State manager
  - `src/integrations/transformerService.client.ts` - Message transformation
  - `src/integrations/genesysAPI.client.ts` - Genesys API

- **Implementation**:
  - Fetch conversations from state-manager
  - Send messages via outbound-transformer
  - Update conversation state
  - Handle service errors gracefully

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "socket.io": "^4.6.1",
  "typeorm": "^0.3.17",
  "pg": "^8.11.3",
  "ioredis": "^5.3.2",
  "amqplib": "^0.10.3"
}
```

**External Services**:
- State Manager (conversations, customers, messages)
- Auth Service (JWT validation)
- RabbitMQ (real-time events)
- PostgreSQL (message storage)

---

## Verification Plan

### Unit Tests
- Conversation CRUD operations
- Message filtering and pagination
- Socket.IO event emission
- Tenant isolation logic

### Integration Tests
- End-to-end conversation creation
- Message sending workflow
- Real-time socket events
- Multi-tenant data isolation

### Manual Testing
1. Create conversation → verify in UI
2. Send message → verify socket event emitted
3. Load message history → verify pagination
4. Test from different tenants → verify isolation

**Performance Targets**:
- List conversations: <100ms (p95)
- Load messages: <200ms (p95)
- Socket event delivery: <50ms (p95)

---

## Rollback Strategy
- Feature flags for Socket.IO
- Database migrations are reversible
- No breaking API changes
