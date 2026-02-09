# Pending Tasks - MVP Implementation Gap Analysis

## Summary
Based on analysis of the current codebase (as of 2026-02-05), this document identifies what's implemented and what remains for the MVP demo.

---

## Legend
- ✅ **Implemented** - Code exists and appears functional
- 🟡 **Partially Implemented** - Basic structure exists, needs MVP-specific enhancements
- ❌ **Not Implemented** - Needs to be created from scratch

---

## Phase 1: Infrastructure & Database Setup

### PostgreSQL Database
- ❌ Create `tenants` table
- ❌ Create `tenant_credentials` table  
- ❌ Create `conversation_mappings` table
- ❌ Create `message_tracking` table
- ❌ Add indexes for performance optimization
- ❌ Seed demo tenant data

### Redis Configuration
- ✅ Redis client setup exists (auth-service uses it)
- 🟡 Document Redis key structure (partially implemented)

### MinIO Buckets
- ✅ `whatsapp-media` bucket configured (in whatsapp-webhook-service)
- ❌ Create `webhooks-inbound` bucket
- ❌ Create `webhooks-outbound` bucket
- ❌ Rename/refactor `whatsapp-media` to `media-inbound`
- ❌ Create `media-outbound` bucket

### RabbitMQ Queues
- ✅ `INBOUND_WHATSAPP_MESSAGES` queue (inbound-transformer has consumer)
- ✅ `OUTBOUND_GENESYS_MESSAGES` queue (6 services have amqplib dependency)
- ❌ Verify both queues created on startup
- ❌ Document queue configuration

---

## Phase 2: Core Services

### 1. Tenant Service ✅ (90% Complete)

**Implemented:**
- ✅ `POST /tenants` - Create tenant
- ✅ `GET /tenants/:id` - Get tenant by ID
- ✅ `PUT /:tenantId/genesys/credentials` - Set Genesys credentials
- ✅ `GET /:tenantId/genesys/credentials` - Get Genesys credentials
- ✅ `POST /:tenantId/complete-onboarding` - Complete onboarding
- ✅ Redis caching for tenant lookup

**Pending:**
- 🟡 Add endpoint: `GET /tenants/:id/credentials?type=whatsapp`
  - Currently only has Genesys-specific endpoints
  - Need generic credentials endpoint supporting both types
- ❌ Implement phone_number_id → tenant_id resolution (for webhook)
- ❌ Implement genesys_integration_id → tenant_id resolution
- ❌ Add Redis caching for phone_number_id and integration_id lookups

---

### 2. Auth Service ✅ (85% Complete)

**Implemented:**
- ✅ `GET /auth/token` - Get OAuth token (Genesys)
- ✅ Redis token caching with TTL (3300s Genesys)
- ✅ Integration with tenant-service for credentials
- ✅ Token expiry buffer (5min) logic
- ✅ OAuth authorization code flow

**Pending:**
- ❌ Support WhatsApp token retrieval
  - Currently only handles Genesys OAuth
  - Need to support `X-Credential-Type: whatsapp` header
- ❌ WhatsApp token caching (24h TTL)
- ❌ Update to call generic credentials endpoint

---

### 3. State Manager 🟡 (40% Complete)

**Implemented:**
- ✅ Basic server structure with TypeScript
- ✅ Controllers and routes directories exist

**Pending:**
- ❌ `GET /state/mapping/:waId` - Forward mapping (wa_id → conversation_id)
  - Redis cache check
  - PostgreSQL query fallback
  - Create new mapping if not exists
  - Bidirectional cache update
- ❌ `GET /state/conversation/:conversationId` - Reverse mapping
  - Redis cache check
  - PostgreSQL query fallback
  - Return wa_id and tenant_id
- ❌ `POST /state/message` - Track message
  - Insert into message_tracking table
  - Include media_type and media_url fields
- ❌ `PATCH /state/message/:messageId` - Update message status
  - Update status (sent/delivered/read)
  - Update timestamps

---

### 4. WhatsApp Webhook Service ✅ (80% Complete)

**Implemented:**
- ✅ `GET /webhook/meta` - Verification endpoint
- ✅ `POST /webhook/meta` - Receive webhooks
- ✅ Tenant resolution via phone_number_id
- ✅ **Media download from Meta Graph API**
- ✅ **MinIO storage for media**
- ✅ RabbitMQ publishing
- ✅ Message extraction utilities

**Pending:**
- ❌ Store raw webhook payload to MinIO (`webhooks-inbound` bucket)
  - Currently only stores media, not the full webhook JSON
- 🟡 Verify tenant resolution uses Redis cache
- 🟡 Ensure presigned URL generation (1 hour expiry)
- ❌ Add media type to RabbitMQ payload (mediaType, mimeType)

---

### 5. Inbound Transformer ✅ (70% Complete)

**Implemented:**
- ✅ RabbitMQ consumer setup
- ✅ Consumer connected to `INBOUND_WHATSAPP_MESSAGES` queue
- ✅ Basic transformer service structure

**Pending:**
- ❌ Call State Manager: `GET /state/mapping/:waId`
- ❌ Transform WhatsApp text → Genesys Text format
- ❌ **Transform WhatsApp media → Genesys Structured/Attachment format**
  - Build `content` array with `Attachment` contentType
  - Include presigned mediaUrl
  - Map media types (image/document/video)
- ❌ Call Genesys API Service: `POST /genesys/messages/inbound`
- ❌ Call State Manager: `POST /state/message` (tracking)

---

### 6. Genesys API Service ✅ (60% Complete)

**Implemented:**
- ✅ TypeScript service structure
- ✅ Routes and controllers setup

**Pending:**
- ❌ `POST /genesys/messages/inbound` endpoint
  - Get OAuth token via Auth Service (with caching)
  - Build Genesys Open Messaging payload
  - POST to Genesys Cloud API
  - Return delivery status
- ❌ Handle text messages
- ❌ **Handle media messages (Structured type with attachments)**
- ❌ Implement error handling and retry logic

---

### 7. Genesys Webhook Service ✅ (60% Complete)

**Implemented:**
- ✅ TypeScript service structure
- ✅ Routes and middleware setup

**Pending:**
- ❌ `POST /webhook/genesys` endpoint
  - Validate webhook (optional for MVP)
  - Resolve tenant by genesys_integration_id
  - **Store raw webhook to MinIO (`webhooks-outbound`)**
  - **Detect Structured messages with attachments**
  - Publish to RabbitMQ `OUTBOUND_GENESYS_MESSAGES`
  - Return 200 OK immediately
- ❌ `GET /webhook/genesys` verification endpoint

---

### 8. Outbound Transformer ✅ (70% Complete)

**Implemented:**
- ✅ RabbitMQ consumer setup (amqplib dependency)
- ✅ Service structure with TypeScript
- ✅ State service integration
- ✅ Message processor service

**Pending:**
- ❌ Consume from `OUTBOUND_GENESYS_MESSAGES` queue
- ❌ Call State Manager: `GET /state/conversation/:conversationId`(reverse lookup)
- ❌ **Media download from Genesys**
  - Download media from Genesys URL with OAuth token
  - Determine media type (image/document/video)
  - Store to MinIO `media-outbound`
  - Generate presigned URL (24h expiry)
- ❌ Transform Genesys → WhatsApp format
  - Text messages
  - **Media messages (image/document/video payloads)**
- ❌ Call WhatsApp API Service: `POST /whatsapp/send`
- ❌ Call State Manager: `POST /state/message` (tracking)

---

### 9. WhatsApp API Service 🟡 (50% Complete)

**Implemented:**
- ✅ Basic service structure
- ✅ Controllers and routes directories

**Pending:**
- ❌ `POST /whatsapp/send` endpoint
  - Get WhatsApp token via Auth Service (with Redis cache)
  - Build Meta WhatsApp Cloud API payload
  - **Support multiple message types:**
    - Text messages
    - Image messages
    - Document messages
    - Video messages
  - POST to `https://graph.facebook.com/v18.0/{phone_number_id}/messages`
  - Return `wamid` and status

---

### 10. API Gateway ✅ (80% Complete)

**Implemented:**
- ✅ Express server with routing
- ✅ Middleware structure
- ✅ Basic configuration

**Pending:**
- 🟡 Verify routing configuration:
  - `/webhook/meta/*` → WhatsApp Webhook Service
  - `/webhook/genesys/*` → Genesys Webhook Service
  - `/api/tenants/*` → Tenant Service
- ❌ Add request logging middleware
- ❌ CORS configuration
- ❌ Basic error handling

---

## Phase 3: Customer Portal (Agent Portal) - MVP Features

### Authentication
- ❌ Implement basic login page (hardcoded demo credentials)
- ❌ Create protected route wrapper
- ❌ Implement session management

### Onboarding Flow
- ✅ Basic onboarding structure exists
- ❌ Complete onboarding wizard with 5 steps:
  1. Welcome screen
  2. Organization details form
  3. Genesys credentials input
  4. WhatsApp credentials input
  5. Review and submit
- ❌ API integration with Tenant Service
- 🟡 Complete onboarding endpoint exists, needs frontend integration

### Dashboard (Basic)
- ❌ Display total conversations count
- ❌ Display message volume (today)
- ❌ Show recent conversations list
- ❌ Connect to State Manager for data

---

## Phase 4: Environment Configuration

### Service-Specific .env Files
- 🟡 Most services have `.env.example` files
- ❌ Verify all required variables documented:
  - Database connection strings
  - Redis connection
  - MinIO credentials (endpoint, access key, secret key)
  - RabbitMQ connection
  - Genesys OAuth credentials
  - WhatsApp API credentials
  - Service ports
  - Service URLs (for inter-service communication)

---

## Phase 5: Integration Testing

### Infrastructure Tests
- ❌ PostgreSQL tables created and accessible
- ❌ Redis connection successful (from all services)
- ❌ MinIO buckets created
- ❌ RabbitMQ queues created

### Inbound Flow Test
- ❌ Send test WhatsApp text message
- ❌ **Send test WhatsApp image**
- ❌ Verify webhook received
- ❌ Verify raw payload in MinIO
- ❌ **Verify media file in MinIO**
- ❌ Verify message in RabbitMQ queue
- ❌ Verify conversation mapping created
- ❌ Verify message sent to Genesys
- ❌ **Verify media accessible in Genesys**
- ❌ Verify message tracking in DB

### Outbound Flow Test
- ❌ Trigger Genesys text message
- ❌ **Trigger Genesys message with document**
- ❌ Verify webhook received
- ❌ Verify raw payload in MinIO
- ❌ **Verify media downloaded from Genesys**
- ❌ Verify message in RabbitMQ queue
- ❌ Verify reverse mapping resolved
- ❌ Verify message sent to WhatsApp
- ❌ **Verify Meta downloads media**
- ❌ Verify message tracking in DB

### End-to-End Test
- ❌ Customer sends WhatsApp text → Agent receives
- ❌ **Customer sends WhatsApp image → Agent views**
- ❌ Agent replies text → Customer receives
- ❌ **Agent sends document → Customer receives**

---

## Phase 6: Documentation

- ❌ Create README for each service with:
  - Service purpose
  - Environment variables
  - Running instructions
  - API endpoints
- ❌ Create root README with:
  - Architecture overview diagram
  - Setup instructions
  - Demo walkthrough steps
- ❌ Document test tenant credentials
- ❌ Create demo script for presentation

---

## Priority Order for Implementation

### Critical Path (Must Have for MVP)
1. **Database setup** - All tables and indexes
2. **State Manager** - All 4 endpoints (mapping, conversation, message tracking)
3. **Genesys API Service** - Inbound message endpoint
4. **WhatsApp API Service** - Send endpoint with media support
5. **Inbound Transformer** - Complete transformation logic with media
6. **Outbound Transformer** - Complete transformation logic with media
7. **Genesys Webhook Service** - Webhook endpoint with media detection
8. **Auth Service** - Add WhatsApp token support
9. **Tenant Service** - Generic credentials endpoint

### Secondary (Important for Demo)
10. **API Gateway** - Verify routing configuration
11. **Customer Portal** - Basic onboarding flow
12. **MinIO** - Create remaining buckets
13. **Environment Configuration** - Complete .env files
14. **Testing** - End-to-end smoke tests

### Tertiary (Nice to Have)
15. **Documentation** - READMEs and demo script
16. **Portal Dashboard** - Basic metrics display

---

## Estimated Task Count

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ Implemented | ~35 | 30% |
| 🟡 Partially Implemented | ~15 | 13% |
| ❌ Pending | ~65 | 57% |
| **Total** | **~115** | **100%** |

---

## Quick Start Checklist

To get MVP running, focus on completing these in order:

1. [ ] Set up PostgreSQL with 4 tables
2. [ ] Implement State Manager (4 endpoints)
3. [ ] Complete Inbound Transformer (call State Manager, transform, call Genesys API)
4. [ ] Complete Genesys API Service (send messages endpoint)
5. [ ] Complete Outbound Transformer (call State Manager, transform, call WhatsApp API)
6. [ ] Complete WhatsApp API Service (send messages with media)
7. [ ] Complete Genesys Webhook Service (receive and queue messages)
8. [ ] Add WhatsApp token support to Auth Service
9. [ ] Test end-to-end flows (text + media)
10. [ ] Polish customer portal onboarding

**Estimated completion time:** 3-4 weeks for core functionality
