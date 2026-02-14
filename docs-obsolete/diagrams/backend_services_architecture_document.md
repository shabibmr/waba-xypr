# Backend Services Architecture

## Overview
This document describes the backend microservices architecture responsible for integrating **WhatsApp Cloud API** and **Genesys Cloud Open Messaging** in a multi-tenant environment. The system is designed for scalability, tenant isolation, resiliency, and asynchronous processing.

Key architectural principles:
- **Multi-tenancy by design** (tenant resolution, isolation, rate limits, credentials)
- **Async, event-driven processing** via queues
- **Centralized auth, state, and tenancy services**
- **Clear separation of inbound vs outbound flows**

---

## High-Level Flow Summary

### Inbound (WhatsApp → Genesys)
1. WhatsApp Cloud sends webhook → WhatsApp Webhook Service
2. Payload validated, tenant resolved, stored in MinIO
3. Event enqueued to RabbitMQ
4. Inbound Transformer formats payload for Genesys
5. State Manager resolves/creates conversation
6. Genesys API Service delivers message to Genesys Cloud

### Outbound (Genesys → WhatsApp)
1. Genesys Cloud sends webhook → Genesys Webhook Service
2. Payload validated, tenant resolved, stored in MinIO
3. Event enqueued to RabbitMQ
4. Outbound Transformer formats payload for WhatsApp
5. State Manager resolves conversation & media URLs
6. WhatsApp API Service delivers message to WhatsApp Cloud

---

## Core Backend Services

### 1. WhatsApp Webhook Service
**Purpose:** Entry point for all inbound WhatsApp messages.

**Functions:**
- Receives webhook events from WhatsApp Cloud API
- Validates webhook signatures (Meta)
- Resolves tenant (Redis cache → Tenancy Service fallback)
- Persists raw payloads and media to MinIO
- Publishes sanitized payloads to RabbitMQ (async)

**Upstream Dependencies:**
- External: WhatsApp Cloud API (Meta)

**Downstream Dependencies:**
- Redis (tenant cache)
- Tenancy Service
- MinIO
- RabbitMQ → Inbound Transformer

---

### 2. WhatsApp API Service
**Purpose:** Handles outbound message delivery to WhatsApp.

**Functions:**
- Sends messages to WhatsApp Cloud API
- Retrieves and caches access tokens via Auth Service
- Enforces tenant-specific rate limits
- Implements retries with exponential backoff on 5xx errors
- Logs delivery metrics (tenant-scoped)

**Upstream Dependencies:**
- Outbound Transformer

**Downstream Dependencies:**
- Auth Service
- Redis (rate limiting)
- External: WhatsApp Cloud API

---

### 3. Genesys Webhook Service
**Purpose:** Entry point for outbound messages/events from Genesys.

**Functions:**
- Receives webhook callbacks from Genesys Cloud
- Validates webhook signatures
- Resolves tenant (Redis cache → Tenancy Service fallback)
- Persists raw payloads and media to MinIO
- Publishes sanitized payloads to RabbitMQ (async)

**Upstream Dependencies:**
- External: Genesys Cloud

**Downstream Dependencies:**
- Redis (tenant cache)
- Tenancy Service
- MinIO
- RabbitMQ → Outbound Transformer

---

### 4. Genesys API Service
**Purpose:** Delivers formatted messages to Genesys Cloud.

**Functions:**
- Sends outbound messages via Genesys Open Messaging
- Manages OAuth token lifecycle (via Auth Service)
- Applies tenant-specific rate limiting
- Retries on transient failures
- Logs successful delivery (tenant-scoped)

**Upstream Dependencies:**
- Inbound Transformer
- Portal Backend Service / API Gateway (agent-initiated flows)

**Downstream Dependencies:**
- Auth Service
- Redis (rate limiting)
- External: Genesys Cloud

---

### 5. Auth Service
**Purpose:** Centralized credential and token management.

**Functions:**
- Retrieves tenant-specific credentials from Tenancy Service
- Performs OAuth client-credentials flow (Genesys)
- Caches access tokens with TTL in Redis
- Handles token expiration and refresh

**Upstream Dependencies:**
- WhatsApp API Service
- Genesys API Service

**Downstream Dependencies:**
- Redis (token cache)
- Tenancy Service
- External: Genesys OAuth endpoints

---

### 6. State Management / State Manager
**Purpose:** Conversation lifecycle and state persistence.

**Functions:**
- Resolves or creates tenant-isolated conversation_id
- Maintains WhatsApp ↔ Genesys conversation mappings
- Persists conversation history in PostgreSQL
- Generates signed, time-limited MinIO media URLs
- Provides conversation context to transformers

**Upstream Dependencies:**
- Inbound Transformer
- Outbound Transformer

**Downstream Dependencies:**
- Redis (conversation cache)
- PostgreSQL
- MinIO

---

### 7. Inbound Transformer
**Purpose:** WhatsApp → Genesys payload transformation.

**Functions:**
- Converts WhatsApp inbound messages to Genesys Open Messaging format
- Enriches payload with conversation_id and tenant context
- Attaches signed media URLs
- Applies inbound business rules and sanitization

**Upstream Dependencies:**
- WhatsApp Webhook (via RabbitMQ)

**Downstream Dependencies:**
- State Management
- Redis (rate limiting)
- Genesys API Service

---

### 8. Outbound Transformer
**Purpose:** Genesys → WhatsApp payload transformation.

**Functions:**
- Converts Genesys outbound messages to WhatsApp format
- Handles templates and free-form messages
- Enriches payload with conversation_id and tenant context
- Attaches signed media URLs
- Applies outbound business rules and sanitization

**Upstream Dependencies:**
- Genesys Webhook (via RabbitMQ)

**Downstream Dependencies:**
- State Management
- Redis (rate limiting)
- WhatsApp API Service

---

### 9. Tenancy Service
**Purpose:** Tenant resolution and isolation backbone.

**Functions:**
- Maps identifiers to tenant_id (WhatsApp numbers, Genesys conversation IDs, etc.)
- Provides tenant-specific configuration and credentials
- Enforces tenant boundaries across services

**Upstream Dependencies:**
- WhatsApp Webhook
- Genesys Webhook
- Auth Service

**Downstream Dependencies:**
- None (synchronous data provider)

---

### 10. API Gateway Service
**Purpose:** Unified external entry point.

**Functions:**
- Routes external API requests to backend services
- Enforces authentication and authorization
- Applies rate limiting, validation, CORS, and logging

**Upstream Dependencies:**
- External clients (portals, agent desktops)

**Downstream Dependencies:**
- Portal Backend Service
- Genesys API Service
- Other backend services (as routed)

---

### 11. Portal Backend Service
**Purpose:** Campaign and portal-facing backend.

**Functions:**
- Campaign and scheduler management
- Template management
- Contact and contact list management
- Analytics and reporting APIs
- Integrates with State, Tenancy, and Genesys services

**Upstream Dependencies:**
- API Gateway Service

**Downstream Dependencies:**
- Genesys API Service
- State Management
- Tenancy Service

---

## Infrastructure & Supporting Components

### Redis
**Usage:**
- Tenant resolution cache
- Conversation mappings
- OAuth tokens
- Rate limiting counters

**Used by:** Most backend services

---

### PostgreSQL
**Usage:**
- Persistent conversation history
- Campaign metadata
- Contact and analytics data

**Used by:** State Management

---

### MinIO
**Usage:**
- Tenant-isolated storage for raw payloads and media
- Signed URL generation for secure media access

**Used by:** Webhooks, State Management

---

### RabbitMQ
**Usage:**
- Asynchronous decoupling between webhooks and transformers
- Improves resiliency and throughput

**Flows:**
- WhatsApp Webhook → Inbound Transformer
- Genesys Webhook → Outbound Transformer

---

## Non-Functional Considerations
- **Scalability:** Stateless services, horizontal scaling
- **Resilience:** Retries, backoff, async queues
- **Security:** Signed webhooks, OAuth, tenant isolation
- **Observability:** Tenant-scoped logging and metrics

---

## Conclusion
This architecture provides a robust, scalable, and secure integration layer between WhatsApp and Genesys Cloud, supporting high-volume, multi-tenant conversational messaging with clear separation of concerns and strong operational guarantees.

