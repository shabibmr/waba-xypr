# Combined Functional Requirements Document

_Generated on 2026-02-12 22:30:54 UTC_


--- BEGIN admin-dashboard/admin-dashboard-frd.md ---

Below is a **LLM-optimized, implementation-ready version** of your Admin Dashboard Functional Requirements Document.

This version is structured for:

* Direct code generation
* API scaffolding
* Type-safe contract creation
* Debugging workflows
* Schema validation
* System-level reasoning
* Backend–frontend alignment

No ambiguity. No vague behavior. Everything explicit.

---

# Admin Dashboard – Functional & Backend Specification

Service: `admin-dashboard`
Version: 2.0 (LLM-Optimized for Code Generation & Debugging)
Scope: Internal Super Admin Management Console
Parent System: XYPR Middleware Platform

---

# 1. Purpose

The Admin Dashboard is a **platform-level control plane** for Super Admins.

It provides:

* Full tenant lifecycle control
* System-wide observability
* Cross-tenant debugging tools
* Infrastructure override capabilities
* Compliance audit visibility

This is NOT tenant-scoped.

It operates across the entire multi-tenant system.

---

# 2. User Roles

Only one role is supported:

```
ROLE_SUPER_ADMIN
```

All endpoints must enforce:

```
RBAC: role == SUPER_ADMIN
```

Unauthorized access must return:

```
HTTP 403
{
  "error": "INSUFFICIENT_PRIVILEGES"
}
```

---

# 3. System Context

Admin Dashboard interacts with:

* api-gateway
* tenant-service
* state-manager
* rabbitmq
* redis
* all 13 microservices (/health)
* monitoring service (optional)

---

# 4. Technology Stack

Frontend:

* React (Vite)
* Tailwind CSS
* Role-based route guards
* JWT-based session validation

Backend:

* NGINX static hosting
* All API calls via api-gateway
* JWT validated at gateway

---

# 5. Functional Requirements

---

# 5.1 Tenant Management Console

Requirement ID: REQ-ADMIN-02

## 5.1.1 List Tenants

### Endpoint

```
GET /admin/tenants
```

### Query Params

```
?status=active|suspended
?id=<tenant_id>
?genesys_org_id=<string>
?phone_number_id=<string>
?page=1
?pageSize=25
```

### Response

```
{
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "region": "us-east-1",
      "status": "active",
      "genesys_org_id": "string",
      "phone_number_id": "string",
      "created_at": "ISO_TIMESTAMP"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 240
  }
}
```

### Behavior

* Must be paginated
* Must be indexed in DB on:

  * id
  * status
  * genesys_org_id
  * phone_number_id

---

## 5.1.2 Tenant Detail View

### Endpoint

```
GET /admin/tenants/:id
```

### Response

Sensitive fields must be masked.

```
{
  "id": "uuid",
  "name": "string",
  "region": "us-east-1",
  "status": "active",
  "credentials": {
    "meta_app_secret": "****",
    "genesys_client_secret": "****"
  },
  "created_at": "...",
  "updated_at": "..."
}
```

Secrets must never be returned raw.

---

## 5.1.3 Suspend Tenant

### Endpoint

```
POST /admin/tenants/:id/suspend
```

### Behavior

1. Update tenant status = suspended
2. Invalidate Redis key:

   ```
   tenant:lookup:<tenant_id>
   ```
3. Publish system event:

   ```
   tenant.suspended
   ```
4. Log action in `system_audit_log`

### Response

```
{
  "status": "success"
}
```

---

## 5.1.4 Offboard Tenant (Soft Delete)

### Endpoint

```
DELETE /admin/tenants/:id
```

### Behavior

* Set status = deleted
* Revoke credentials
* Invalidate cache
* Disable webhooks
* Retain audit history

Hard delete is NOT allowed.

---

## 5.1.5 Impersonation (Login As Tenant)

### Endpoint

```
POST /admin/tenants/:id/impersonate
```

### Behavior

* Issue short-lived JWT
* Scope limited to that tenant
* Log impersonation event

Response:

```
{
  "impersonation_token": "JWT",
  "expires_in": 900
}
```

---

# 5.2 System Health Dashboard

Requirement ID: REQ-ADMIN-03

---

## 5.2.1 System Health Aggregate

### Endpoint

```
GET /admin/system/health
```

### Behavior

Parallel fetch:

```
GET /health
```

From:

* whatsapp-webhook
* state-manager
* tenant-service
* transformer
* api-gateway
* etc (all services)

Query RabbitMQ Management API:

* inboundQueue
* outboundQueue
* deadLetterQueue

### Response

```
{
  "services": [
    {
      "name": "state-manager",
      "status": "healthy",
      "latency_ms": 12
    }
  ],
  "queues": [
    {
      "name": "inboundQueue",
      "depth": 42,
      "threshold_exceeded": false
    }
  ],
  "timestamp": "ISO"
}
```

---

### Alert Rule

If queue depth > configured threshold:

```
threshold_exceeded = true
```

Frontend must render warning state.

---

# 5.3 Global Message Trace

Requirement ID: REQ-ADMIN-04

Purpose: Debug "Where is my message?"

---

## 5.3.1 Trace Message

### Endpoint

```
GET /admin/trace/:messageId
```

messageId may be:

* wamid
* genesysId
* wa_id

Service: state-manager

### Logic

1. Query message_tracking table
2. Join conversation_mappings
3. Return full lifecycle

---

### Response

```
{
  "message_id": "...",
  "tenant_id": "...",
  "timeline": [
    {
      "stage": "webhook_ingress",
      "timestamp": "...",
      "status": "received"
    },
    {
      "stage": "state_manager",
      "timestamp": "...",
      "status": "mapped"
    },
    {
      "stage": "transformer",
      "timestamp": "...",
      "status": "processed"
    },
    {
      "stage": "egress_api",
      "timestamp": "...",
      "status": "delivered"
    }
  ]
}
```

Must return ordered by timestamp ascending.

---

# 5.4 Infrastructure Controls

Requirement ID: REQ-ADMIN-05

---

## 5.4.1 Flush Redis Tenant Cache

### Endpoint

```
POST /admin/cache/flush
```

### Behavior

Must support:

```
{
  "pattern": "tenant:*"
}
```

Avoid global FLUSHDB unless explicitly passed:

```
{
  "force": true
}
```

If force not provided, reject.

---

## 5.4.2 Dead Letter Queue Replay

### Endpoint

```
POST /admin/dlq/replay
```

### Body

```
{
  "queue": "inbound-dlq",
  "limit": 50
}
```

### Behavior

* Move messages from DLQ to primary queue
* Maintain original headers
* Log replay action

Response:

```
{
  "replayed_count": 47
}
```

---

# 6. Backend Security Requirements

* Must be restricted to:

  * Internal VPN OR
  * IP Allowlist

* All admin actions must create record in:

```
system_audit_log
```

Schema:

```
id (uuid)
admin_user_id
action
resource_type
resource_id
metadata (jsonb)
timestamp
```

---

# 7. Non-Functional Requirements

## Performance

* Health check must complete < 2 seconds
* Trace query must be indexed
* No blocking calls to customer message flow

## Isolation

Admin operations must NOT:

* Block message processing
* Lock shared tables
* Overload Redis

Use async operations where possible.

---

# 8. Required Database Indexes

```
tenants(status)
tenants(genesys_org_id)
tenants(phone_number_id)
message_tracking(message_id)
message_tracking(wamid)
message_tracking(genesys_id)
```

---

# 9. Expected Failure Modes

Admin endpoints must gracefully handle:

* Service unavailable
* RabbitMQ timeout
* Redis timeout
* Tenant not found
* Message ID not found

Standard error response:

```
{
  "error": "RESOURCE_NOT_FOUND",
  "message": "Tenant not found"
}
```

---

# 10. Observability Requirements

All admin endpoints must emit:

* request_id
* execution_time_ms
* caller_user_id
* action_type

Must be traceable via centralized logging.

---

# 11. Rate Limiting

Admin endpoints must have rate limits:

* 100 requests per minute per admin

DLQ replay must have cooldown:

* minimum 10 seconds between calls

---

# 12. OpenAPI Contract Expectation

All endpoints must be defined in:

```
admin-openapi.yaml
```

Must include:

* request schema
* response schema
* error schema
* role requirement annotation

---

# 13. Edge Cases to Explicitly Handle

* Suspended tenant receives webhook → must be rejected
* Replay of empty DLQ → return 0
* Flush cache while traffic ongoing → no crash
* Trace request for partial lifecycle → return partial timeline

---

# 14. Debugging Expectations (LLM Assist Friendly)

When debugging failures:

The system must be able to:

* Retrieve audit logs
* Retrieve message trace
* Retrieve tenant config snapshot
* Retrieve queue depth history

All must be queryable via API.

---

This document is now:

* Deterministic
* Structured for code generation
* Safe for API scaffolding
* Debug-friendly
* Unambiguous
* Backend-complete
* Production-ready

If you'd like, I can next generate:

* Full OpenAPI YAML
* PostgreSQL schema migrations
* TypeScript interfaces
* RBAC middleware implementation
* Redis cache invalidation helper
* RabbitMQ DLQ replay utility
* React component structure
* End-to-end test plan

Tell me which layer you want to generate next.

--- END admin-dashboard/admin-dashboard-frd.md ---


--- BEGIN agent-portal-service/portal-backend-frd.md ---

# Agent Portal Service - Complete Technical Specification

**Document Type**: Functional Requirements & Implementation Guide  
**Service Name**: `agent-portal-service`  
**Version**: 2.0 (LLM-Optimized for Claude Code)  
**Architecture**: Stateless Orchestration Layer  
**Tech Stack**: Node.js/Express, Redis, WebSocket (Socket.IO), REST APIs  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Service Architecture](#2-service-architecture)
3. [System Context & Dependencies](#3-system-context--dependencies)
4. [Data Architecture](#4-data-architecture)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Onboarding Workflow](#6-onboarding-workflow)
7. [Dashboard & Metrics](#7-dashboard--metrics)
8. [Conversation Management](#8-conversation-management)
9. [Agent Widget Integration](#9-agent-widget-integration)
10. [Real-time Monitoring](#10-real-time-monitoring)
11. [API Specification](#11-api-specification)
12. [Security Implementation](#12-security-implementation)
13. [Performance & Scalability](#13-performance--scalability)
14. [Error Handling & Resilience](#14-error-handling--resilience)
15. [Observability](#15-observability)
16. [Implementation Guide](#16-implementation-guide)

---

# 1. Executive Summary

## 1.1 Purpose

The **Agent Portal Service** is the backend orchestration engine that powers the customer portal interface.
It provides a secure, stateless API layer between frontend applications and backend microservices.

**Key Principle**: This service is a **pure orchestration layer** - it does NOT own any data permanently.
All data is either retrieved from authoritative services or cached temporarily in Redis.

## 1.2 Core Responsibilities

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    AGENT PORTAL SERVICE                         â”‚
â”‚                  (Stateless Orchestration)                      â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                 â”‚
â”‚  1. SESSION MANAGEMENT                                          â”‚
â”‚     â€¢ Genesys Cloud SSO authentication flow                     â”‚
â”‚     â€¢ Token validation via Auth Service                         â”‚
â”‚     â€¢ HTTP-only secure session cookies                          â”‚
â”‚     â€¢ Multi-tenant isolation enforcement                        â”‚
â”‚                                                                 â”‚
â”‚  2. ONBOARDING ORCHESTRATION                                    â”‚
â”‚     â€¢ Multi-step wizard state management                        â”‚
â”‚     â€¢ Credential validation (Genesys + WhatsApp)                â”‚
â”‚     â€¢ Webhook URL generation                                    â”‚
â”‚     â€¢ Configuration persistence via Tenant Service              â”‚
â”‚                                                                 â”‚
â”‚  3. DATA AGGREGATION                                            â”‚
â”‚     â€¢ Metrics calculation from State Manager                    â”‚
â”‚     â€¢ Conversation history retrieval                            â”‚
â”‚     â€¢ Dashboard data caching (Redis)                            â”‚
â”‚     â€¢ Pagination for large datasets                             â”‚
â”‚                                                                 â”‚
â”‚  4. CONFIGURATION PROXY                                         â”‚
â”‚     â€¢ Secure tenant config updates                              â”‚
â”‚     â€¢ Validation before persistence                             â”‚
â”‚     â€¢ Prevent direct frontend-to-service access                 â”‚
â”‚                                                                 â”‚
â”‚  5. REAL-TIME MONITORING                                        â”‚
â”‚     â€¢ WebSocket-based message streaming                         â”‚
â”‚     â€¢ Live status updates                                       â”‚
â”‚     â€¢ Debug and support visibility                              â”‚
â”‚                                                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

## 1.3 Service Characteristics

| Characteristic | Description |
|----------------|-------------|
| **Data Ownership** | None - pure mediator pattern |
| **State Management** | Stateless (sessions in Redis) |
| **Scalability** | Horizontally scalable |
| **Availability** | High (99.9% target) |
| **Latency** | < 300ms for dashboard queries |
| **Security** | OAuth 2.0, tenant isolation, encryption |

---

# 2. Service Architecture

## 2.1 High-Level Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        FRONTEND LAYER                           â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Agent Portal UI   â”‚  Agent Interaction Widget                  â”‚
â”‚  (React/Vue)       â”‚  (Embedded in Genesys)                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚                    â”‚
         â”‚ HTTPS              â”‚ HTTPS + WebSocket
         â–¼                    â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚              AGENT PORTAL SERVICE (THIS SERVICE)                â”‚
â”‚                                                                 â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ Auth         â”‚  â”‚ Onboarding   â”‚  â”‚ Dashboard          â”‚   â”‚
â”‚  â”‚ Controller   â”‚  â”‚ Controller   â”‚  â”‚ Controller         â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                                 â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ History      â”‚  â”‚ Widget       â”‚  â”‚ WebSocket          â”‚   â”‚
â”‚  â”‚ Controller   â”‚  â”‚ Controller   â”‚  â”‚ Manager            â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                                 â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚              Middleware Layer                           â”‚   â”‚
â”‚  â”‚  â€¢ Authentication   â€¢ Validation   â€¢ Rate Limiting      â”‚   â”‚
â”‚  â”‚  â€¢ CORS             â€¢ Error Handler â€¢ Logger            â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚              â”‚              â”‚             â”‚
         â”‚              â”‚              â”‚             â”‚ (cache)
         â–¼              â–¼              â–¼             â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   Auth      â”‚  â”‚   Tenant    â”‚  â”‚   State    â”‚  â”‚  Redis   â”‚
â”‚   Service   â”‚  â”‚   Service   â”‚  â”‚   Manager  â”‚  â”‚          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

## 2.2 Design Patterns

### Mediator Pattern
Acts as intermediary between frontend and backend services,
preventing direct coupling and enforcing security boundaries.

### Facade Pattern
Provides simplified, unified interface to complex backend operations
(e.g., multi-step onboarding abstracts multiple service calls).

### Cache-Aside Pattern
Checks cache first, retrieves from source on miss, updates cache.
Used for metrics and conversation data.

### Circuit Breaker Pattern
Protects against cascading failures from downstream services.
Implements fallback responses and automatic recovery.

---

# 3. System Context & Dependencies

## 3.1 External Service Dependencies

### 3.1.1 Auth Service

**Purpose**: OAuth 2.0 token validation and user profile resolution

**Endpoints**:
```javascript
const AUTH_SERVICE = {
  baseUrl: process.env.AUTH_SERVICE_URL,
  
  endpoints: {
    // Validate Genesys OAuth token
    validateToken: 'POST /api/v1/auth/validate',
    // Request body: { token: string }
    // Response: { valid: boolean, userId: string, expiresAt: string }
    
    // Get user profile from validated token
    getUserProfile: 'GET /api/v1/auth/profile',
    // Headers: { Authorization: 'Bearer <token>' }
    // Response: { userId, email, name, tenantId, role }
    
    // Refresh access token
    refreshToken: 'POST /api/v1/auth/refresh',
    // Request body: { refreshToken: string }
    // Response: { accessToken, refreshToken, expiresAt }
  },
  
  // Timeout configuration
  timeouts: {
    validateToken: 3000,    // 3 seconds
    getUserProfile: 2000,   // 2 seconds
    refreshToken: 3000      // 3 seconds
  }
};
```

**Example Implementation**:
```javascript
class AuthServiceClient {
  constructor(baseUrl, timeout = 3000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: timeout
    });
  }
  
  async validateToken(token) {
    try {
      const response = await this.axios.post('/api/v1/auth/validate', {
        token
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Auth Service token validation failed', {
        error: error.message,
        statusCode: error.response?.status
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async getUserProfile(accessToken) {
    try {
      const response = await this.axios.get('/api/v1/auth/profile', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      return {
        success: true,
        profile: response.data
      };
    } catch (error) {
      logger.error('Auth Service profile retrieval failed', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

### 3.1.2 Tenant Service

**Purpose**: Tenant configuration CRUD operations

**Endpoints**:
```javascript
const TENANT_SERVICE = {
  baseUrl: process.env.TENANT_SERVICE_URL,
  
  endpoints: {
    // Create new tenant
    createTenant: 'POST /api/v1/tenants',
    // Request: { companyName, region, contactEmail, status }
    // Response: { id, companyName, region, status, createdAt }
    
    // Get tenant by ID
    getTenant: 'GET /api/v1/tenants/:id',
    // Response: { id, companyName, region, genesysConfig, whatsappConfig, ... }
    
    // Update tenant configuration
    updateTenant: 'PUT /api/v1/tenants/:id',
    // Request: { genesysConfig?, whatsappConfig?, status?, ... }
    // Response: { id, ...updated fields, updatedAt }
    
    // Get tenant by user ID
    getTenantByUserId: 'GET /api/v1/tenants/by-user/:userId',
    // Response: { id, companyName, ... }
    
    // Validate credentials
    validateCredentials: 'POST /api/v1/tenants/validate',
    // Request: { type: 'genesys'|'whatsapp', credentials: {...} }
    // Response: { valid: boolean, message: string }
  },
  
  timeouts: {
    createTenant: 5000,      // 5 seconds
    updateTenant: 5000,      // 5 seconds
    getTenant: 2000,         // 2 seconds
    validateCredentials: 10000 // 10 seconds (external API calls)
  }
};
```

**Example Implementation**:
```javascript
class TenantServiceClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: 5000
    });
  }
  
  async createTenant(data) {
    const response = await this.axios.post('/api/v1/tenants', {
      companyName: data.companyName,
      region: data.region,
      contactEmail: data.contactEmail,
      status: 'onboarding'
    });
    
    return response.data;
  }
  
  async updateTenant(tenantId, updates) {
    const response = await this.axios.put(
      `/api/v1/tenants/${tenantId}`,
      updates
    );
    
    return response.data;
  }
  
  async getTenantByUserId(userId) {
    const response = await this.axios.get(
      `/api/v1/tenants/by-user/${userId}`
    );
    
    return response.data;
  }
  
  async validateGenesysCredentials(credentials) {
    const response = await this.axios.post(
      '/api/v1/tenants/validate',
      {
        type: 'genesys',
        credentials: {
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          region: credentials.region
        }
      },
      { timeout: 10000 }
    );
    
    return response.data;
  }
  
  async validateWhatsAppCredentials(credentials) {
    const response = await this.axios.post(
      '/api/v1/tenants/validate',
      {
        type: 'whatsapp',
        credentials: {
          phoneNumberId: credentials.phoneNumberId,
          systemUserToken: credentials.systemUserToken
        }
      },
      { timeout: 10000 }
    );
    
    return response.data;
  }
}
```

### 3.1.3 State Manager

**Purpose**: Message tracking and conversation data retrieval

**Endpoints**:
```javascript
const STATE_MANAGER = {
  baseUrl: process.env.STATE_MANAGER_URL,
  
  endpoints: {
    // Get conversations for tenant
    getConversations: 'GET /api/v1/conversations',
    // Query params: { tenantId, page, limit, status? }
    // Response: { data: [...], pagination: {...} }
    
    // Get specific conversation
    getConversation: 'GET /api/v1/conversations/:id',
    // Response: { id, tenantId, waId, status, createdAt, ... }
    
    // Get messages for conversation
    getMessages: 'GET /api/v1/conversations/:id/messages',
    // Response: [ { messageId, direction, text, status, timestamp, ... } ]
    
    // Get metrics for tenant
    getMetrics: 'GET /api/v1/metrics/:tenantId',
    // Query params: { period: 'today'|'week'|'month' }
    // Response: { totalMessages, sent, delivered, read, failed, ... }
  },
  
  timeouts: {
    getConversations: 5000,  // 5 seconds
    getMessages: 5000,       // 5 seconds
    getMetrics: 3000         // 3 seconds
  }
};
```

**Example Implementation**:
```javascript
class StateManagerClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: 5000
    });
  }
  
  async getConversations(tenantId, options = {}) {
    const params = {
      tenantId,
      page: options.page || 1,
      limit: options.limit || 20,
      ...(options.status && { status: options.status })
    };
    
    const response = await this.axios.get('/api/v1/conversations', {
      params
    });
    
    return response.data;
  }
  
  async getConversation(conversationId) {
    const response = await this.axios.get(
      `/api/v1/conversations/${conversationId}`
    );
    
    return response.data;
  }
  
  async getMessages(conversationId) {
    const response = await this.axios.get(
      `/api/v1/conversations/${conversationId}/messages`
    );
    
    return response.data;
  }
  
  async getMetrics(tenantId, period = 'today') {
    const response = await this.axios.get(
      `/api/v1/metrics/${tenantId}`,
      {
        params: { period },
        timeout: 3000
      }
    );
    
    return response.data;
  }
}
```

### 3.1.4 Redis

**Purpose**: Session storage, metrics caching, onboarding state

**Configuration**:
```javascript
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0,
  
  // Key expiration times (seconds)
  ttl: {
    session: 86400,        // 24 hours
    onboarding: 3600,      // 1 hour
    metrics: 600,          // 10 minutes
    conversations: 300     // 5 minutes
  },
  
  // Key patterns
  keys: {
    session: (sessionId) => `session:${sessionId}`,
    onboarding: (tenantId) => `onboarding:${tenantId}`,
    metrics: (tenantId, period) => `metrics:${tenantId}:${period}`,
    conversations: (tenantId, page) => `conversations:${tenantId}:${page}`
  }
};
```

**Example Implementation**:
```javascript
const Redis = require('ioredis');

class RedisClient {
  constructor(config) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });
    
    this.ttl = config.ttl;
    this.keys = config.keys;
  }
  
  // Session management
  async setSession(sessionId, data) {
    const key = this.keys.session(sessionId);
    await this.client.setex(
      key,
      this.ttl.session,
      JSON.stringify(data)
    );
  }
  
  async getSession(sessionId) {
    const key = this.keys.session(sessionId);
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }
  
  async deleteSession(sessionId) {
    const key = this.keys.session(sessionId);
    await this.client.del(key);
  }
  
  // Onboarding state
  async setOnboardingState(tenantId, state) {
    const key = this.keys.onboarding(tenantId);
    await this.client.setex(
      key,
      this.ttl.onboarding,
      JSON.stringify(state)
    );
  }
  
  async getOnboardingState(tenantId) {
    const key = this.keys.onboarding(tenantId);
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }
  
  async deleteOnboardingState(tenantId) {
    const key = this.keys.onboarding(tenantId);
    await this.client.del(key);
  }
  
  // Metrics caching
  async cacheMetrics(tenantId, period, metrics) {
    const key = this.keys.metrics(tenantId, period);
    await this.client.setex(
      key,
      this.ttl.metrics,
      JSON.stringify(metrics)
    );
  }
  
  async getCachedMetrics(tenantId, period) {
    const key = this.keys.metrics(tenantId, period);
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }
  
  async clearMetricsCache(tenantId) {
    const pattern = `metrics:${tenantId}:*`;
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
}
```

## 3.2 Dependency Flow Diagram

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    REQUEST FLOW EXAMPLE:                        â”‚
â”‚              Get Dashboard Metrics for Tenant                   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

1. Frontend Request
   GET /api/v1/dashboard/stats
   Cookie: sessionId=abc123
   
   â†“
   
2. Agent Portal Service
   â€¢ Validate session from Redis
   â€¢ Extract tenantId from session
   â€¢ Check metrics cache in Redis
   
   â†“ (cache miss)
   
3. Query State Manager
   GET /api/v1/metrics/:tenantId?period=today
   
   â†“
   
4. State Manager Response
   {
     totalMessages: 1000,
     sent: 950,
     delivered: 920,
     read: 850,
     failed: 30,
     activeConversations: 45,
     distinctWaIds: 38
   }
   
   â†“
   
5. Agent Portal Service
   â€¢ Calculate success rate
   â€¢ Cache result in Redis (10 min TTL)
   â€¢ Return formatted response
   
   â†“
   
6. Frontend Response
   {
     totalMessages: 1000,
     sentCount: 950,
     deliveredCount: 920,
     readCount: 850,
     failedCount: 30,
     successRate: "92.0",
     activeConversations: 45,
     uniqueCustomers: 38,
     period: "today",
     lastUpdated: "2026-02-12T08:30:00Z"
   }
```

---

# 4. Data Architecture

## 4.1 Data Ownership Principle

**Critical Principle**: Agent Portal Service is a **pure orchestration layer**.

```
âœ… DOES:
   â€¢ Cache temporary data in Redis
   â€¢ Aggregate data from multiple sources
   â€¢ Transform/format data for frontend
   â€¢ Manage ephemeral session state

âŒ DOES NOT:
   â€¢ Own tenant configurations (Tenant Service)
   â€¢ Own message data (State Manager)
   â€¢ Own user authentication (Auth Service)
   â€¢ Persist any business data to database
```

## 4.2 Redis Data Schemas

### 4.2.1 Session Storage

**Key Pattern**: `session:{sessionId}`  
**TTL**: 24 hours (86400 seconds)  
**Purpose**: Maintain authenticated user sessions

**Schema**:
```javascript
{
  userId: "string",           // Genesys user ID
  tenantId: "string",          // Associated tenant UUID
  role: "admin|agent|viewer",  // User role for RBAC
  email: "string",             // User email
  name: "string",              // User display name
  createdAt: "ISO timestamp",  // Session creation time
  expiresAt: "ISO timestamp",  // Session expiration time
  lastActivity: "ISO timestamp" // Last request timestamp
}
```

**Example**:
```javascript
// Create session
await redis.setSession('sess_abc123', {
  userId: 'user_xyz789',
  tenantId: 'tenant_def456',
  role: 'admin',
  email: 'john.doe@example.com',
  name: 'John Doe',
  createdAt: '2026-02-12T08:00:00Z',
  expiresAt: '2026-02-13T08:00:00Z',
  lastActivity: '2026-02-12T08:00:00Z'
});

// Retrieve session
const session = await redis.getSession('sess_abc123');
if (!session) {
  throw new Error('Session expired or invalid');
}

// Update last activity
session.lastActivity = new Date().toISOString();
await redis.setSession('sess_abc123', session);

// Destroy session
await redis.deleteSession('sess_abc123');
```

### 4.2.2 Onboarding State Cache

**Key Pattern**: `onboarding:{tenantId}`  
**TTL**: 30-60 minutes (3600 seconds)  
**Purpose**: Track multi-step onboarding wizard progress

**Schema**:
```javascript
{
  step: 1-5,                   // Current wizard step
  tenantId: "string",          // Tenant UUID
  
  // Step 1: Organization Details
  organizationDetails: {
    companyName: "string",
    region: "string",          // Genesys region
    contactEmail: "string"
  },
  
  // Step 2: Genesys Configuration
  genesysConfig: {
    clientId: "string",
    clientSecret: "string",    // Encrypted
    region: "string",
    validated: boolean
  },
  
  // Step 3: WhatsApp Configuration
  whatsappConfig: {
    phoneNumberId: "string",
    systemUserToken: "string", // Encrypted
    validated: boolean
  },
  
  // Metadata
  createdAt: "ISO timestamp",
  lastUpdated: "ISO timestamp",
  completedSteps: [1, 2, 3]    // Array of completed step numbers
}
```

**Example**:
```javascript
// Initialize onboarding
await redis.setOnboardingState('tenant_123', {
  step: 1,
  tenantId: 'tenant_123',
  organizationDetails: {
    companyName: 'Acme Corp',
    region: 'us-east-1',
    contactEmail: 'admin@acme.com'
  },
  createdAt: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  completedSteps: [1]
});

// Update for next step
const state = await redis.getOnboardingState('tenant_123');
state.step = 2;
state.genesysConfig = {
  clientId: 'client_abc',
  clientSecret: encryptedSecret,
  region: 'us-east-1',
  validated: true
};
state.completedSteps.push(2);
state.lastUpdated = new Date().toISOString();
await redis.setOnboardingState('tenant_123', state);

// Complete onboarding - clean up
await redis.deleteOnboardingState('tenant_123');
```

### 4.2.3 Metrics Cache

**Key Pattern**: `metrics:{tenantId}:{period}`  
**TTL**: 5-15 minutes (600 seconds)  
**Purpose**: Cache calculated dashboard metrics

**Schema**:
```javascript
{
  totalMessages: number,
  sentCount: number,
  deliveredCount: number,
  readCount: number,
  failedCount: number,
  successRate: string,         // Percentage as string (e.g., "92.5")
  activeConversations: number,
  uniqueCustomers: number,     // Distinct wa_id count
  period: "today|week|month",
  calculatedAt: "ISO timestamp"
}
```

**Example**:
```javascript
// Cache metrics
await redis.cacheMetrics('tenant_123', 'today', {
  totalMessages: 1000,
  sentCount: 950,
  deliveredCount: 920,
  readCount: 850,
  failedCount: 30,
  successRate: "92.0",
  activeConversations: 45,
  uniqueCustomers: 38,
  period: 'today',
  calculatedAt: '2026-02-12T08:30:00Z'
});

// Retrieve cached metrics
const cached = await redis.getCachedMetrics('tenant_123', 'today');
if (cached) {
  return cached;
}

// Clear all metric caches for tenant
await redis.clearMetricsCache('tenant_123');
```

### 4.2.4 Conversation List Cache

**Key Pattern**: `conversations:{tenantId}:{page}`  
**TTL**: 5 minutes (300 seconds)  
**Purpose**: Cache paginated conversation lists

**Schema**:
```javascript
{
  data: [
    {
      wa_id: "string",
      conversation_id: "string",
      last_activity: "ISO timestamp",
      status: "active|closed",
      message_count: number
    }
  ],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  },
  cachedAt: "ISO timestamp"
}
```

## 4.3 Cookie Configuration

**Session Cookie Settings**:
```javascript
const SESSION_COOKIE_CONFIG = {
  name: 'sessionId',
  httpOnly: true,              // Prevent XSS attacks
  secure: true,                // HTTPS only in production
  sameSite: 'strict',          // CSRF protection
  maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  path: '/',
  domain: process.env.COOKIE_DOMAIN || undefined,
  signed: true                 // Use cookie-parser secret
};

// Usage in Express
app.use(cookieParser(process.env.COOKIE_SECRET));

// Set cookie
res.cookie('sessionId', sessionId, SESSION_COOKIE_CONFIG);

// Read cookie
const sessionId = req.signedCookies.sessionId;

// Clear cookie
res.clearCookie('sessionId', SESSION_COOKIE_CONFIG);
```

---

# 5. Authentication & Authorization

## 5.1 SSO Flow (REQ-PORTAL-01)

**Complete OAuth 2.0 Authorization Code Flow with Genesys Cloud**

### Flow Diagram

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚          â”‚  1. GET /auth/login                  â”‚             â”‚
â”‚          â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–ºâ”‚             â”‚
â”‚          â”‚                                      â”‚             â”‚
â”‚          â”‚  2. Redirect to Genesys OAuth       â”‚   Agent     â”‚
â”‚  User    â”‚â—„â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤   Portal    â”‚
â”‚  Browser â”‚  Location: https://login.genesys...  â”‚   Service   â”‚
â”‚          â”‚                                      â”‚             â”‚
â”‚          â”‚  3. User authenticates with Genesys  â”‚             â”‚
â”‚          â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                   â”‚             â”‚
â”‚          â”‚                  â”‚                   â”‚             â”‚
â”‚          â”‚  4. Genesys redirects with code      â”‚             â”‚
â”‚          â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–ºâ”‚             â”‚
â”‚          â”‚  GET /auth/callback?code=xyz&state=abc             â”‚
â”‚          â”‚                                      â”‚             â”‚
â”‚          â”‚  5. Validate token via Auth Service  â”‚             â”‚
â”‚          â”‚                     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤             â”‚
â”‚          â”‚                     â”‚                â”‚             â”‚
â”‚          â”‚                     â–¼                â”‚             â”‚
â”‚          â”‚              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”‚             â”‚
â”‚          â”‚              â”‚    Auth     â”‚         â”‚             â”‚
â”‚          â”‚              â”‚   Service   â”‚         â”‚             â”‚
â”‚          â”‚              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚             â”‚
â”‚          â”‚                     â”‚                â”‚             â”‚
â”‚          â”‚  6. Get user profile & tenant        â”‚             â”‚
â”‚          â”‚                     â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤             â”‚
â”‚          â”‚                     â”‚                â”‚             â”‚
â”‚          â”‚                     â–¼                â”‚             â”‚
â”‚          â”‚              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”‚             â”‚
â”‚          â”‚              â”‚   Tenant    â”‚         â”‚             â”‚
â”‚          â”‚              â”‚   Service   â”‚         â”‚             â”‚
â”‚          â”‚              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚             â”‚
â”‚          â”‚                     â”‚                â”‚             â”‚
â”‚          â”‚  7. Create session in Redis          â”‚             â”‚
â”‚          â”‚                     â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤             â”‚
â”‚          â”‚                     â”‚                â”‚             â”‚
â”‚          â”‚                     â–¼                â”‚             â”‚
â”‚          â”‚                â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”            â”‚             â”‚
â”‚          â”‚                â”‚ Redis  â”‚            â”‚             â”‚
â”‚          â”‚                â””â”€â”€â”€â”€â”€â”€â”€â”€â”˜            â”‚             â”‚
â”‚          â”‚                     â”‚                â”‚             â”‚
â”‚          â”‚  8. Set HTTP-only cookie & redirect  â”‚             â”‚
â”‚          â”‚â—„â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤             â”‚
â”‚          â”‚  Set-Cookie: sessionId=...           â”‚             â”‚
â”‚          â”‚  Location: /dashboard                â”‚             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Implementation

#### Step 1: Initiate Login

```javascript
/**
 * Endpoint: GET /api/v1/auth/login
 * Purpose: Initiate Genesys Cloud OAuth 2.0 flow
 */
router.get('/auth/login', (req, res) => {
  // Generate secure state parameter for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  
  // Store state in short-lived session (5 minutes)
  req.session.oauthState = state;
  
  // Construct Genesys authorization URL
  const authUrl = new URL('https://login.mypurecloud.com/oauth/authorize');
  authUrl.searchParams.set('client_id', process.env.GENESYS_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', process.env.GENESYS_REDIRECT_URI);
  authUrl.searchParams.set('state', state);
  
  // Optional: Add scope if needed
  // authUrl.searchParams.set('scope', 'openid profile email');
  
  logger.info('Initiating OAuth login', {
    redirectUri: process.env.GENESYS_REDIRECT_URI,
    state: state.substring(0, 8) + '...' // Log partial state
  });
  
  res.redirect(authUrl.toString());
});
```

#### Step 2-3: User Authentication (Genesys Cloud)

User authenticates with Genesys Cloud directly.
This happens on Genesys servers, not in our application.

#### Step 4-8: Handle OAuth Callback

```javascript
/**
 * Endpoint: GET /api/v1/auth/callback
 * Purpose: Handle OAuth callback from Genesys Cloud
 */
router.get('/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  try {
    // 1. Validate state parameter (CSRF protection)
    if (!state || state !== req.session.oauthState) {
      logger.warn('OAuth state mismatch', { 
        received: state, 
        expected: req.session.oauthState 
      });
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    
    // Clear used state
    delete req.session.oauthState;
    
    // 2. Check for OAuth errors
    if (error) {
      logger.error('OAuth error from Genesys', { error });
      return res.redirect('/login?error=' + encodeURIComponent(error));
    }
    
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }
    
    // 3. Validate authorization code with Auth Service
    logger.info('Validating authorization code', { 
      code: code.substring(0, 10) + '...' 
    });
    
    const tokenValidation = await authService.validateToken(code);
    
    if (!tokenValidation.success) {
      logger.error('Token validation failed', { 
        error: tokenValidation.error 
      });
      return res.redirect('/login?error=token_validation_failed');
    }
    
    const { accessToken, expiresAt } = tokenValidation.data;
    
    // 4. Get user profile from Auth Service
    const profileResponse = await authService.getUserProfile(accessToken);
    
    if (!profileResponse.success) {
      logger.error('Failed to retrieve user profile', { 
        error: profileResponse.error 
      });
      return res.redirect('/login?error=profile_retrieval_failed');
    }
    
    const userProfile = profileResponse.profile;
    
    // 5. Resolve tenant via Tenant Service
    logger.info('Resolving tenant for user', { userId: userProfile.userId });
    
    const tenant = await tenantService.getTenantByUserId(userProfile.userId);
    
    if (!tenant) {
      logger.error('No tenant found for user', { userId: userProfile.userId });
      return res.redirect('/login?error=no_tenant');
    }
    
    // 6. Create session in Redis
    const sessionId = generateSecureSessionId();
    const sessionData = {
      userId: userProfile.userId,
      tenantId: tenant.id,
      role: userProfile.role || 'agent',
      email: userProfile.email,
      name: userProfile.name,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      lastActivity: new Date().toISOString()
    };
    
    await redis.setSession(sessionId, sessionData);
    
    logger.info('Session created successfully', {
      sessionId: sessionId.substring(0, 8) + '...',
      userId: userProfile.userId,
      tenantId: tenant.id
    });
    
    // 7. Set HTTP-only secure cookie
    res.cookie('sessionId', sessionId, SESSION_COOKIE_CONFIG);
    
    // 8. Redirect to dashboard
    res.redirect('/dashboard');
    
  } catch (error) {
    logger.error('OAuth callback error', {
      error: error.message,
      stack: error.stack
    });
    
    res.redirect('/login?error=unexpected_error');
  }
});
```

#### Helper: Generate Secure Session ID

```javascript
function generateSecureSessionId() {
  // Generate cryptographically secure random session ID
  const randomBytes = crypto.randomBytes(32);
  const timestamp = Date.now().toString(36);
  const random = randomBytes.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `sess_${timestamp}_${random}`;
}
```

## 5.2 Session Validation Middleware

```javascript
/**
 * Authentication Middleware
 * Validates session on every protected route
 */
async function requireAuth(req, res, next) {
  const correlationId = req.id; // From express-request-id
  
  try {
    // 1. Extract session ID from cookie
    const sessionId = req.signedCookies.sessionId;
    
    if (!sessionId) {
      logger.warn('Missing session cookie', { correlationId });
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'NO_SESSION'
      });
    }
    
    // 2. Retrieve session from Redis
    const sessionData = await redis.getSession(sessionId);
    
    if (!sessionData) {
      logger.warn('Session not found in Redis', { 
        sessionId: sessionId.substring(0, 8) + '...',
        correlationId 
      });
      return res.status(401).json({ 
        error: 'Session expired or invalid',
        code: 'SESSION_EXPIRED'
      });
    }
    
    // 3. Check session expiration
    const expiresAt = new Date(sessionData.expiresAt);
    if (expiresAt < new Date()) {
      logger.warn('Session expired', {
        sessionId: sessionId.substring(0, 8) + '...',
        expiresAt: sessionData.expiresAt,
        correlationId
      });
      
      // Clean up expired session
      await redis.deleteSession(sessionId);
      res.clearCookie('sessionId');
      
      return res.status(401).json({ 
        error: 'Session expired',
        code: 'SESSION_EXPIRED'
      });
    }
    
    // 4. Update last activity timestamp
    sessionData.lastActivity = new Date().toISOString();
    await redis.setSession(sessionId, sessionData);
    
    // 5. Attach session data to request
    req.session = sessionData;
    req.userId = sessionData.userId;
    req.tenantId = sessionData.tenantId;
    req.userRole = sessionData.role;
    
    logger.debug('Session validated', {
      sessionId: sessionId.substring(0, 8) + '...',
      userId: sessionData.userId,
      tenantId: sessionData.tenantId,
      correlationId
    });
    
    next();
    
  } catch (error) {
    logger.error('Session validation error', {
      error: error.message,
      stack: error.stack,
      correlationId
    });
    
    res.status(500).json({ 
      error: 'Authentication service error',
      code: 'AUTH_ERROR'
    });
  }
}

// Usage
app.use('/api/v1/dashboard', requireAuth, dashboardRouter);
app.use('/api/v1/onboarding', requireAuth, onboardingRouter);
app.use('/api/v1/history', requireAuth, historyRouter);
```

## 5.3 Tenant Isolation Middleware

```javascript
/**
 * Tenant Isolation Middleware
 * Ensures users can only access data for their own tenant
 */
function enforceTenantIsolation(req, res, next) {
  const { tenantId: sessionTenantId } = req.session;
  
  // Check URL parameters
  const urlTenantId = req.params.tenantId;
  if (urlTenantId && urlTenantId !== sessionTenantId) {
    logger.warn('Tenant isolation violation attempt', {
      sessionTenantId,
      requestedTenantId: urlTenantId,
      userId: req.userId,
      path: req.path
    });
    
    return res.status(403).json({ 
      error: 'Access denied - tenant mismatch',
      code: 'TENANT_ISOLATION_VIOLATION'
    });
  }
  
  // Check request body
  const bodyTenantId = req.body.tenantId;
  if (bodyTenantId && bodyTenantId !== sessionTenantId) {
    logger.warn('Tenant isolation violation attempt in body', {
      sessionTenantId,
      requestedTenantId: bodyTenantId,
      userId: req.userId
    });
    
    return res.status(403).json({ 
      error: 'Access denied - tenant mismatch',
      code: 'TENANT_ISOLATION_VIOLATION'
    });
  }
  
  next();
}

// Usage
router.get('/conversations/:conversationId', 
  requireAuth, 
  enforceTenantIsolation, 
  async (req, res) => {
    // At this point, req.tenantId is guaranteed to match session
    // ...
  }
);
```

## 5.4 Token Refresh

```javascript
/**
 * Endpoint: POST /api/v1/auth/refresh
 * Purpose: Refresh expired access token
 */
router.post('/auth/refresh', requireAuth, async (req, res) => {
  const { sessionId } = req.signedCookies;
  
  try {
    // Get current session
    const session = await redis.getSession(sessionId);
    
    if (!session) {
      return res.status(401).json({ error: 'Session not found' });
    }
    
    // Request new token from Auth Service
    const refreshResponse = await authService.refreshToken(
      session.userId
    );
    
    if (!refreshResponse.success) {
      logger.error('Token refresh failed', {
        userId: session.userId,
        error: refreshResponse.error
      });
      
      return res.status(401).json({ 
        error: 'Token refresh failed',
        code: 'REFRESH_FAILED'
      });
    }
    
    // Update session expiration
    session.expiresAt = refreshResponse.data.expiresAt;
    await redis.setSession(sessionId, session);
    
    logger.info('Token refreshed successfully', {
      userId: session.userId,
      newExpiresAt: session.expiresAt
    });
    
    res.json({ 
      success: true,
      expiresAt: session.expiresAt
    });
    
  } catch (error) {
    logger.error('Token refresh error', {
      error: error.message
    });
    
    res.status(500).json({ error: 'Token refresh failed' });
  }
});
```

## 5.5 Logout

```javascript
/**
 * Endpoint: POST /api/v1/auth/logout
 * Purpose: End user session
 */
router.post('/auth/logout', requireAuth, async (req, res) => {
  const sessionId = req.signedCookies.sessionId;
  
  try {
    // Delete session from Redis
    await redis.deleteSession(sessionId);
    
    // Clear cookie
    res.clearCookie('sessionId', SESSION_COOKIE_CONFIG);
    
    logger.info('User logged out', {
      userId: req.userId,
      tenantId: req.tenantId,
      sessionId: sessionId.substring(0, 8) + '...'
    });
    
    res.json({ success: true, message: 'Logged out successfully' });
    
  } catch (error) {
    logger.error('Logout error', {
      error: error.message,
      userId: req.userId
    });
    
    // Still clear cookie even if Redis fails
    res.clearCookie('sessionId', SESSION_COOKIE_CONFIG);
    
    res.status(500).json({ 
      error: 'Logout failed',
      message: 'Session cleared locally'
    });
  }
});
```

---

# 6. Onboarding Workflow

## 6.1 Overview (REQ-PORTAL-02)

**Purpose**: Guide new tenants through 5-step configuration wizard

**State Management**: Redis-backed stateful wizard with 30-60 minute TTL

**Flow**:
```
Step 1: Organization Details
   â†“
Step 2: Genesys Configuration + Validation
   â†“
Step 3: WhatsApp Configuration + Validation
   â†“
Step 4: Integration Testing (parallel)
   â†“
Step 5: Webhook Setup + Finalization
```

## 6.2 Step 1: Organization Details

**Purpose**: Collect basic tenant information

**Endpoint**: `POST /api/v1/onboarding/step1`

**Request Body**:
```json
{
  "companyName": "Acme Corporation",
  "region": "us-east-1",
  "contactEmail": "admin@acme.com"
}
```

**Validation Rules**:
- `companyName`: Required, 2-100 characters
- `region`: Required, valid Genesys region
- `contactEmail`: Required, valid email format

**Implementation**:
```javascript
router.post('/onboarding/step1', requireAuth, async (req, res) => {
  const { companyName, region, contactEmail } = req.body;
  const { userId, tenantId: sessionTenantId } = req.session;
  
  try {
    // 1. Validate input
    const validation = validateStep1Input({ 
      companyName, 
      region, 
      contactEmail 
    });
    
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validation.errors
      });
    }
    
    // 2. Create preliminary tenant entry in Tenant Service
    logger.info('Creating preliminary tenant', {
      companyName,
      region,
      userId
    });
    
    const tenant = await tenantService.createTenant({
      companyName,
      region,
      contactEmail,
      status: 'onboarding',
      createdBy: userId
    });
    
    // 3. Initialize onboarding state in Redis
    const onboardingState = {
      step: 1,
      tenantId: tenant.id,
      organizationDetails: {
        companyName,
        region,
        contactEmail
      },
      completedSteps: [1],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    await redis.setOnboardingState(tenant.id, onboardingState);
    
    logger.info('Step 1 completed', {
      tenantId: tenant.id,
      companyName
    });
    
    res.json({
      success: true,
      tenantId: tenant.id,
      currentStep: 1,
      nextStep: 2,
      data: {
        companyName,
        region
      }
    });
    
  } catch (error) {
    logger.error('Step 1 failed', {
      error: error.message,
      userId
    });
    
    res.status(500).json({ 
      error: 'Failed to complete step 1',
      message: error.message
    });
  }
});

// Validation function
function validateStep1Input({ companyName, region, contactEmail }) {
  const errors = [];
  
  if (!companyName || companyName.length < 2 || companyName.length > 100) {
    errors.push('Company name must be between 2-100 characters');
  }
  
  const validRegions = [
    'us-east-1', 'us-east-2', 'us-west-2', 
    'eu-west-1', 'eu-central-1',
    'ap-southeast-2', 'ap-northeast-1'
  ];
  
  if (!region || !validRegions.includes(region)) {
    errors.push(`Region must be one of: ${validRegions.join(', ')}`);
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!contactEmail || !emailRegex.test(contactEmail)) {
    errors.push('Valid email address required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

## 6.3 Step 2: Genesys Configuration

**Purpose**: Configure and validate Genesys Cloud integration

**Endpoint**: `POST /api/v1/onboarding/step2`

**Request Body**:
```json
{
  "tenantId": "tenant_uuid",
  "clientId": "genesys_client_id",
  "clientSecret": "genesys_client_secret",
  "region": "us-east-1"
}
```

**Implementation**:
```javascript
router.post('/onboarding/step2', requireAuth, async (req, res) => {
  const { tenantId, clientId, clientSecret, region } = req.body;
  const { userId } = req.session;
  
  try {
    // 1. Retrieve onboarding state
    const state = await redis.getOnboardingState(tenantId);
    
    if (!state) {
      return res.status(400).json({ 
        error: 'Onboarding session expired',
        code: 'SESSION_EXPIRED'
      });
    }
    
    if (state.step !== 1) {
      return res.status(400).json({ 
        error: `Must complete step ${state.step} first`,
        code: 'INVALID_STEP'
      });
    }
    
    // 2. Validate Genesys credentials
    logger.info('Validating Genesys credentials', {
      tenantId,
      clientId: clientId.substring(0, 8) + '...',
      region
    });
    
    const validation = await validateGenesysCredentials({
      clientId,
      clientSecret,
      region
    });
    
    if (!validation.success) {
      logger.warn('Genesys validation failed', {
        tenantId,
        error: validation.error
      });
      
      return res.status(400).json({
        error: 'Invalid Genesys credentials',
        details: validation.error,
        code: 'VALIDATION_FAILED'
      });
    }
    
    // 3. Encrypt credentials before caching
    const encryptedSecret = await encryptCredential(clientSecret);
    
    // 4. Update onboarding state
    state.step = 2;
    state.genesysConfig = {
      clientId,
      clientSecret: encryptedSecret,
      region,
      validated: true,
      validatedAt: new Date().toISOString()
    };
    state.completedSteps.push(2);
    state.lastUpdated = new Date().toISOString();
    
    await redis.setOnboardingState(tenantId, state);
    
    logger.info('Step 2 completed', {
      tenantId,
      region
    });
    
    res.json({
      success: true,
      tenantId,
      currentStep: 2,
      nextStep: 3,
      validated: true
    });
    
  } catch (error) {
    logger.error('Step 2 failed', {
      error: error.message,
      tenantId,
      userId
    });
    
    res.status(500).json({ 
      error: 'Failed to complete step 2',
      message: error.message
    });
  }
});

/**
 * Validate Genesys Cloud credentials
 * Attempts OAuth token exchange
 */
async function validateGenesysCredentials({ clientId, clientSecret, region }) {
  try {
    // Construct region-specific OAuth URL
    const tokenUrl = `https://login.${region}.pure.cloud/oauth/token`;
    
    const response = await axios.post(
      tokenUrl,
      {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      },
      { timeout: 10000 }
    );
    
    if (response.data.access_token) {
      logger.info('Genesys credentials validated', {
        clientId: clientId.substring(0, 8) + '...',
        region,
        expiresIn: response.data.expires_in
      });
      
      return { 
        success: true, 
        token: response.data.access_token,
        expiresIn: response.data.expires_in
      };
    }
    
    return { 
      success: false, 
      error: 'No access token received'
    };
    
  } catch (error) {
    logger.error('Genesys validation error', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
}

/**
 * Encrypt sensitive credential data
 * Uses AES-256-GCM encryption
 */
async function encryptCredential(plaintext) {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return iv + authTag + encrypted data
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt credential data
 */
async function decryptCredential(encrypted) {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

## 6.4 Step 3: WhatsApp Configuration

**Purpose**: Configure and validate Meta WhatsApp Business API

**Endpoint**: `POST /api/v1/onboarding/step3`

**Request Body**:
```json
{
  "tenantId": "tenant_uuid",
  "phoneNumberId": "whatsapp_phone_number_id",
  "systemUserToken": "meta_system_user_token"
}
```

**Implementation**:
```javascript
router.post('/onboarding/step3', requireAuth, async (req, res) => {
  const { tenantId, phoneNumberId, systemUserToken } = req.body;
  
  try {
    // 1. Retrieve onboarding state
    const state = await redis.getOnboardingState(tenantId);
    
    if (!state) {
      return res.status(400).json({ 
        error: 'Onboarding session expired'
      });
    }
    
    if (state.step !== 2) {
      return res.status(400).json({ 
        error: `Must complete step ${state.step} first`
      });
    }
    
    // 2. Validate WhatsApp credentials
    logger.info('Validating WhatsApp credentials', {
      tenantId,
      phoneNumberId
    });
    
    const validation = await validateWhatsAppCredentials({
      phoneNumberId,
      systemUserToken
    });
    
    if (!validation.success) {
      logger.warn('WhatsApp validation failed', {
        tenantId,
        phoneNumberId,
        error: validation.error
      });
      
      return res.status(400).json({
        error: 'Invalid WhatsApp credentials',
        details: validation.error,
        code: 'VALIDATION_FAILED'
      });
    }
    
    // 3. Encrypt token before caching
    const encryptedToken = await encryptCredential(systemUserToken);
    
    // 4. Update onboarding state
    state.step = 3;
    state.whatsappConfig = {
      phoneNumberId,
      systemUserToken: encryptedToken,
      validated: true,
      validatedAt: new Date().toISOString(),
      phoneNumber: validation.phoneNumber // Retrieved from Meta API
    };
    state.completedSteps.push(3);
    state.lastUpdated = new Date().toISOString();
    
    await redis.setOnboardingState(tenantId, state);
    
    logger.info('Step 3 completed', {
      tenantId,
      phoneNumberId
    });
    
    res.json({
      success: true,
      tenantId,
      currentStep: 3,
      nextStep: 4,
      validated: true,
      phoneNumber: validation.phoneNumber
    });
    
  } catch (error) {
    logger.error('Step 3 failed', {
      error: error.message,
      tenantId
    });
    
    res.status(500).json({ 
      error: 'Failed to complete step 3'
    });
  }
});

/**
 * Validate WhatsApp Business API credentials
 * Tests Meta Graph API access
 */
async function validateWhatsAppCredentials({ phoneNumberId, systemUserToken }) {
  try {
    // Query Meta Graph API to verify phone number and access
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}`;
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${systemUserToken}`
      },
      params: {
        fields: 'id,display_phone_number,verified_name,quality_rating'
      },
      timeout: 10000
    });
    
    if (response.data.id === phoneNumberId) {
      logger.info('WhatsApp credentials validated', {
        phoneNumberId,
        phoneNumber: response.data.display_phone_number,
        verified: response.data.verified_name
      });
      
      return {
        success: true,
        phoneNumber: response.data.display_phone_number,
        verifiedName: response.data.verified_name,
        qualityRating: response.data.quality_rating
      };
    }
    
    return {
      success: false,
      error: 'Phone number ID mismatch'
    };
    
  } catch (error) {
    logger.error('WhatsApp validation error', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    if (error.response?.status === 403) {
      return {
        success: false,
        error: 'Invalid access token or insufficient permissions'
      };
    }
    
    if (error.response?.status === 404) {
      return {
        success: false,
        error: 'Phone number ID not found'
      };
    }
    
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
}
```

## 6.5 Step 4: Integration Validation

**Purpose**: Test both integrations in parallel

**Endpoint**: `GET /api/v1/onboarding/validate`

**Implementation**:
```javascript
router.get('/onboarding/validate', requireAuth, async (req, res) => {
  const { tenantId } = req.query;
  
  try {
    // 1. Retrieve onboarding state
    const state = await redis.getOnboardingState(tenantId);
    
    if (!state) {
      return res.status(400).json({ 
        error: 'Onboarding session expired'
      });
    }
    
    if (state.step !== 3) {
      return res.status(400).json({ 
        error: 'Complete steps 1-3 first'
      });
    }
    
    // 2. Decrypt credentials
    const genesysSecret = await decryptCredential(
      state.genesysConfig.clientSecret
    );
    const whatsappToken = await decryptCredential(
      state.whatsappConfig.systemUserToken
    );
    
    // 3. Test connections in parallel
    logger.info('Testing integrations', { tenantId });
    
    const [genesysResult, whatsappResult] = await Promise.allSettled([
      testGenesysConnection({
        clientId: state.genesysConfig.clientId,
        clientSecret: genesysSecret,
        region: state.genesysConfig.region
      }),
      testWhatsAppConnection({
        phoneNumberId: state.whatsappConfig.phoneNumberId,
        systemUserToken: whatsappToken
      })
    ]);
    
    // 4. Process results
    const results = {
      genesys: genesysResult.status === 'fulfilled' && genesysResult.value.success
        ? 'success'
        : 'failed',
      whatsapp: whatsappResult.status === 'fulfilled' && whatsappResult.value.success
        ? 'success'
        : 'failed',
      details: {
        genesys: genesysResult.status === 'fulfilled'
          ? genesysResult.value.message
          : genesysResult.reason?.message || 'Connection test failed',
        whatsapp: whatsappResult.status === 'fulfilled'
          ? whatsappResult.value.message
          : whatsappResult.reason?.message || 'Connection test failed'
      }
    };
    
    logger.info('Integration validation results', {
      tenantId,
      genesys: results.genesys,
      whatsapp: results.whatsapp
    });
    
    res.json(results);
    
  } catch (error) {
    logger.error('Integration validation error', {
      error: error.message,
      tenantId
    });
    
    res.status(500).json({ 
      error: 'Validation failed',
      message: error.message
    });
  }
});

/**
 * Test Genesys Cloud connectivity
 */
async function testGenesysConnection({ clientId, clientSecret, region }) {
  try {
    // Attempt to get organization info via Genesys API
    const tokenResponse = await axios.post(
      `https://login.${region}.pure.cloud/oauth/token`,
      {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      },
      { timeout: 10000 }
    );
    
    const accessToken = tokenResponse.data.access_token;
    
    // Verify API access
    const orgResponse = await axios.get(
      `https://api.${region}.pure.cloud/api/v2/organizations/me`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        timeout: 5000
      }
    );
    
    return {
      success: true,
      message: `Connected to ${orgResponse.data.name}`,
      organizationId: orgResponse.data.id
    };
    
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message
    };
  }
}

/**
 * Test WhatsApp Business API connectivity
 */
async function testWhatsAppConnection({ phoneNumberId, systemUserToken }) {
  try {
    // Retrieve phone number info
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${phoneNumberId}`,
      {
        headers: {
          Authorization: `Bearer ${systemUserToken}`
        },
        params: {
          fields: 'id,display_phone_number,verified_name,quality_rating,messaging_limit_tier'
        },
        timeout: 10000
      }
    );
    
    return {
      success: true,
      message: `Connected to ${response.data.display_phone_number}`,
      phoneNumber: response.data.display_phone_number,
      verifiedName: response.data.verified_name,
      qualityRating: response.data.quality_rating
    };
    
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.error?.message || error.message
    };
  }
}
```

## 6.6 Step 5: Webhook Setup & Completion

**Purpose**: Generate webhook URLs and finalize configuration

**Endpoint**: `POST /api/v1/onboarding/complete`

**Implementation**:
```javascript
router.post('/onboarding/complete', requireAuth, async (req, res) => {
  const { tenantId } = req.body;
  const { userId } = req.session;
  
  try {
    // 1. Retrieve final onboarding state
    const state = await redis.getOnboardingState(tenantId);
    
    if (!state) {
      return res.status(400).json({ 
        error: 'Onboarding session expired'
      });
    }
    
    if (state.step !== 3) {
      return res.status(400).json({ 
        error: 'Complete all previous steps first'
      });
    }
    
    // 2. Generate webhook URLs and secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    
    const webhooks = {
      genesys: `${process.env.BASE_URL}/webhooks/genesys/${tenantId}`,
      meta: `${process.env.BASE_URL}/webhooks/meta/${tenantId}`,
      secret: webhookSecret,
      verifyToken: crypto.randomBytes(16).toString('hex')
    };
    
    logger.info('Generated webhook configuration', {
      tenantId,
      genesysUrl: webhooks.genesys,
      metaUrl: webhooks.meta
    });
    
    // 3. Decrypt credentials for persistence
    const genesysSecret = await decryptCredential(
      state.genesysConfig.clientSecret
    );
    const whatsappToken = await decryptCredential(
      state.whatsappConfig.systemUserToken
    );
    
    // 4. Persist complete configuration to Tenant Service
    await tenantService.updateTenant(tenantId, {
      genesysConfig: {
        clientId: state.genesysConfig.clientId,
        clientSecret: genesysSecret, // Tenant Service will re-encrypt
        region: state.genesysConfig.region
      },
      whatsappConfig: {
        phoneNumberId: state.whatsappConfig.phoneNumberId,
        systemUserToken: whatsappToken, // Tenant Service will re-encrypt
        phoneNumber: state.whatsappConfig.phoneNumber
      },
      webhooks,
      status: 'active',
      onboardedBy: userId,
      onboardedAt: new Date().toISOString()
    });
    
    logger.info('Tenant configuration persisted', {
      tenantId,
      status: 'active'
    });
    
    // 5. Clean up onboarding state from Redis
    await redis.deleteOnboardingState(tenantId);
    
    // 6. Return webhook URLs for manual configuration
    res.json({
      success: true,
      message: 'Onboarding completed successfully',
      tenantId,
      status: 'active',
      webhooks: {
        genesys: {
          url: webhooks.genesys,
          instructions: 'Configure this URL in Genesys Cloud > Admin > Integrations > Custom Webhooks'
        },
        meta: {
          url: webhooks.meta,
          verifyToken: webhooks.verifyToken,
          instructions: 'Configure this URL in Meta Business Suite > WhatsApp > Settings > Webhooks'
        },
        secret: webhooks.secret,
        note: 'Save the webhook secret securely - it will be used to verify incoming webhook requests'
      }
    });
    
  } catch (error) {
    logger.error('Onboarding completion failed', {
      error: error.message,
      tenantId,
      userId
    });
    
    res.status(500).json({ 
      error: 'Failed to complete onboarding',
      message: error.message
    });
  }
});
```

## 6.7 Resume Onboarding

**Purpose**: Allow users to continue incomplete onboarding

**Endpoint**: `GET /api/v1/onboarding/status/:tenantId`

**Implementation**:
```javascript
router.get('/onboarding/status/:tenantId', requireAuth, async (req, res) => {
  const { tenantId } = req.params;
  
  try {
    // Check onboarding state in Redis
    const state = await redis.getOnboardingState(tenantId);
    
    if (!state) {
      return res.status(404).json({ 
        error: 'No active onboarding session',
        code: 'NOT_FOUND'
      });
    }
    
    // Return current state (without sensitive data)
    res.json({
      tenantId,
      currentStep: state.step,
      completedSteps: state.completedSteps,
      organizationDetails: state.organizationDetails,
      genesysConfigured: !!state.genesysConfig?.validated,
      whatsappConfigured: !!state.whatsappConfig?.validated,
      createdAt: state.createdAt,
      lastUpdated: state.lastUpdated
    });
    
  } catch (error) {
    logger.error('Failed to retrieve onboarding status', {
      error: error.message,
      tenantId
    });
    
    res.status(500).json({ error: 'Failed to retrieve status' });
  }
});
```

---

# 7. Dashboard & Metrics

## 7.1 Overview (REQ-PORTAL-03)

**Purpose**: Aggregate and display tenant-specific metrics

**Data Source**: State Manager (authoritative source)  
**Caching Strategy**: Cache-aside pattern with Redis (5-15 min TTL)  
**Refresh**: Manual refresh endpoint to clear cache

## 7.2 Get Dashboard Stats

**Endpoint**: `GET /api/v1/dashboard/stats`

**Query Parameters**:
```
period: 'today' | 'week' | 'month' (default: 'today')
```

**Response**:
```json
{
  "totalMessages": 1000,
  "sentCount": 950,
  "deliveredCount": 920,
  "readCount": 850,
  "failedCount": 30,
  "successRate": "92.0",
  "activeConversations": 45,
  "uniqueCustomers": 38,
  "period": "today",
  "lastUpdated": "2026-02-12T08:30:00Z"
}
```

**Implementation**:
```javascript
router.get('/dashboard/stats', requireAuth, async (req, res) => {
  const { tenantId } = req.session;
  const { period = 'today' } = req.query;
  
  // Validate period parameter
  const validPeriods = ['today', 'week', 'month'];
  if (!validPeriods.includes(period)) {
    return res.status(400).json({ 
      error: 'Invalid period',
      validValues: validPeriods
    });
  }
  
  try {
    // 1. Check cache first
    const cacheKey = `metrics:${tenantId}:${period}`;
    const cached = await redis.getCachedMetrics(tenantId, period);
    
    if (cached) {
      logger.debug('Metrics cache hit', {
        tenantId,
        period,
        cachedAt: cached.calculatedAt
      });
      
      return res.json(cached);
    }
    
    // 2. Cache miss - fetch from State Manager
    logger.info('Fetching metrics from State Manager', {
      tenantId,
      period
    });
    
    const rawMetrics = await stateManager.getMetrics(tenantId, period);
    
    // 3. Calculate aggregates
    const stats = {
      totalMessages: rawMetrics.totalMessages,
      sentCount: rawMetrics.sent,
      deliveredCount: rawMetrics.delivered,
      readCount: rawMetrics.read,
      failedCount: rawMetrics.failed,
      successRate: calculateSuccessRate(
        rawMetrics.delivered,
        rawMetrics.totalMessages
      ),
      activeConversations: rawMetrics.activeConversations,
      uniqueCustomers: rawMetrics.distinctWaIds,
      period,
      lastUpdated: new Date().toISOString()
    };
    
    // 4. Cache result
    await redis.cacheMetrics(tenantId, period, stats);
    
    logger.info('Metrics calculated and cached', {
      tenantId,
      period,
      totalMessages: stats.totalMessages,
      successRate: stats.successRate
    });
    
    res.json(stats);
    
  } catch (error) {
    logger.error('Dashboard stats error', {
      error: error.message,
      tenantId,
      period
    });
    
    // Return graceful error response
    res.status(500).json({ 
      error: 'Failed to retrieve dashboard stats',
      message: 'Unable to fetch metrics at this time'
    });
  }
});

/**
 * Calculate success rate percentage
 */
function calculateSuccessRate(delivered, total) {
  if (total === 0) return "0.0";
  
  const rate = (delivered / total) * 100;
  return rate.toFixed(1); // One decimal place
}
```

## 7.3 Manual Refresh

**Endpoint**: `POST /api/v1/dashboard/refresh`

**Purpose**: Clear cached metrics to force fresh data fetch

**Implementation**:
```javascript
router.post('/dashboard/refresh', requireAuth, async (req, res) => {
  const { tenantId } = req.session;
  
  try {
    // Clear all metric caches for this tenant
    await redis.clearMetricsCache(tenantId);
    
    logger.info('Metrics cache cleared', {
      tenantId,
      triggeredBy: req.userId
    });
    
    res.json({ 
      success: true,
      message: 'Cache cleared. Next request will fetch fresh data.'
    });
    
  } catch (error) {
    logger.error('Cache clear failed', {
      error: error.message,
      tenantId
    });
    
    res.status(500).json({ 
      error: 'Failed to clear cache'
    });
  }
});
```

## 7.4 Metrics by Date Range

**Endpoint**: `GET /api/v1/dashboard/metrics/range`

**Query Parameters**:
```
startDate: ISO date string (e.g., '2026-02-01')
endDate: ISO date string (e.g., '2026-02-12')
```

**Implementation**:
```javascript
router.get('/dashboard/metrics/range', requireAuth, async (req, res) => {
  const { tenantId } = req.session;
  const { startDate, endDate } = req.query;
  
  try {
    // Validate dates
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate required'
      });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use ISO 8601 (YYYY-MM-DD)'
      });
    }
    
    if (start > end) {
      return res.status(400).json({ 
        error: 'startDate must be before endDate'
      });
    }
    
    // Fetch from State Manager
    const metrics = await stateManager.getMetrics(tenantId, {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    });
    
    res.json({
      tenantId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      metrics
    });
    
  } catch (error) {
    logger.error('Date range metrics error', {
      error: error.message,
      tenantId
    });
    
    res.status(500).json({ 
      error: 'Failed to retrieve metrics'
    });
  }
});
```

---

# 8. Conversation Management

## 8.1 List Conversations (REQ-PORTAL-04)

**Endpoint**: `GET /api/v1/history/threads`

**Query Parameters**:
```
page: number (default: 1)
limit: number (default: 20, max: 100)
status: 'active' | 'closed' (optional)
```

**Response**:
```json
{
  "data": [
    {
      "wa_id": "1234567890",
      "conversation_id": "conv_uuid",
      "last_activity": "2026-02-12T08:25:00Z",
      "status": "active",
      "message_count": 15
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Implementation**:
```javascript
router.get('/history/threads', requireAuth, async (req, res) => {
  const { tenantId } = req.session;
  const { 
    page = 1, 
    limit = 20, 
    status 
  } = req.query;
  
  try {
    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (pageNum < 1) {
      return res.status(400).json({ 
        error: 'page must be >= 1'
      });
    }
    
    if (limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ 
        error: 'limit must be between 1 and 100'
      });
    }
    
    // Validate status filter
    if (status && !['active', 'closed'].includes(status)) {
      return res.status(400).json({ 
        error: 'status must be "active" or "closed"'
      });
    }
    
    // Check cache
    const cacheKey = `conversations:${tenantId}:${pageNum}:${limitNum}:${status || 'all'}`;
    // Note: Simplified - actual implementation would check Redis
    
    // Fetch from State Manager
    logger.info('Fetching conversations', {
      tenantId,
      page: pageNum,
      limit: limitNum,
      status
    });
    
    const threads = await stateManager.getConversations(tenantId, {
      page: pageNum,
      limit: limitNum,
      ...(status && { status })
    });
    
    // Format response
    const response = {
      data: threads.data.map(thread => ({
        wa_id: thread.wa_id,
        conversation_id: thread.conversation_id,
        last_activity: thread.last_activity,
        status: thread.status,
        message_count: thread.message_count
      })),
      pagination: {
        page: threads.page,
        limit: threads.limit,
        total: threads.total,
        totalPages: Math.ceil(threads.total / threads.limit)
      }
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Failed to fetch conversations', {
      error: error.message,
      tenantId
    });
    
    res.status(500).json({ 
      error: 'Failed to retrieve conversations'
    });
  }
});
```

## 8.2 Get Conversation Messages

**Endpoint**: `GET /api/v1/history/threads/:id/messages`

**Response**:
```json
{
  "conversation_id": "conv_uuid",
  "wa_id": "1234567890",
  "messages": [
    {
      "message_id": "msg_uuid",
      "direction": "inbound",
      "text": "Hello, I need help",
      "media_url": null,
      "status": "read",
      "timestamp": "2026-02-12T08:20:00Z",
      "error": null
    }
  ]
}
```

**Implementation**:
```javascript
router.get('/history/threads/:id/messages', requireAuth, async (req, res) => {
  const { tenantId } = req.session;
  const { id: conversationId } = req.params;
  
  try {
    // 1. Verify conversation belongs to tenant
    const conversation = await stateManager.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ 
        error: 'Conversation not found',
        code: 'NOT_FOUND'
      });
    }
    
    if (conversation.tenant_id !== tenantId) {
      logger.warn('Tenant isolation violation attempt', {
        tenantId,
        conversationTenantId: conversation.tenant_id,
        conversationId
      });
      
      return res.status(403).json({ 
        error: 'Access denied',
        code: 'TENANT_MISMATCH'
      });
    }
    
    // 2. Fetch messages
    logger.info('Fetching conversation messages', {
      tenantId,
      conversationId,
      waId: conversation.wa_id
    });
    
    const messages = await stateManager.getMessages(conversationId);
    
    // 3. Format response
    const response = {
      conversation_id: conversationId,
      wa_id: conversation.wa_id,
      messages: messages.map(msg => ({
        message_id: msg.message_id,
        direction: msg.direction,
        text: msg.text,
        media_url: msg.media_url || null,
        status: msg.status,
        timestamp: msg.timestamp,
        error: msg.error || null
      }))
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Failed to fetch messages', {
      error: error.message,
      tenantId,
      conversationId
    });
    
    res.status(500).json({ 
      error: 'Failed to retrieve messages'
    });
  }
});
```

---

# 9. Agent Widget Integration

## 9.1 Overview (REQ-PORTAL-05)

**Purpose**: Support embedded Agent Interaction Widget in Genesys

**Responsibilities**:
- Validate conversation ownership
- Provide fallback message send endpoint
- Confirm tenant context

## 9.2 Widget Message Send

**Endpoint**: `POST /api/v1/widget/send`

**Request Body**:
```json
{
  "conversationId": "conv_uuid",
  "text": "Agent response message",
  "mediaUrl": "https://example.com/image.jpg" // optional
}
```

**Implementation**:
```javascript
router.post('/widget/send', requireAuth, async (req, res) => {
  const { tenantId, userId } = req.session;
  const { conversationId, text, mediaUrl } = req.body;
  
  try {
    // 1. Validate input
    if (!conversationId || !text) {
      return res.status(400).json({ 
        error: 'conversationId and text required'
      });
    }
    
    if (text.length > 4096) {
      return res.status(400).json({ 
        error: 'text must be <= 4096 characters'
      });
    }
    
    // 2. Verify conversation belongs to tenant
    const conversation = await stateManager.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ 
        error: 'Conversation not found'
      });
    }
    
    if (conversation.tenant_id !== tenantId) {
      logger.warn('Widget send - tenant mismatch', {
        tenantId,
        conversationTenantId: conversation.tenant_id,
        userId
      });
      
      return res.status(403).json({ 
        error: 'Access denied'
      });
    }
    
    // 3. Generate message ID
    const messageId = `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    // 4. Publish to outbound message queue
    const messagePayload = {
      message_id: messageId,
      tenant_id: tenantId,
      conversation_id: conversationId,
      wa_id: conversation.wa_id,
      text,
      ...(mediaUrl && { media_url: mediaUrl }),
      source: 'widget',
      agent_id: userId,
      timestamp: new Date().toISOString()
    };
    
    await messageBus.publish('outbound.message', messagePayload);
    
    logger.info('Widget message queued', {
      messageId,
      conversationId,
      tenantId,
      agentId: userId
    });
    
    res.json({
      success: true,
      message_id: messageId,
      status: 'queued',
      queued_at: messagePayload.timestamp
    });
    
  } catch (error) {
    logger.error('Widget send error', {
      error: error.message,
      conversationId,
      tenantId
    });
    
    res.status(500).json({ 
      error: 'Failed to send message'
    });
  }
});

// Message Bus Client (simplified)
class MessageBusClient {
  async publish(topic, message) {
    // Implementation depends on message broker (RabbitMQ, Kafka, etc.)
    // This is a placeholder
    logger.debug('Publishing message', { topic, messageId: message.message_id });
  }
}

const messageBus = new MessageBusClient();
```

---

# 10. Real-time Monitoring

## 10.1 Overview (REQ-PORTAL-05)

**Purpose**: Stream live message updates via WebSocket

**Technology**: Socket.IO  
**Namespace Pattern**: `/tenant/{tenantId}/portal`  
**Events**: `message_update`, `status_update`

## 10.2 WebSocket Server Setup

```javascript
const { Server } = require('socket.io');
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  }
});

// Dynamic namespace for each tenant
io.of(/^\/tenant\/[\w-]+\/portal$/).use(async (socket, next) => {
  // 1. Authenticate WebSocket connection
  const sessionId = socket.handshake.auth.sessionId;
  
  if (!sessionId) {
    return next(new Error('Authentication required'));
  }
  
  // 2. Validate session
  const sessionData = await redis.getSession(sessionId);
  
  if (!sessionData) {
    return next(new Error('Invalid or expired session'));
  }
  
  // 3. Extract tenant ID from namespace
  const namespacePath = socket.nsp.name; // e.g., "/tenant/123/portal"
  const namespaceTenantId = namespacePath.split('/')[2];
  
  // 4. Verify tenant match
  if (namespaceTenantId !== sessionData.tenantId) {
    logger.warn('WebSocket tenant mismatch', {
      namespaceTenant: namespaceTenantId,
      sessionTenant: sessionData.tenantId,
      userId: sessionData.userId
    });
    
    return next(new Error('Access denied - tenant mismatch'));
  }
  
  // 5. Attach session to socket
  socket.session = sessionData;
  socket.tenantId = sessionData.tenantId;
  
  logger.info('WebSocket authenticated', {
    tenantId: socket.tenantId,
    userId: socket.session.userId,
    socketId: socket.id
  });
  
  next();
});

// Handle connections
io.of(/^\/tenant\/[\w-]+\/portal$/).on('connection', (socket) => {
  const { tenantId, session } = socket;
  
  logger.info('Portal monitoring connected', {
    tenantId,
    userId: session.userId,
    socketId: socket.id
  });
  
  // Subscribe to message bus for this tenant
  const messageSubscription = messageBus.subscribe(
    `tenant.${tenantId}.messages`,
    (message) => {
      socket.emit('message_update', {
        type: message.direction,
        conversation_id: message.conversation_id,
        message_id: message.message_id,
        text: message.text,
        status: message.status,
        timestamp: message.timestamp
      });
    }
  );
  
  // Subscribe to status updates
  const statusSubscription = messageBus.subscribe(
    `tenant.${tenantId}.status`,
    (update) => {
      socket.emit('status_update', {
        message_id: update.message_id,
        status: update.status,
        timestamp: update.timestamp
      });
    }
  );
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    logger.info('Portal monitoring disconnected', {
      tenantId,
      userId: session.userId,
      socketId: socket.id,
      reason
    });
    
    // Clean up subscriptions
    messageSubscription.unsubscribe();
    statusSubscription.unsubscribe();
  });
  
  // Handle errors
  socket.on('error', (error) => {
    logger.error('WebSocket error', {
      tenantId,
      error: error.message,
      socketId: socket.id
    });
  });
});
```

## 10.3 Frontend WebSocket Client Example

```javascript
// Frontend connection example
import io from 'socket.io-client';

// Get session ID from cookie
const sessionId = getCookie('sessionId');
const tenantId = getCurrentTenantId();

// Connect to tenant-specific namespace
const socket = io(`wss://api.example.com/tenant/${tenantId}/portal`, {
  auth: {
    sessionId: sessionId
  },
  transports: ['websocket', 'polling']
});

// Listen for message updates
socket.on('message_update', (data) => {
  console.log('New message:', data);
  
  // Update UI
  if (data.type === 'inbound') {
    addInboundMessage(data);
  } else {
    addOutboundMessage(data);
  }
});

// Listen for status updates
socket.on('status_update', (data) => {
  console.log('Status update:', data);
  
  // Update message status in UI
  updateMessageStatus(data.message_id, data.status);
});

// Handle connection events
socket.on('connect', () => {
  console.log('Connected to monitoring service');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
```

---

# 11. API Specification

## 11.1 Complete Endpoint List

### Authentication Endpoints

```
GET  /api/v1/auth/login          Initiate Genesys SSO
GET  /api/v1/auth/callback       OAuth callback handler
POST /api/v1/auth/refresh        Refresh access token
POST /api/v1/auth/logout         End session
```

### Onboarding Endpoints

```
POST /api/v1/onboarding/step1    Organization details
POST /api/v1/onboarding/step2    Genesys configuration
POST /api/v1/onboarding/step3    WhatsApp configuration
GET  /api/v1/onboarding/validate Test integrations
POST /api/v1/onboarding/complete Finalize & generate webhooks
GET  /api/v1/onboarding/status/:tenantId Resume onboarding
```

### Dashboard Endpoints

```
GET  /api/v1/dashboard/stats        Aggregated metrics
POST /api/v1/dashboard/refresh      Clear metric cache
GET  /api/v1/dashboard/metrics/range Metrics by date range
```

### History Endpoints

```
GET  /api/v1/history/threads              List conversations
GET  /api/v1/history/threads/:id/messages Fetch messages
```

### Widget Endpoints

```
POST /api/v1/widget/send          Fallback message send
```

### WebSocket Namespace

```
/tenant/:tenantId/portal          Real-time monitoring
```

## 11.2 Error Response Format

**Standard Error Response**:
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    // Optional additional context
  }
}
```

**Common Error Codes**:
```
NO_SESSION             - Session cookie missing
SESSION_EXPIRED        - Session expired or invalid
AUTH_ERROR             - Authentication service error
TENANT_MISMATCH        - Tenant isolation violation
VALIDATION_FAILED      - Input validation failed
NOT_FOUND              - Resource not found
RATE_LIMIT_EXCEEDED    - Too many requests
INTERNAL_ERROR         - Unexpected server error
```

---

# 12. Security Implementation

## 12.1 Security Checklist

```javascript
const SECURITY_REQUIREMENTS = {
  // 1. Session Security
  session: {
    httpOnly: true,              // âœ… Prevent XSS
    secure: true,                // âœ… HTTPS only
    sameSite: 'strict',          // âœ… CSRF protection
    signed: true,                // âœ… Cookie signing
    maxAge: 86400000             // âœ… 24 hour expiration
  },
  
  // 2. CSRF Protection
  csrf: {
    enabled: true,
    tokenLength: 32,
    headerName: 'X-CSRF-Token'
  },
  
  // 3. Rate Limiting
  rateLimit: {
    onboarding: {
      windowMs: 15 * 60 * 1000,  // 15 minutes
      max: 5                      // 5 attempts per window
    },
    api: {
      windowMs: 60 * 1000,        // 1 minute
      max: 100                    // 100 requests per window
    },
    auth: {
      windowMs: 15 * 60 * 1000,   // 15 minutes
      max: 10                     // 10 login attempts
    }
  },
  
  // 4. Encryption
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,                // 256 bits
    ivLength: 16,                 // 128 bits
    tagLength: 16                 // 128 bits
  },
  
  // 5. Headers
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'"
  }
};
```

## 12.2 Rate Limiting Implementation

```javascript
const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,           // 1 minute
  max: 100,                      // 100 requests per window
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,          // Return rate limit info in headers
  legacyHeaders: false
});

// Onboarding rate limiter (stricter)
const onboardingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,      // 15 minutes
  max: 5,                        // 5 requests per window
  skipSuccessfulRequests: true,  // Don't count successful requests
  message: {
    error: 'Too many onboarding attempts',
    code: 'ONBOARDING_RATE_LIMIT',
    retryAfter: '15 minutes'
  }
});

// Auth rate limiter (strictest)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,      // 15 minutes
  max: 10,                       // 10 attempts per window
  skipSuccessfulRequests: false, // Count all attempts
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMIT',
    retryAfter: '15 minutes'
  }
});

// Apply to routes
app.use('/api/v1', apiLimiter);
app.use('/api/v1/onboarding', onboardingLimiter);
app.use('/api/v1/auth', authLimiter);
```

## 12.3 Input Validation

```javascript
const Joi = require('joi');

// Validation schemas
const schemas = {
  onboardingStep1: Joi.object({
    companyName: Joi.string().min(2).max(100).required(),
    region: Joi.string().valid(
      'us-east-1', 'us-east-2', 'us-west-2',
      'eu-west-1', 'eu-central-1',
      'ap-southeast-2', 'ap-northeast-1'
    ).required(),
    contactEmail: Joi.string().email().required()
  }),
  
  onboardingStep2: Joi.object({
    tenantId: Joi.string().uuid().required(),
    clientId: Joi.string().min(10).max(100).required(),
    clientSecret: Joi.string().min(10).max(200).required(),
    region: Joi.string().required()
  }),
  
  widgetSend: Joi.object({
    conversationId: Joi.string().uuid().required(),
    text: Joi.string().min(1).max(4096).required(),
    mediaUrl: Joi.string().uri().optional()
  })
};

// Validation middleware
function validateRequest(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }
    
    // Replace body with validated/sanitized value
    req.body = value;
    next();
  };
}

// Usage
router.post('/onboarding/step1', 
  requireAuth,
  validateRequest(schemas.onboardingStep1),
  async (req, res) => {
    // req.body is now validated and sanitized
    // ...
  }
);
```

## 12.4 Security Headers

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.ALLOWED_WEBSOCKET_ORIGIN]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  noSniff: true,
  xssFilter: true
}));
```

---

# 13. Performance & Scalability

## 13.1 Caching Strategy

```javascript
const CACHE_CONFIG = {
  // TTL values in seconds
  ttl: {
    session: 86400,        // 24 hours
    metrics: 600,          // 10 minutes
    conversations: 300,    // 5 minutes
    onboarding: 3600       // 1 hour
  },
  
  // Cache invalidation triggers
  invalidate: {
    metrics: [
      'message.sent',
      'message.delivered',
      'message.failed'
    ],
    conversations: [
      'conversation.created',
      'conversation.closed',
      'message.received'
    ]
  }
};

// Cache invalidation on events
messageBus.subscribe('message.sent', async (event) => {
  const { tenantId } = event;
  await redis.clearMetricsCache(tenantId);
});
```

## 13.2 Pagination

```javascript
const PAGINATION_CONFIG = {
  defaultLimit: 20,
  maxLimit: 100,
  defaultPage: 1
};

function paginateQuery(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(
    PAGINATION_CONFIG.maxLimit,
    Math.max(1, parseInt(req.query.limit) || PAGINATION_CONFIG.defaultLimit)
  );
  
  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
}

function paginateResponse(data, total, page, limit) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  };
}
```

## 13.3 Circuit Breaker

```javascript
const CircuitBreaker = require('opossum');

// Circuit breaker for State Manager
const stateManagerBreaker = new CircuitBreaker(
  async (tenantId, options) => {
    return await stateManager.getMetrics(tenantId, options);
  },
  {
    timeout: 5000,          // 5 second timeout
    errorThresholdPercentage: 50,  // Open after 50% failures
    resetTimeout: 30000,    // Try again after 30 seconds
    fallback: (tenantId) => {
      logger.warn('State Manager circuit open, using fallback', { tenantId });
      return {
        totalMessages: 0,
        error: 'Service temporarily unavailable'
      };
    }
  }
);

// Usage
router.get('/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const metrics = await stateManagerBreaker.fire(
      req.tenantId,
      { period: req.query.period }
    );
    res.json(metrics);
  } catch (error) {
    res.status(503).json({ 
      error: 'Service temporarily unavailable'
    });
  }
});
```

---

# 14. Error Handling & Resilience

## 14.1 Global Error Handler

```javascript
// Error handler middleware (must be last)
function errorHandler(err, req, res, next) {
  const correlationId = req.id;
  
  // Log error with context
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    tenantId: req.session?.tenantId,
    userId: req.session?.userId,
    correlationId
  });
  
  // Don't expose internal errors to client
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      correlationId
    });
  }
  
  // Generic error response
  res.status(500).json({
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    correlationId
  });
}

// Custom API Error class
class ApiError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Usage
throw new ApiError(404, 'Conversation not found', 'NOT_FOUND');
```

## 14.2 Retry Logic

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      
      logger.warn('Retry attempt', {
        attempt,
        maxRetries,
        delay,
        error: error.message
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Usage
const metrics = await retryWithBackoff(async () => {
  return await stateManager.getMetrics(tenantId, period);
});
```

---

# 15. Observability

## 15.1 Logging

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'agent-portal-service',
    environment: process.env.NODE_ENV
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Structured logging
logger.info('Session created', {
  sessionId: 'sess_abc',
  userId: 'user_123',
  tenantId: 'tenant_456',
  correlationId: req.id
});
```

## 15.2 Metrics (Prometheus)

```javascript
const promClient = require('prom-client');

// Register default metrics
promClient.collectDefaultMetrics();

// Custom metrics
const metrics = {
  activeSessions: new promClient.Gauge({
    name: 'portal_active_sessions_total',
    help: 'Number of active user sessions'
  }),
  
  apiLatency: new promClient.Histogram({
    name: 'portal_api_latency_seconds',
    help: 'API endpoint latency',
    labelNames: ['method', 'path', 'status']
  }),
  
  onboardingCompletions: new promClient.Counter({
    name: 'portal_onboarding_completions_total',
    help: 'Number of completed onboardings',
    labelNames: ['status']
  }),
  
  cacheHits: new promClient.Counter({
    name: 'portal_cache_hits_total',
    help: 'Cache hit/miss count',
    labelNames: ['cache_type', 'result']
  })
};

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// Usage in code
const end = metrics.apiLatency.startTimer();
// ... do work ...
end({ method: req.method, path: req.path, status: res.statusCode });
```

---

# 16. Implementation Guide

## 16.1 Project Structure

```
agent-portal-service/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ controllers/
â”‚   â”‚   â”œâ”€â”€ auth.controller.js
â”‚   â”‚   â”œâ”€â”€ onboarding.controller.js
â”‚   â”‚   â”œâ”€â”€ dashboard.controller.js
â”‚   â”‚   â”œâ”€â”€ history.controller.js
â”‚   â”‚   â””â”€â”€ widget.controller.js
â”‚   â”œâ”€â”€ middleware/
â”‚   â”‚   â”œâ”€â”€ auth.middleware.js
â”‚   â”‚   â”œâ”€â”€ validation.middleware.js
â”‚   â”‚   â”œâ”€â”€ rateLimit.middleware.js
â”‚   â”‚   â””â”€â”€ errorHandler.middleware.js
â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”œâ”€â”€ authService.client.js
â”‚   â”‚   â”œâ”€â”€ tenantService.client.js
â”‚   â”‚   â”œâ”€â”€ stateManager.client.js
â”‚   â”‚   â””â”€â”€ redis.client.js
â”‚   â”œâ”€â”€ utils/
â”‚   â”‚   â”œâ”€â”€ encryption.js
â”‚   â”‚   â”œâ”€â”€ validation.js
â”‚   â”‚   â””â”€â”€ logger.js
â”‚   â”œâ”€â”€ websocket/
â”‚   â”‚   â””â”€â”€ monitoring.namespace.js
â”‚   â”œâ”€â”€ routes/
â”‚   â”‚   â””â”€â”€ index.js
â”‚   â””â”€â”€ server.js
â”œâ”€â”€ config/
â”‚   â”œâ”€â”€ default.js
â”‚   â”œâ”€â”€ production.js
â”‚   â””â”€â”€ test.js
â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ unit/
â”‚   â”œâ”€â”€ integration/
â”‚   â””â”€â”€ e2e/
â”œâ”€â”€ .env.example
â”œâ”€â”€ .gitignore
â”œâ”€â”€ package.json
â”œâ”€â”€ README.md
â””â”€â”€ Dockerfile
```

## 16.2 Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3000
BASE_URL=https://api.example.com

# Genesys OAuth
GENESYS_CLIENT_ID=your_client_id
GENESYS_REDIRECT_URI=https://api.example.com/api/v1/auth/callback

# Service URLs
AUTH_SERVICE_URL=http://auth-service:8080
TENANT_SERVICE_URL=http://tenant-service:8080
STATE_MANAGER_URL=http://state-manager:8080

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# Security
ENCRYPTION_KEY=your_256_bit_hex_key
COOKIE_SECRET=your_cookie_secret
COOKIE_DOMAIN=.example.com

# Logging
LOG_LEVEL=info

# Frontend
FRONTEND_URL=https://portal.example.com
```

## 16.3 Deployment Checklist

- [ ] Environment variables configured
- [ ] Redis connection established
- [ ] Service endpoints verified
- [ ] HTTPS/TLS certificates installed
- [ ] Rate limiting enabled
- [ ] CORS configured correctly
- [ ] Security headers enabled
- [ ] Logging configured
- [ ] Metrics endpoint exposed
- [ ] Health check endpoint responding
- [ ] Horizontal scaling tested
- [ ] Circuit breakers configured
- [ ] Session persistence verified
- [ ] WebSocket connections tested

---

## Appendix A: Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env

# Run database migrations (if any)
npm run migrate

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

## Appendix B: Health Check Endpoint

```javascript
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };
  
  // Check Redis
  try {
    await redis.client.ping();
    health.checks.redis = 'ok';
  } catch (error) {
    health.checks.redis = 'error';
    health.status = 'degraded';
  }
  
  // Check Auth Service
  try {
    await axios.get(`${AUTH_SERVICE_URL}/health`, { timeout: 2000 });
    health.checks.authService = 'ok';
  } catch (error) {
    health.checks.authService = 'error';
    health.status = 'degraded';
  }
  
  // Check Tenant Service
  try {
    await axios.get(`${TENANT_SERVICE_URL}/health`, { timeout: 2000 });
    health.checks.tenantService = 'ok';
  } catch (error) {
    health.checks.tenantService = 'error';
    health.status = 'degraded';
  }
  
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

---

**Document Version**: 2.0 (Enhanced for Claude Code)  
**Optimized For**: Complete implementation, code generation, system understanding  
**Total Sections**: 16 major sections with complete code examples  
**Lines of Code**: 2000+ lines of production-ready implementations
--- END agent-portal-service/portal-backend-frd.md ---


--- BEGIN agent-portal/customer-portal-frd.md ---

# Agent Portal Frontend - LLM-Optimized Technical Specification

**Version:** 1.0 (MVP+)  
**Service:** agent-portal (React Frontend)  
**Last Updated:** 2026-02-12  
**Purpose:** Complete technical specification for LLM-assisted code generation and debugging

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Technical Stack & Dependencies](#2-technical-stack--dependencies)
3. [Project Structure](#3-project-structure)
4. [Data Models & Type Definitions](#4-data-models--type-definitions)
5. [Authentication System](#5-authentication-system)
6. [Feature Specifications](#6-feature-specifications)
7. [API Integration Layer](#7-api-integration-layer)
8. [State Management Strategy](#8-state-management-strategy)
9. [UI Component Library](#9-ui-component-library)
10. [Error Handling & Validation](#10-error-handling--validation)
11. [Security Implementation](#11-security-implementation)
12. [Performance Optimization](#12-performance-optimization)
13. [Testing Strategy](#13-testing-strategy)
14. [Deployment & Configuration](#14-deployment--configuration)

---

## 1. SYSTEM OVERVIEW

### 1.1 Application Purpose

The Agent Portal is a **multi-tenant administrative web application** that serves as the control plane for managing integrations between:
- **Genesys Cloud** (Contact Center Platform)
- **WhatsApp Business Platform** (Messaging Channel)
- **XYPR Middleware** (Integration Layer)

### 1.2 Core User Workflows

```
WORKFLOW 1: Initial Setup
User → Login (Genesys SSO) → Onboarding Wizard → Integration Validation → Active Dashboard

WORKFLOW 2: Daily Operations
User → Login → Dashboard → View Conversations → Monitor Health → Review Logs

WORKFLOW 3: Maintenance
User → Settings → Update Credentials → Rotate Secrets → Audit Verification
```

### 1.3 Architecture Context

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Portal Frontend                     │
│                    (React Application)                       │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP/REST
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              agent-portal-service (Backend)                  │
│              Base URL: http://localhost:3000                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌──────────────┐      ┌──────────────┐
│  Genesys     │      │  WhatsApp    │
│  Cloud       │      │  Business    │
└──────────────┘      └──────────────┘
```

---

## 2. TECHNICAL STACK & DEPENDENCIES

### 2.1 Core Dependencies (package.json)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.17.0",
    "react-hook-form": "^7.49.0",
    "zod": "^3.22.4",
    "@hookform/resolvers": "^3.3.3",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-tooltip": "^1.0.7",
    "lucide-react": "^0.303.0",
    "recharts": "^2.10.3",
    "axios": "^1.6.5",
    "date-fns": "^3.0.6",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.11",
    "tailwindcss": "^3.4.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.33",
    "typescript": "^5.3.3",
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "eslint": "^8.56.0",
    "prettier": "^3.1.1"
  }
}
```

### 2.2 Build Tool Configuration

**Vite Configuration (vite.config.ts)**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/api': path.resolve(__dirname, './src/api'),
      '@/contexts': path.resolve(__dirname, './src/contexts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'query': ['@tanstack/react-query'],
          'forms': ['react-hook-form', 'zod'],
          'charts': ['recharts'],
        },
      },
    },
  },
})
```

**Tailwind Configuration (tailwind.config.js)**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
      },
      spacing: {
        // 4px grid system
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
      },
    },
  },
  plugins: [],
}
```

---

## 3. PROJECT STRUCTURE

### 3.1 Directory Tree

```
agent-portal/
├── public/
│   ├── favicon.ico
│   └── logo.svg
├── src/
│   ├── api/                    # API client layer
│   │   ├── client.ts          # Axios instance configuration
│   │   ├── auth.ts            # Authentication endpoints
│   │   ├── onboarding.ts      # Onboarding endpoints
│   │   ├── analytics.ts       # Analytics endpoints
│   │   ├── conversations.ts   # Conversation endpoints
│   │   └── settings.ts        # Settings endpoints
│   ├── components/            # React components
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── CallbackHandler.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── onboarding/
│   │   │   ├── OnboardingWizard.tsx
│   │   │   ├── StepIndicator.tsx
│   │   │   ├── Step1Organization.tsx
│   │   │   ├── Step2Genesys.tsx
│   │   │   ├── Step3WhatsApp.tsx
│   │   │   ├── Step4ConnectivityTest.tsx
│   │   │   └── Step5WebhookDeployment.tsx
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── KPICard.tsx
│   │   │   ├── MessageVolumeChart.tsx
│   │   │   ├── DeliverySuccessChart.tsx
│   │   │   └── TokenExpiryIndicator.tsx
│   │   ├── conversations/
│   │   │   ├── ConversationList.tsx
│   │   │   ├── ConversationTable.tsx
│   │   │   ├── ConversationDetailDrawer.tsx
│   │   │   ├── ConversationFilters.tsx
│   │   │   └── WidgetEmbed.tsx
│   │   ├── settings/
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── CredentialManager.tsx
│   │   │   ├── WebhookSecretRotation.tsx
│   │   │   └── RegionalSettings.tsx
│   │   ├── ui/                # Reusable UI primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Drawer.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Badge.tsx
│   │   └── layout/
│   │       ├── AppLayout.tsx
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       └── Footer.tsx
│   ├── contexts/              # React contexts
│   │   ├── AuthContext.tsx
│   │   └── UIContext.tsx
│   ├── hooks/                 # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useOnboarding.ts
│   │   ├── useAnalytics.ts
│   │   ├── useConversations.ts
│   │   └── useToast.ts
│   ├── lib/                   # Utilities
│   │   ├── utils.ts           # General utilities
│   │   ├── validators.ts      # Zod schemas
│   │   ├── constants.ts       # App constants
│   │   └── queryClient.ts     # React Query config
│   ├── types/                 # TypeScript definitions
│   │   ├── auth.ts
│   │   ├── onboarding.ts
│   │   ├── analytics.ts
│   │   ├── conversation.ts
│   │   └── api.ts
│   ├── App.tsx                # Root component
│   ├── main.tsx               # Entry point
│   └── index.css              # Global styles
├── .env.example
├── .env.development
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

### 3.2 File Naming Conventions

- **Components:** PascalCase (e.g., `UserProfile.tsx`)
- **Hooks:** camelCase with `use` prefix (e.g., `useAuth.ts`)
- **Utilities:** camelCase (e.g., `formatDate.ts`)
- **Types:** PascalCase for interfaces/types (e.g., `User`, `ApiResponse`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)

---

## 4. DATA MODELS & TYPE DEFINITIONS

### 4.1 Authentication Types (src/types/auth.ts)

```typescript
// User and Session Types
export interface User {
  id: string
  email: string
  name: string
  tenantId: string
  role: 'admin' | 'viewer'
  avatarUrl?: string
  createdAt: string
}

export interface AuthSession {
  user: User
  accessToken: string // Internal session JWT, NOT Genesys token
  expiresAt: number // Unix timestamp
  tenantId: string
}

export interface GenesysOAuthConfig {
  clientId: string
  region: GenesysRegion
  redirectUri: string
  scope: string[]
}

export type GenesysRegion = 
  | 'us-east-1'
  | 'us-west-2'
  | 'eu-west-1'
  | 'ap-southeast-2'
  | 'ca-central-1'

export interface GenesysAuthResponse {
  code: string
  state: string
}

// API Request/Response Types
export interface LoginInitiateResponse {
  authUrl: string
  state: string
}

export interface CallbackRequest {
  code: string
  state: string
}

export interface CallbackResponse {
  session: AuthSession
}
```

### 4.2 Onboarding Types (src/types/onboarding.ts)

```typescript
export interface OnboardingState {
  currentStep: number
  completedSteps: number[]
  formData: OnboardingFormData
  validationResults?: ValidationResults
}

export interface OnboardingFormData {
  organization: OrganizationProfile
  genesys: GenesysConfig
  whatsapp: WhatsAppConfig
}

export interface OrganizationProfile {
  companyName: string
  contactEmail: string
  supportPhone: string
  region: 'north-america' | 'europe' | 'asia-pacific' | 'latin-america'
}

export interface GenesysConfig {
  clientId: string
  clientSecret: string
  region: GenesysRegion
  environment: 'production' | 'test'
}

export interface WhatsAppConfig {
  wabaId: string // WhatsApp Business Account ID
  phoneNumberId: string
  systemUserToken: string
  appId?: string // Future-proofing
  tokenExpiresAt?: string // ISO 8601
}

export interface ValidationResults {
  genesys: ValidationResult
  whatsapp: ValidationResult
  webhook: ValidationResult
}

export interface ValidationResult {
  status: 'success' | 'error' | 'pending'
  message: string
  timestamp: string
  details?: Record<string, any>
}

export interface WebhookUrls {
  meta: string // /webhook/meta/{tenantId}
  genesys: string // /webhook/genesys/{tenantId}
  tenantId: string
}

// API Types
export interface SaveOnboardingRequest {
  step: number
  data: Partial<OnboardingFormData>
}

export interface ValidateIntegrationResponse {
  results: ValidationResults
  webhookUrls?: WebhookUrls
}
```

### 4.3 Analytics Types (src/types/analytics.ts)

```typescript
export interface DashboardMetrics {
  kpis: KPIMetrics
  charts: ChartData
  tokenStatus: TokenStatus
  lastUpdated: string
}

export interface KPIMetrics {
  totalMessages: TimeSeriesMetric
  activeConversations: number
  failedDeliveries: FailureMetric
  avgResponseTime?: number // Future metric
}

export interface TimeSeriesMetric {
  today: number
  last7Days: number
  last30Days: number
}

export interface FailureMetric {
  count: number
  percentage: number
  trend: 'up' | 'down' | 'stable'
}

export interface ChartData {
  messageVolume: MessageVolumeDataPoint[]
  deliverySuccess: DeliverySuccessDataPoint[]
}

export interface MessageVolumeDataPoint {
  timestamp: string // ISO 8601
  count: number
  direction: 'inbound' | 'outbound'
}

export interface DeliverySuccessDataPoint {
  date: string // YYYY-MM-DD
  success: number
  failed: number
}

export interface TokenStatus {
  whatsappToken: TokenInfo
  genesysToken: TokenInfo
}

export interface TokenInfo {
  expiresAt: string // ISO 8601
  daysRemaining: number
  status: 'healthy' | 'warning' | 'critical' // >30d, 7-30d, <7d
}
```

### 4.4 Conversation Types (src/types/conversation.ts)

```typescript
export interface Conversation {
  id: string
  waId: string // WhatsApp ID
  contactName: string
  conversationId: string // Genesys conversation ID
  lastActivity: string // ISO 8601
  status: ConversationStatus
  messageCount: number
  createdAt: string
  metadata?: Record<string, any>
}

export type ConversationStatus = 'active' | 'closed' | 'error'

export interface ConversationListParams {
  page: number
  pageSize: number
  search?: string
  status?: ConversationStatus
  sortBy?: 'lastActivity' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface ConversationListResponse {
  conversations: Conversation[]
  pagination: PaginationInfo
}

export interface PaginationInfo {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

export interface ConversationDetail extends Conversation {
  auditTrail: AuditEntry[]
  deliveryLogs: DeliveryLog[]
  widgetUrl: string
}

export interface AuditEntry {
  id: string
  timestamp: string
  event: string
  actor: string
  details: Record<string, any>
}

export interface DeliveryLog {
  id: string
  timestamp: string
  direction: 'inbound' | 'outbound'
  status: 'delivered' | 'failed' | 'pending'
  error?: string
  messageId: string
}
```

### 4.5 Settings Types (src/types/settings.ts)

```typescript
export interface TenantSettings {
  webhookSecret: string // Masked
  credentials: CredentialStatus
  regional: RegionalSettings
  features: FeatureFlags
}

export interface CredentialStatus {
  genesys: CredentialInfo
  whatsapp: CredentialInfo
}

export interface CredentialInfo {
  lastUpdated: string
  status: 'active' | 'expired' | 'expiring-soon'
  maskedValue: string
}

export interface RegionalSettings {
  dataResidency: string
  timezone: string
  locale: string
}

export interface FeatureFlags {
  darkMode: boolean // Future
  advancedAnalytics: boolean // Future
  multiUser: boolean // Future
}

export interface RotateSecretRequest {
  confirmationToken: string // Requires re-auth
}

export interface RotateSecretResponse {
  newSecret: string
  oldSecretValidUntil: string
  auditId: string
}

export interface UpdateCredentialRequest {
  credentialType: 'genesys-secret' | 'whatsapp-token'
  newValue: string
  confirmationToken: string
}
```

### 4.6 API Response Wrapper (src/types/api.ts)

```typescript
export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: ApiError
  timestamp: string
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
  statusCode: number
}

export interface ApiErrorResponse {
  success: false
  error: ApiError
  timestamp: string
}

// Type guards
export function isApiError(response: any): response is ApiErrorResponse {
  return response.success === false && 'error' in response
}
```

---

## 5. AUTHENTICATION SYSTEM

### 5.1 Genesys OAuth2 Flow (PKCE Required)

**Flow Diagram:**

```
┌─────────┐                ┌──────────┐                ┌─────────────┐
│ Browser │                │ Frontend │                │   Backend   │
└────┬────┘                └─────┬────┘                └──────┬──────┘
     │                           │                            │
     │  1. Click "Login"         │                            │
     ├──────────────────────────>│                            │
     │                           │                            │
     │                           │ 2. Generate PKCE           │
     │                           │    code_verifier           │
     │                           │    code_challenge          │
     │                           │                            │
     │                           │ 3. GET /auth/login/init    │
     │                           ├───────────────────────────>│
     │                           │                            │
     │                           │ 4. authUrl + state         │
     │                           │<───────────────────────────┤
     │                           │                            │
     │  5. Redirect to Genesys   │                            │
     │<──────────────────────────┤                            │
     │  + code_challenge         │                            │
     │                           │                            │
     │  6. User authenticates    │                            │
     │     on Genesys            │                            │
     │                           │                            │
     │  7. Redirect to /callback │                            │
     │     ?code=XXX&state=YYY   │                            │
     ├──────────────────────────>│                            │
     │                           │                            │
     │                           │ 8. POST /auth/callback     │
     │                           │    code, state, verifier   │
     │                           ├───────────────────────────>│
     │                           │                            │
     │                           │  9. Exchange code for token│
     │                           │     (with code_verifier)   │
     │                           │                            │
     │                           │ 10. Session JWT            │
     │                           │<───────────────────────────┤
     │                           │                            │
     │                           │ 11. Store in memory        │
     │                           │     Redirect to /dashboard │
     │                           │                            │
```

### 5.2 Auth Context Implementation (src/contexts/AuthContext.tsx)

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react'
import { User, AuthSession } from '@/types/auth'
import * as authApi from '@/api/auth'

interface AuthContextValue {
  user: User | null
  session: AuthSession | null
  isLoading: boolean
  isAuthenticated: boolean
  login: () => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    checkSession()
  }, [])

  // Auto-refresh session before expiry
  useEffect(() => {
    if (!session) return

    const timeUntilExpiry = session.expiresAt - Date.now()
    const refreshTime = timeUntilExpiry - 5 * 60 * 1000 // 5 minutes before expiry

    if (refreshTime <= 0) {
      refreshSession()
      return
    }

    const timer = setTimeout(() => {
      refreshSession()
    }, refreshTime)

    return () => clearTimeout(timer)
  }, [session])

  const checkSession = async () => {
    try {
      const currentSession = await authApi.getCurrentSession()
      setSession(currentSession)
    } catch (error) {
      setSession(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async () => {
    const { authUrl, state, codeVerifier } = await authApi.initiateLogin()
    
    // Store code_verifier in sessionStorage (only for PKCE flow)
    sessionStorage.setItem('pkce_verifier', codeVerifier)
    sessionStorage.setItem('oauth_state', state)
    
    // Redirect to Genesys
    window.location.href = authUrl
  }

  const logout = async () => {
    await authApi.logout()
    setSession(null)
    sessionStorage.clear()
  }

  const refreshSession = async () => {
    try {
      const newSession = await authApi.refreshSession()
      setSession(newSession)
    } catch (error) {
      // If refresh fails, logout
      await logout()
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user || null,
        session,
        isLoading,
        isAuthenticated: !!session,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

### 5.3 Protected Route Component (src/components/auth/ProtectedRoute.tsx)

```typescript
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
```

### 5.4 API Client with Auth (src/api/client.ts)

```typescript
import axios, { AxiosError, AxiosInstance } from 'axios'
import { ApiError, ApiResponse } from '@/types/api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true, // Important for HTTP-only cookies
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - Add tenant ID
apiClient.interceptors.request.use(
  (config) => {
    const tenantId = sessionStorage.getItem('tenantId')
    if (tenantId) {
      config.headers['X-Tenant-ID'] = tenantId
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    // Handle 401 - Unauthorized
    if (error.response?.status === 401) {
      // Clear session and redirect to login
      sessionStorage.clear()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // Handle 403 - Forbidden
    if (error.response?.status === 403) {
      // Show access denied message
      window.location.href = '/access-denied'
      return Promise.reject(error)
    }

    // Handle network errors
    if (!error.response) {
      return Promise.reject({
        code: 'NETWORK_ERROR',
        message: 'Network error. Please check your connection.',
        statusCode: 0,
      })
    }

    return Promise.reject(error.response.data.error)
  }
)

// Helper function for API calls with retry logic
export async function apiCall<T>(
  apiFunction: () => Promise<ApiResponse<T>>,
  retries = 3
): Promise<T> {
  let lastError: any

  for (let i = 0; i < retries; i++) {
    try {
      const response = await apiFunction()
      return response.data
    } catch (error) {
      lastError = error
      
      // Don't retry on 4xx errors (except 429)
      if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
        throw error
      }

      // Exponential backoff
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
      }
    }
  }

  throw lastError
}
```

---

## 6. FEATURE SPECIFICATIONS

### 6.1 Onboarding Wizard

#### 6.1.1 Wizard State Management Hook (src/hooks/useOnboarding.ts)

```typescript
import { useState, useCallback } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { OnboardingState, OnboardingFormData } from '@/types/onboarding'
import * as onboardingApi from '@/api/onboarding'

const TOTAL_STEPS = 5

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>({
    currentStep: 1,
    completedSteps: [],
    formData: {
      organization: {} as any,
      genesys: {} as any,
      whatsapp: {} as any,
    },
  })

  // Load existing progress
  const { data: savedProgress } = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: onboardingApi.getProgress,
  })

  // Save progress mutation
  const saveProgressMutation = useMutation({
    mutationFn: onboardingApi.saveProgress,
    onSuccess: () => {
      console.log('Progress saved')
    },
  })

  const updateFormData = useCallback((step: number, data: any) => {
    setState(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        ...data,
      },
    }))
    
    // Auto-save
    saveProgressMutation.mutate({ step, data })
  }, [])

  const nextStep = useCallback(() => {
    setState(prev => {
      const newCompletedSteps = [...prev.completedSteps, prev.currentStep]
      return {
        ...prev,
        currentStep: Math.min(prev.currentStep + 1, TOTAL_STEPS),
        completedSteps: newCompletedSteps,
      }
    })
  }, [])

  const previousStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1),
    }))
  }, [])

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setState(prev => ({ ...prev, currentStep: step }))
    }
  }, [])

  return {
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    formData: state.formData,
    totalSteps: TOTAL_STEPS,
    isFirstStep: state.currentStep === 1,
    isLastStep: state.currentStep === TOTAL_STEPS,
    updateFormData,
    nextStep,
    previousStep,
    goToStep,
  }
}
```

#### 6.1.2 Step 1: Organization Profile (src/components/onboarding/Step1Organization.tsx)

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { OrganizationProfile } from '@/types/onboarding'

const organizationSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  contactEmail: z.string().email('Invalid email format'),
  supportPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
  region: z.enum(['north-america', 'europe', 'asia-pacific', 'latin-america']),
})

interface Step1Props {
  initialData?: Partial<OrganizationProfile>
  onNext: (data: OrganizationProfile) => void
}

export function Step1Organization({ initialData, onNext }: Step1Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrganizationProfile>({
    resolver: zodResolver(organizationSchema),
    defaultValues: initialData,
  })

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <h2 className="text-2xl font-bold">Organization Profile</h2>
      
      <div>
        <label htmlFor="companyName" className="block text-sm font-medium mb-2">
          Company Name *
        </label>
        <input
          id="companyName"
          {...register('companyName')}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
        />
        {errors.companyName && (
          <p className="text-error text-sm mt-1">{errors.companyName.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="contactEmail" className="block text-sm font-medium mb-2">
          Contact Email *
        </label>
        <input
          id="contactEmail"
          type="email"
          {...register('contactEmail')}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
        />
        {errors.contactEmail && (
          <p className="text-error text-sm mt-1">{errors.contactEmail.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="supportPhone" className="block text-sm font-medium mb-2">
          Support Phone *
        </label>
        <input
          id="supportPhone"
          type="tel"
          {...register('supportPhone')}
          placeholder="+1234567890"
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
        />
        {errors.supportPhone && (
          <p className="text-error text-sm mt-1">{errors.supportPhone.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="region" className="block text-sm font-medium mb-2">
          Region *
        </label>
        <select
          id="region"
          {...register('region')}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Select region...</option>
          <option value="north-america">North America</option>
          <option value="europe">Europe</option>
          <option value="asia-pacific">Asia Pacific</option>
          <option value="latin-america">Latin America</option>
        </select>
        {errors.region && (
          <p className="text-error text-sm mt-1">{errors.region.message}</p>
        )}
      </div>

      <button
        type="submit"
        className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700"
      >
        Continue
      </button>
    </form>
  )
}
```

#### 6.1.3 Step 4: Connectivity Test (src/components/onboarding/Step4ConnectivityTest.tsx)

```typescript
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ValidationResults } from '@/types/onboarding'
import * as onboardingApi from '@/api/onboarding'
import { CheckCircle, XCircle, Loader, ChevronDown } from 'lucide-react'

export function Step4ConnectivityTest({ onNext }: { onNext: () => void }) {
  const [showDetails, setShowDetails] = useState<string | null>(null)

  const validationMutation = useMutation({
    mutationFn: onboardingApi.validateIntegration,
  })

  const handleTest = () => {
    validationMutation.mutate()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="text-success" size={24} />
      case 'error':
        return <XCircle className="text-error" size={24} />
      case 'pending':
        return <Loader className="animate-spin text-gray-400" size={24} />
      default:
        return null
    }
  }

  const results = validationMutation.data?.results

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Connectivity Test</h2>
      <p className="text-gray-600">
        We'll verify your configuration by testing connections to both platforms.
      </p>

      {!validationMutation.isSuccess && (
        <button
          onClick={handleTest}
          disabled={validationMutation.isPending}
          className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {validationMutation.isPending ? 'Testing...' : 'Run Connectivity Test'}
        </button>
      )}

      {results && (
        <div className="space-y-4">
          {/* Genesys Test */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(results.genesys.status)}
                <div>
                  <h3 className="font-medium">Genesys Cloud Connection</h3>
                  <p className="text-sm text-gray-600">{results.genesys.message}</p>
                </div>
              </div>
              {results.genesys.details && (
                <button
                  onClick={() => setShowDetails(showDetails === 'genesys' ? null : 'genesys')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronDown
                    className={`transform transition-transform ${
                      showDetails === 'genesys' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              )}
            </div>
            {showDetails === 'genesys' && (
              <pre className="mt-4 p-3 bg-gray-50 rounded text-xs overflow-auto">
                {JSON.stringify(results.genesys.details, null, 2)}
              </pre>
            )}
          </div>

          {/* WhatsApp Test */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(results.whatsapp.status)}
                <div>
                  <h3 className="font-medium">WhatsApp Business API</h3>
                  <p className="text-sm text-gray-600">{results.whatsapp.message}</p>
                </div>
              </div>
              {results.whatsapp.details && (
                <button
                  onClick={() => setShowDetails(showDetails === 'whatsapp' ? null : 'whatsapp')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronDown
                    className={`transform transition-transform ${
                      showDetails === 'whatsapp' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              )}
            </div>
            {showDetails === 'whatsapp' && (
              <pre className="mt-4 p-3 bg-gray-50 rounded text-xs overflow-auto">
                {JSON.stringify(results.whatsapp.details, null, 2)}
              </pre>
            )}
          </div>

          {/* Webhook Test */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(results.webhook.status)}
                <div>
                  <h3 className="font-medium">Webhook Handshake</h3>
                  <p className="text-sm text-gray-600">{results.webhook.message}</p>
                </div>
              </div>
              {results.webhook.details && (
                <button
                  onClick={() => setShowDetails(showDetails === 'webhook' ? null : 'webhook')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronDown
                    className={`transform transition-transform ${
                      showDetails === 'webhook' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              )}
            </div>
            {showDetails === 'webhook' && (
              <pre className="mt-4 p-3 bg-gray-50 rounded text-xs overflow-auto">
                {JSON.stringify(results.webhook.details, null, 2)}
              </pre>
            )}
          </div>

          {/* Retry or Continue */}
          {results.genesys.status === 'error' ||
          results.whatsapp.status === 'error' ||
          results.webhook.status === 'error' ? (
            <button
              onClick={handleTest}
              className="w-full bg-warning text-white py-3 rounded-lg hover:bg-warning/90"
            >
              Retry Test
            </button>
          ) : (
            <button
              onClick={onNext}
              className="w-full bg-success text-white py-3 rounded-lg hover:bg-success/90"
            >
              Continue to Webhook Setup
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

### 6.2 Dashboard & Analytics

#### 6.2.1 Dashboard Data Hook (src/hooks/useAnalytics.ts)

```typescript
import { useQuery } from '@tanstack/react-query'
import { DashboardMetrics } from '@/types/analytics'
import * as analyticsApi from '@/api/analytics'

export function useAnalytics() {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard-metrics'],
    queryFn: analyticsApi.getDashboardMetrics,
    refetchInterval: 30000, // Poll every 30 seconds
    refetchOnWindowFocus: true,
    staleTime: 25000, // Consider data fresh for 25 seconds
  })

  return {
    metrics: data,
    isLoading,
    error,
    refresh: refetch,
  }
}
```

#### 6.2.2 KPI Card Component (src/components/dashboard/KPICard.tsx)

```typescript
import { LucideIcon } from 'lucide-react'
import { TimeSeriesMetric } from '@/types/analytics'

interface KPICardProps {
  title: string
  icon: LucideIcon
  value: number | TimeSeriesMetric
  trend?: 'up' | 'down' | 'stable'
  format?: 'number' | 'percentage' | 'time'
  timeRange?: 'today' | '7days' | '30days'
}

export function KPICard({
  title,
  icon: Icon,
  value,
  trend,
  format = 'number',
  timeRange = 'today',
}: KPICardProps) {
  // Extract value based on timeRange if TimeSeriesMetric
  const displayValue = typeof value === 'object' ? value[timeRange] : value

  const formatValue = (val: number) => {
    switch (format) {
      case 'percentage':
        return `${val.toFixed(1)}%`
      case 'time':
        return `${val.toFixed(1)}s`
      default:
        return val.toLocaleString()
    }
  }

  const trendColor = {
    up: 'text-success',
    down: 'text-error',
    stable: 'text-gray-500',
  }[trend || 'stable']

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-600 text-sm font-medium">{title}</h3>
        <Icon className="text-primary-600" size={24} />
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold">{formatValue(displayValue)}</span>
        {trend && (
          <span className={`text-sm ${trendColor}`}>
            {trend === 'up' && '↑'}
            {trend === 'down' && '↓'}
            {trend === 'stable' && '→'}
          </span>
        )}
      </div>
      {typeof value === 'object' && (
        <div className="mt-3 text-xs text-gray-500">
          7d: {formatValue(value.last7Days)} | 30d: {formatValue(value.last30Days)}
        </div>
      )}
    </div>
  )
}
```

#### 6.2.3 Message Volume Chart (src/components/dashboard/MessageVolumeChart.tsx)

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { MessageVolumeDataPoint } from '@/types/analytics'
import { format, parseISO } from 'date-fns'

interface Props {
  data: MessageVolumeDataPoint[]
}

export function MessageVolumeChart({ data }: Props) {
  // Group by timestamp and aggregate
  const aggregatedData = data.reduce((acc, point) => {
    const key = format(parseISO(point.timestamp), 'MMM dd HH:mm')
    if (!acc[key]) {
      acc[key] = { timestamp: key, inbound: 0, outbound: 0 }
    }
    if (point.direction === 'inbound') {
      acc[key].inbound += point.count
    } else {
      acc[key].outbound += point.count
    }
    return acc
  }, {} as Record<string, any>)

  const chartData = Object.values(aggregatedData)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Message Volume</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="inbound" stroke="#10b981" name="Inbound" />
          <Line type="monotone" dataKey="outbound" stroke="#6366f1" name="Outbound" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### 6.3 Conversation Management

#### 6.3.1 Conversation List Hook (src/hooks/useConversations.ts)

```typescript
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ConversationListParams, ConversationStatus } from '@/types/conversation'
import * as conversationApi from '@/api/conversations'

export function useConversations() {
  const [params, setParams] = useState<ConversationListParams>({
    page: 1,
    pageSize: 20,
    sortBy: 'lastActivity',
    sortOrder: 'desc',
  })

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['conversations', params],
    queryFn: () => conversationApi.getConversations(params),
  })

  const setSearch = (search: string) => {
    setParams(prev => ({ ...prev, search, page: 1 }))
  }

  const setStatusFilter = (status?: ConversationStatus) => {
    setParams(prev => ({ ...prev, status, page: 1 }))
  }

  const setPage = (page: number) => {
    setParams(prev => ({ ...prev, page }))
  }

  const exportCSV = async () => {
    const csv = await conversationApi.exportConversations(params)
    // Trigger download
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conversations-${new Date().toISOString()}.csv`
    a.click()
  }

  return {
    conversations: data?.conversations || [],
    pagination: data?.pagination,
    isLoading,
    error,
    params,
    setSearch,
    setStatusFilter,
    setPage,
    refresh: refetch,
    exportCSV,
  }
}
```

#### 6.3.2 Conversation Detail Drawer (src/components/conversations/ConversationDetailDrawer.tsx)

```typescript
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import * as conversationApi from '@/api/conversations'
import { WidgetEmbed } from './WidgetEmbed'

interface Props {
  conversationId: string
  onClose: () => void
}

export function ConversationDetailDrawer({ conversationId, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['conversation-detail', conversationId],
    queryFn: () => conversationApi.getConversationDetail(conversationId),
    enabled: !!conversationId,
  })

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!data) {
    return null
  }

  return (
    <div className="fixed inset-y-0 right-0 w-2/3 bg-white shadow-2xl z-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-xl font-bold">{data.contactName}</h2>
          <p className="text-sm text-gray-600">wa_id: {data.waId}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Widget */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Conversation Widget (Read-Only)</h3>
          <WidgetEmbed
            conversationId={data.conversationId}
            tenantId={data.metadata?.tenantId || ''}
            mode="portal"
          />
        </div>

        {/* Audit Trail */}
        <div>
          <h3 className="font-semibold mb-3">Audit Trail</h3>
          <div className="space-y-2">
            {data.auditTrail.map(entry => (
              <div key={entry.id} className="border-l-2 border-gray-300 pl-4 py-2">
                <div className="text-sm font-medium">{entry.event}</div>
                <div className="text-xs text-gray-600">
                  {new Date(entry.timestamp).toLocaleString()} • {entry.actor}
                </div>
                {entry.details && (
                  <pre className="text-xs text-gray-500 mt-1">
                    {JSON.stringify(entry.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Logs */}
        <div>
          <h3 className="font-semibold mb-3">Delivery Logs</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Direction</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Message ID</th>
              </tr>
            </thead>
            <tbody>
              {data.deliveryLogs.map(log => (
                <tr key={log.id} className="border-b">
                  <td className="px-4 py-2">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2">{log.direction}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        log.status === 'delivered'
                          ? 'bg-success/20 text-success'
                          : log.status === 'failed'
                          ? 'bg-error/20 text-error'
                          : 'bg-gray-200'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{log.messageId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

#### 6.3.3 Widget Embed Component (src/components/conversations/WidgetEmbed.tsx)

```typescript
interface WidgetEmbedProps {
  conversationId: string
  tenantId: string
  mode: 'portal' | 'standalone'
}

export function WidgetEmbed({ conversationId, tenantId, mode }: WidgetEmbedProps) {
  const widgetUrl = `${window.location.origin}/widget?convId=${conversationId}&tenantId=${tenantId}&mode=${mode}`

  return (
    <div className="w-full h-[600px] border rounded-lg overflow-hidden">
      <iframe
        src={widgetUrl}
        className="w-full h-full"
        title="Conversation Widget"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
```

---

## 7. API INTEGRATION LAYER

### 7.1 Authentication API (src/api/auth.ts)

```typescript
import { apiClient } from './client'
import { AuthSession, GenesysRegion } from '@/types/auth'
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/pkce'

export async function initiateLogin() {
  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  const response = await apiClient.post<{
    authUrl: string
    state: string
  }>('/api/auth/login/init', {
    codeChallenge,
    redirectUri: `${window.location.origin}/callback`,
  })

  return {
    ...response.data,
    codeVerifier, // Return to store in sessionStorage
  }
}

export async function handleCallback(code: string, state: string) {
  const codeVerifier = sessionStorage.getItem('pkce_verifier')
  const savedState = sessionStorage.getItem('oauth_state')

  if (!codeVerifier || state !== savedState) {
    throw new Error('Invalid OAuth state')
  }

  const response = await apiClient.post<{ session: AuthSession }>('/api/auth/callback', {
    code,
    state,
    codeVerifier,
  })

  // Store tenant ID
  sessionStorage.setItem('tenantId', response.data.session.tenantId)

  // Clear PKCE data
  sessionStorage.removeItem('pkce_verifier')
  sessionStorage.removeItem('oauth_state')

  return response.data.session
}

export async function getCurrentSession(): Promise<AuthSession> {
  const response = await apiClient.get<{ session: AuthSession }>('/api/auth/session')
  return response.data.session
}

export async function refreshSession(): Promise<AuthSession> {
  const response = await apiClient.post<{ session: AuthSession }>('/api/auth/refresh')
  return response.data.session
}

export async function logout(): Promise<void> {
  await apiClient.post('/api/auth/logout')
}
```

### 7.2 PKCE Utilities (src/lib/pkce.ts)

```typescript
// PKCE helper functions for OAuth2 flow

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64URLEncode(array)
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64URLEncode(new Uint8Array(hash))
}

function base64URLEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer))
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}
```

### 7.3 Onboarding API (src/api/onboarding.ts)

```typescript
import { apiClient } from './client'
import {
  OnboardingFormData,
  SaveOnboardingRequest,
  ValidateIntegrationResponse,
  WebhookUrls,
} from '@/types/onboarding'

export async function getProgress() {
  const response = await apiClient.get<{ progress: OnboardingFormData }>('/api/onboarding/progress')
  return response.data.progress
}

export async function saveProgress(request: SaveOnboardingRequest) {
  await apiClient.post('/api/onboarding/save', request)
}

export async function validateIntegration(): Promise<ValidateIntegrationResponse> {
  const response = await apiClient.post<ValidateIntegrationResponse>(
    '/api/integration/validate'
  )
  return response.data
}

export async function completeOnboarding(): Promise<WebhookUrls> {
  const response = await apiClient.post<{ webhookUrls: WebhookUrls }>(
    '/api/onboarding/complete'
  )
  return response.data.webhookUrls
}
```

### 7.4 Analytics API (src/api/analytics.ts)

```typescript
import { apiClient } from './client'
import { DashboardMetrics } from '@/types/analytics'

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const response = await apiClient.get<DashboardMetrics>('/api/analytics/dashboard')
  return response.data
}

export async function getMessageVolume(days: number = 7) {
  const response = await apiClient.get(`/api/analytics/messages?days=${days}`)
  return response.data
}

export async function getDeliveryStats(days: number = 7) {
  const response = await apiClient.get(`/api/analytics/delivery?days=${days}`)
  return response.data
}
```

### 7.5 Conversations API (src/api/conversations.ts)

```typescript
import { apiClient } from './client'
import {
  ConversationListParams,
  ConversationListResponse,
  ConversationDetail,
} from '@/types/conversation'

export async function getConversations(
  params: ConversationListParams
): Promise<ConversationListResponse> {
  const queryParams = new URLSearchParams()
  queryParams.append('page', params.page.toString())
  queryParams.append('pageSize', params.pageSize.toString())
  if (params.search) queryParams.append('search', params.search)
  if (params.status) queryParams.append('status', params.status)
  if (params.sortBy) queryParams.append('sortBy', params.sortBy)
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder)

  const response = await apiClient.get<ConversationListResponse>(
    `/api/conversations?${queryParams}`
  )
  return response.data
}

export async function getConversationDetail(id: string): Promise<ConversationDetail> {
  const response = await apiClient.get<ConversationDetail>(`/api/conversations/${id}`)
  return response.data
}

export async function exportConversations(params: ConversationListParams): Promise<string> {
  const queryParams = new URLSearchParams()
  if (params.search) queryParams.append('search', params.search)
  if (params.status) queryParams.append('status', params.status)

  const response = await apiClient.get(`/api/conversations/export?${queryParams}`, {
    responseType: 'text',
  })
  return response.data
}
```

---

## 8. STATE MANAGEMENT STRATEGY

### 8.1 React Query Configuration (src/lib/queryClient.ts)

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
})
```

### 8.2 Query Key Factory Pattern (src/lib/queryKeys.ts)

```typescript
export const queryKeys = {
  auth: {
    session: ['auth', 'session'] as const,
  },
  onboarding: {
    progress: ['onboarding', 'progress'] as const,
  },
  analytics: {
    dashboard: ['analytics', 'dashboard'] as const,
    messageVolume: (days: number) => ['analytics', 'messages', days] as const,
    deliveryStats: (days: number) => ['analytics', 'delivery', days] as const,
  },
  conversations: {
    list: (params: any) => ['conversations', 'list', params] as const,
    detail: (id: string) => ['conversations', 'detail', id] as const,
  },
  settings: {
    all: ['settings'] as const,
  },
}
```

---

## 9. UI COMPONENT LIBRARY

### 9.1 Button Component (src/components/ui/Button.tsx)

```typescript
import { ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { Loader } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
    
    const variants = {
      primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
      danger: 'bg-error text-white hover:bg-error/90 focus:ring-error',
      ghost: 'hover:bg-gray-100 text-gray-700 focus:ring-gray-500',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    }

    return (
      <button
        ref={ref}
        className={clsx(
          baseStyles,
          variants[variant],
          sizes[size],
          (disabled || isLoading) && 'opacity-50 cursor-not-allowed',
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader className="animate-spin mr-2" size={16} />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

### 9.2 Toast Notification System (src/hooks/useToast.ts)

```typescript
import { create } from 'zustand'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2)
    const newToast = { ...toast, id }
    set((state) => ({ toasts: [...state.toasts, newToast] }))
    
    // Auto-remove after duration
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    }, toast.duration || 5000)
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))

export function useToast() {
  const { addToast } = useToastStore()

  return {
    success: (message: string, duration?: number) =>
      addToast({ type: 'success', message, duration }),
    error: (message: string, duration?: number) =>
      addToast({ type: 'error', message, duration }),
    warning: (message: string, duration?: number) =>
      addToast({ type: 'warning', message, duration }),
    info: (message: string, duration?: number) =>
      addToast({ type: 'info', message, duration }),
  }
}
```

---

## 10. ERROR HANDLING & VALIDATION

### 10.1 Form Validation Schemas (src/lib/validators.ts)

```typescript
import { z } from 'zod'

// Organization schema
export const organizationSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  contactEmail: z.string().email('Invalid email address'),
  supportPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  region: z.enum(['north-america', 'europe', 'asia-pacific', 'latin-america']),
})

// Genesys schema
export const genesysSchema = z.object({
  clientId: z.string().uuid('Invalid client ID format').or(z.string().min(10)),
  clientSecret: z.string().min(20, 'Client secret is required'),
  region: z.enum(['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-2', 'ca-central-1']),
  environment: z.enum(['production', 'test']),
})

// WhatsApp schema
export const whatsAppSchema = z.object({
  wabaId: z.string().regex(/^\d+$/, 'WABA ID must be numeric').min(10),
  phoneNumberId: z.string().regex(/^\d+$/, 'Phone Number ID must be numeric').min(10),
  systemUserToken: z.string().min(100, 'Invalid token format'),
  appId: z.string().optional(),
})

// Credential update schema
export const credentialUpdateSchema = z.object({
  credentialType: z.enum(['genesys-secret', 'whatsapp-token']),
  newValue: z.string().min(20, 'Invalid credential format'),
  confirmationToken: z.string().min(1, 'Confirmation required'),
})
```

### 10.2 Global Error Boundary (src/components/ErrorBoundary.tsx)

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo)
    
    // Send to error tracking service (e.g., Sentry)
    // Sentry.captureException(error, { extra: errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
            <AlertTriangle className="mx-auto text-error mb-4" size={48} />
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-6">
              We're sorry for the inconvenience. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700"
            >
              Reload Page
            </button>
            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500">
                  Technical details
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

---

## 11. SECURITY IMPLEMENTATION

### 11.1 Content Security Policy

```typescript
// src/lib/security.ts

export const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"], // Remove unsafe-inline in production
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: [
    "'self'",
    'http://localhost:3000',
    'https://api.genesys.com',
  ],
  frameSrc: ["'self'"], // For widget embedding
  objectSrc: ["'none'"],
  upgradeInsecureRequests: [],
}
```

### 11.2 Input Sanitization

```typescript
// src/lib/sanitize.ts

import DOMPurify from 'dompurify'

export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href'],
  })
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential XSS vectors
    .slice(0, 1000) // Limit length
}
```

### 11.3 Session Management

```typescript
// Key security requirements:
// 1. NO tokens in localStorage
// 2. Session stored in memory (AuthContext)
// 3. HTTP-only cookies for backend session
// 4. Auto-refresh before expiry
// 5. Force logout on expiry

// Implementation already covered in AuthContext section
```

---

## 12. PERFORMANCE OPTIMIZATION

### 12.1 Code Splitting Strategy

```typescript
// src/App.tsx
import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'

// Lazy load route components
const Dashboard = lazy(() => import('@/components/dashboard/Dashboard'))
const OnboardingWizard = lazy(() => import('@/components/onboarding/OnboardingWizard'))
const ConversationList = lazy(() => import('@/components/conversations/ConversationList'))
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage'))

function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<ProtectedRoute />}>
          <Route index element={<Dashboard />} />
          <Route path="onboarding" element={<OnboardingWizard />} />
          <Route path="conversations" element={<ConversationList />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
```

### 12.2 React Query Optimization

```typescript
// Prefetching strategy
export function usePrefetch() {
  const queryClient = useQueryClient()

  const prefetchDashboard = () => {
    queryClient.prefetchQuery({
      queryKey: ['dashboard-metrics'],
      queryFn: analyticsApi.getDashboardMetrics,
    })
  }

  return { prefetchDashboard }
}

// Usage in navigation
<Link 
  to="/dashboard" 
  onMouseEnter={prefetchDashboard}
>
  Dashboard
</Link>
```

---

## 13. TESTING STRATEGY

### 13.1 Unit Test Example (Button.test.tsx)

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<Button isLoading>Submit</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onClick handler', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click</Button>)
    fireEvent.click(screen.getByText('Click'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

---

## 14. DEPLOYMENT & CONFIGURATION

### 14.1 Environment Variables (.env.example)

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000
VITE_WIDGET_BASE_URL=http://localhost:5173

# Genesys Configuration
VITE_GENESYS_OAUTH_REDIRECT_URI=http://localhost:5173/callback

# Feature Flags
VITE_ENABLE_DARK_MODE=false
VITE_ENABLE_ANALYTICS=true

# Monitoring
VITE_SENTRY_DSN=
VITE_ENVIRONMENT=development
```

### 14.2 Build & Deploy

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Deploy (example for Vercel)
vercel deploy --prod
```

---

## 15. ACCEPTANCE CRITERIA

### 15.1 Feature Checklist

- [ ] **Authentication**
  - [ ] Genesys SSO login works with PKCE
  - [ ] Session persists across page refresh
  - [ ] Auto-refresh prevents session expiry
  - [ ] Logout clears all session data
  - [ ] Expired sessions redirect to login

- [ ] **Onboarding**
  - [ ] All 5 steps validate correctly
  - [ ] Form data auto-saves
  - [ ] Connectivity test shows real-time results
  - [ ] Webhook URLs are copyable
  - [ ] Can resume incomplete onboarding

- [ ] **Dashboard**
  - [ ] KPI cards show accurate metrics
  - [ ] Charts update every 30 seconds
  - [ ] Token expiry warnings appear 7 days before
  - [ ] Failed deliveries show error details

- [ ] **Conversations**
  - [ ] Table loads with pagination
  - [ ] Search filters work correctly
  - [ ] Detail drawer shows widget
  - [ ] Audit trail is complete
  - [ ] CSV export includes all columns

- [ ] **Settings**
  - [ ] Secret rotation requires confirmation
  - [ ] Credentials update successfully
  - [ ] Audit logs record all changes

- [ ] **Security**
  - [ ] No tokens in localStorage
  - [ ] CSP headers prevent XSS
  - [ ] Input sanitization works
  - [ ] HTTPS enforced in production

---

**END OF SPECIFICATION**

--- END agent-portal/customer-portal-frd.md ---


--- BEGIN agent-widget/agent-widget-frd.md ---

# Functional Requirements Document (FRD) - Enhanced for LLM Code Generation

**Service Name:** `agent-widget`  
**Version:** 1.4 (Consolidated)  
**Parent Reference:** System Design Document  

This enhanced FRD is optimized for LLMs (e.g., Claude) to generate high-quality code. Enhancements include:  
- Modular, hierarchical structure with clear inputs/outputs.  
- Pseudocode for flows to guide implementation.  
- JSON schemas for payloads and APIs.  
- Explicit error cases and edge conditions.  
- Code-friendly language: imperative steps, enums, types.  
- Sections tagged for code gen (e.g., [CODE_GEN: UI Component]).  

---

## 1. Introduction  
The Agent Interaction Widget is a micro-frontend for real-time WhatsApp interactions.  
- **Deployment Modes:**  
  - Embedded in Genesys Cloud Agent Desktop (iframe, mirrors interactions).  
  - Standalone/embedded in Customer Portal (admin/fallback messaging).  
- **Tech Stack Guidance:** React for UI, Socket.IO for WebSockets, Axios for APIs. Ensure stateless design.  

---

## 2. Objectives  
- Enable seamless Genesys/Portal integration.  
- Auto-resolve conversation context.  
- Support WhatsApp features: text, media (JPG/PNG/PDF/MP4), emojis, status indicators, read receipts, previews.  
- Fallback to direct messaging if Genesys unavailable.  
- Real-time sync via WebSockets.  
- Enforce tenant isolation and compliance.  

---

## 3. System Responsibilities  

### 3.1 Multi-Host Integration  
- Detect host: Genesys (if window.Genesys SDK exists) vs. Portal (URL params).  
- Adapt UI: Genesys → Lightning theme; Portal → Portal theme.  
- [CODE_GEN: HostDetector] Implement as React hook:  
  ```javascript  
  const detectMode = () => window.Genesys ? 'genesys' : 'portal';  
  ```  

### 3.2 Context Resolution  
- Inputs: conversationId (SDK/URL), tenantId (URL), mode (URL), integrationId (URL/Config).  
- Validate via API: GET /api/v1/widget/context/{conversationId} → { valid: boolean, tenantId: string, wa_id: string }.  
- Fetch WhatsApp ID from State Manager.  
- Edge: Invalid context → throw Error('InvalidConversation').  

### 3.3 Messaging Capabilities  
- Types: text, media attachments, emojis.  
- Indicators: sent (1 gray tick), delivered (2 gray), read (2 blue).  
- Previews: Inline for images/videos/docs.  
- Fallback: Direct send if Genesys down.  

### 3.4 Real-Time Synchronization  
- WebSocket: wss://api.xypr.com/socket.io namespace /tenant/{tenantId}/conv/{conversationId}.  
- Events: inbound_message ({ text: string, mediaUrl?: string }), status_update ({ messageId: string, status: 'sent'|'delivered'|'read' }).  
- [CODE_GEN: WebSocketHandler] Use Socket.IO client:  
  ```javascript  
  const socket = io(baseUrl, { auth: { token } });  
  socket.on('inbound_message', updateUI);  
  ```  

---

## 4. Hosting Modes  

### 4.1 Genesys Cloud Mode  
- Embed: Iframe in Genesys Cloud.  
- Auth: Short-lived SSO token.  
- PCI: Optional flag to disable input.  
- Intercept: Webhook mirrors Genesys messages.  
- [CODE_GEN: GenesysInit]  
  ```javascript  
  if (window.Genesys) { conversationId = Genesys.getActiveConversationId(); }  
  ```  

### 4.2 Customer Portal Mode  
- Standalone: Parse URL for conversationId, tenantId, mode='portal'.  
- Auth: Bearer token or HTTP-only cookie.  
- Direct: Send to middleware.  

---

## 5. Input Requirements  

### 5.1 Contextual & Initialization Inputs  
| Parameter | Type | Source | Required In | Description |  
|-----------|------|--------|-------------|-------------|  
| conversationId | string | SDK/URL | Both | Unique ID. |  
| tenantId | string | URL | Portal | Org ID. |  
| mode | enum('genesys'|'portal') | URL | Portal | Force mode. |  
| integrationId | string | URL/Config | Both | WhatsApp integration. |  

### 5.2 Authentication & Authorization  
- Genesys: SSO token (string, expires in 5min), optional pciCheck: boolean.  
- Portal: Bearer string or cookie.  
- [CODE_GEN: AuthValidator] Validate token via API: POST /auth/validate.  

### 5.3 Functional Messaging Inputs  
- Outbound: { text: string, media?: File (JPG|PNG|PDF|MP4), emojis: supported via Unicode }.  
- Metadata: contact_name: string, wa_id: string.  
- Location: Optional { lat: number, lng: number }.  

### 5.4 Technical Dependencies  
- Genesys SDK: Global window object.  
- WebSocket: Socket.IO.  
- APIs: REST with JSON.  

---

## 6. Functional Specifications  

### 6.1 Context Resolution & Mode Detection  
Pseudocode:  
```javascript
function initWidget() {  
  mode = detectHost();  
  if (mode === 'genesys') { conversationId = getFromSDK(); }  
  else { parseURLParams(); }  
  response = await fetch(`/api/v1/widget/context/${conversationId}`);  
  if (!response.valid) throw new Error('Invalid Context');  
  connectWebSocket(response.tenantId, conversationId);  
}  
```  
Edge: No SDK → fallback to portal; Invalid URL → error UI.  

### 6.2 Message Send Flow  
Payload Schema (JSON):  
```json
{  
  "type": "object",  
  "properties": {  
    "conversationId": { "type": "string" },  
    "tenantId": { "type": "string" },  
    "text": { "type": "string" },  
    "mediaUrl": { "type": ["string", "null"] },  
    "integrationId": { "type": "string" }  
  },  
  "required": ["conversationId", "tenantId", "integrationId"]  
}  
```  
Flow Pseudocode:  
```javascript
async function sendMessage(payload) {  
  addPendingMessageToUI(payload);  
  try {  
    await post('/api/v1/widget/send', payload); // Validates, publishes to RabbitMQ  
    // State Manager resolves wa_id, forwards to WhatsApp  
    await websocketConfirmation(); // Update status  
  } catch (e) { retry(3, e); }  
}  
```  
[CODE_GEN: SendButton] React component with onClick calling sendMessage.  

### 6.3 Messaging Paths  
- Genesys Sync: Intercept webhook → mirror to UI.  
- Direct Portal: Widget → middleware.  
- Edge: Genesys down → switch to direct.  

### 6.4 Real-Time Synchronization  
Events Schema:  
```json
{  
  "inbound_message": { "text": "string", "mediaUrl?": "string" },  
  "status_update": { "messageId": "string", "status": "enum(sent,delivered,read)" }  
}  
```  
[CODE_GEN: StatusRenderer] Component: Map status to ticks (gray/blue icons).  

---

## 7. UI / UX Requirements  
- Adaptability: Use CSS vars for themes.  
- Media: <img> for previews, <video> for MP4, MinIO URLs for download.  
- Accessibility: ARIA roles, keyboard nav (e.g., Enter to send).  
- [CODE_GEN: ChatUI] React: MessageList, InputBox, StatusIcons.  

---

## 8. Performance Requirements  
- Send: <200ms (UI to queue).  
- WebSocket: <300ms latency.  
- Upload: Progress bar (use XMLHttpRequest).  
- Retry: Exponential backoff (100ms, 200ms, 400ms).  

---

## 9. Security Requirements  
- Tenant: Enforce on every API/WebSocket.  
- Tokens: Validate per call.  
- CORS: Allow mypurecloud.com.  
- PCI: If true, disable input.  
- WebSocket: Auth handshake { token: string }.  
- [CODE_GEN: SecurityWrapper] HOC to check tenant.  

---

## 10. Error Handling Requirements  
- Failed send: Retry button.  
- WebSocket disconnect: Auto-reconnect (backoff: 1s, 2s, 5s).  
- Offline: Banner UI.  
- Duplicates: Use unique messageId.  
- Pseudocode:  
  ```javascript  
  socket.on('disconnect', () => reconnectWithBackoff());  
  ```  

---

## 11. Technical Constraints  
- Iframe: Sandbox allow-scripts.  
- Cross-origin: Use postMessage if needed.  
- Stateless: Store state in backend/WebSocket.  

---

## 12. Non-Functional Requirements  
- Multi-tenant: Yes.  
- Scalable: Stateless FE.  
- Queue: RabbitMQ.  
- Secure: HTTPS only.  

---

## 13. Future Enhancements  
- Typing: WebSocket event.  
- Reactions: Emoji picker.  
- Templates: Predefined messages.  
- Search: Local filter.  
- Export: CSV via API.  
- Analytics: Track events.  
- Tagging: Metadata API.  
- SLA: Timer UI.  
- AI: Suggestion endpoint.  

---

## Final Summary  
Enhanced FRD for LLM code gen: Structured flows, schemas, pseudocode ensure excellent, modular code output (e.g., React components, API handlers). Focus on React + Socket.IO for implementation.
--- END agent-widget/agent-widget-frd.md ---


--- BEGIN auth-service/auth-frd.md ---

# Auth Service - Functional Requirements Document
## LLM-Optimized for Code Generation & Debugging

**Version:** 2.0 (LLM-Optimized)  
**Service Name:** `auth-service`  
**Purpose:** Centralized token authority and OAuth lifecycle manager  
**Parent Document:** System Design Document  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Patterns](#2-architecture-patterns)
3. [Data Models](#3-data-models)
4. [API Specifications](#4-api-specifications)
5. [Core Flows](#5-core-flows)
6. [Error Handling](#6-error-handling)
7. [Security Requirements](#7-security-requirements)
8. [Performance Requirements](#8-performance-requirements)
9. [Implementation Guide](#9-implementation-guide)
10. [Test Scenarios](#10-test-scenarios)
11. [Configuration](#11-configuration)
12. [Monitoring & Observability](#12-monitoring--observability)

---

## 1. System Overview

### 1.1 Service Description

The Auth Service is the **single source of truth** for authentication tokens across the middleware ecosystem. It manages OAuth flows, token lifecycle, credential security, and SSO validation for external integrations.

**Critical Context:** This is not a helper service - it is the security backbone. System-wide failure occurs if this service fails.

### 1.2 Supported Identity Providers

| Provider | Integration Type | OAuth Flow | Token Type |
|----------|-----------------|------------|------------|
| Genesys Cloud | OAuth 2.0 | Client Credentials | Access Token (JWT) |
| WhatsApp Business Platform | System User Token | Static Token | Long-lived Token |

### 1.3 Primary Capabilities

**REQ-AUTH-01: Token Vending**
- Provide valid access tokens on-demand to internal services
- Support multiple tenant isolation
- Cache tokens with intelligent TTL management
- Prevent token stampede via request collapsing

**REQ-AUTH-02: OAuth Lifecycle Management**
- Handle full OAuth 2.0 Client Credentials flow
- Manage token refresh before expiration
- Handle provider-specific OAuth endpoints per region

**REQ-AUTH-03: Credential Isolation**
- Never store credentials in auth-service
- Fetch encrypted credentials from Tenant Service on-demand
- Decrypt in-memory only, zero logging
- Memory zeroization after use

**REQ-AUTH-04: SSO JWT Validation**
- Validate Genesys SSO JWTs for portal authentication
- Cache JWKS keys for performance
- Extract user context (userId, orgId, roles)

**REQ-AUTH-05: Rate Protection**
- Request collapsing during cache misses
- Exponential backoff on provider rate limits
- Per-tenant rate limiting in Redis failure scenarios

### 1.4 Service Dependencies

```mermaid
graph TD
    A[Auth Service] -->|Fetch Credentials| B[Tenant Service]
    A -->|Cache Tokens| C[Redis]
    A -->|OAuth Exchange| D[Genesys OAuth]
    A -->|JWT Validation| E[Genesys JWKS]
    A -->|Log Events| F[Logging System]
    A -->|Export Metrics| G[Metrics System]
```

**Dependency Table:**

| Service | Purpose | Criticality | Fallback Behavior |
|---------|---------|-------------|-------------------|
| Tenant Service | Encrypted credential source | HIGH | Fail fast (no credentials = no auth) |
| Redis | Token cache & distributed locks | CRITICAL | Degraded mode: direct IdP, rate-limited |
| Genesys OAuth Endpoint | Token issuance | HIGH | Retry with backoff, fail after 3 attempts |
| Genesys JWKS Endpoint | JWT signature validation | MEDIUM | Use cached keys, fail after cache expiry |
| Logging System | Audit trail | MEDIUM | Buffer logs locally, async flush |
| Metrics System | Observability | LOW | Continue operation, metrics lost |

---

## 2. Architecture Patterns

### 2.1 Layered Architecture

```
┌─────────────────────────────────────┐
│   API Layer (HTTP/REST Endpoints)   │
├─────────────────────────────────────┤
│   Service Layer (Business Logic)    │
├─────────────────────────────────────┤
│   Repository Layer (Data Access)    │
├─────────────────────────────────────┤
│   Infrastructure (Redis, HTTP)      │
└─────────────────────────────────────┘
```

### 2.2 Key Design Patterns

**Pattern 1: Cache-Aside with Distributed Locking**
- Check cache → if miss, acquire lock → fetch from source → populate cache
- Prevents thundering herd problem

**Pattern 2: Decorator Pattern for Token Operations**
- Base token provider interface
- Decorators: Caching, Logging, Metrics, Retry logic

**Pattern 3: Strategy Pattern for OAuth Providers**
- Different strategies for Genesys vs WhatsApp
- Pluggable provider implementations

**Pattern 4: Circuit Breaker for External Services**
- Track failure rates for OAuth endpoints
- Open circuit after threshold, half-open for health checks

### 2.3 Component Structure

```typescript
// Recommended project structure
src/
├── api/
│   ├── routes/
│   │   ├── token.routes.ts          // GET /token/:type
│   │   ├── validate.routes.ts       // POST /validate/jwt
│   │   └── health.routes.ts         // GET /health
│   └── middleware/
│       ├── auth.middleware.ts       // Internal service auth
│       ├── validation.middleware.ts // Request validation
│       └── error.middleware.ts      // Error handling
├── services/
│   ├── token/
│   │   ├── token.service.ts         // Main token orchestration
│   │   ├── genesys-token.service.ts // Genesys-specific logic
│   │   └── whatsapp-token.service.ts// WhatsApp-specific logic
│   ├── oauth/
│   │   ├── oauth.service.ts         // OAuth 2.0 client
│   │   └── oauth-client-factory.ts  // Provider-specific clients
│   ├── jwt/
│   │   ├── jwt-validator.service.ts // JWT validation
│   │   └── jwks-cache.service.ts    // JWKS key caching
│   └── credentials/
│       └── credential-fetcher.service.ts // Tenant Service client
├── repositories/
│   ├── token-cache.repository.ts    // Redis token operations
│   └── lock.repository.ts           // Distributed lock operations
├── models/
│   ├── token.model.ts               // Token data structures
│   ├── credentials.model.ts         // Credential structures
│   └── errors.model.ts              // Custom error types
├── config/
│   ├── app.config.ts                // Application config
│   ├── redis.config.ts              // Redis config
│   └── providers.config.ts          // OAuth provider config
└── utils/
    ├── crypto.util.ts               // Encryption/decryption
    ├── logger.util.ts               // Structured logging
    └── metrics.util.ts              // Metrics helpers
```

---

## 3. Data Models

### 3.1 TypeScript Interfaces

```typescript
/**
 * Supported identity provider types
 */
export enum ProviderType {
  GENESYS = 'genesys',
  WHATSAPP = 'whatsapp'
}

/**
 * Genesys Cloud regions
 */
export enum GenesysRegion {
  US_EAST_1 = 'us-east-1',
  US_EAST_2 = 'us-east-2',
  US_WEST_2 = 'us-west-2',
  CA_CENTRAL_1 = 'ca-central-1',
  EU_WEST_1 = 'eu-west-1',
  EU_WEST_2 = 'eu-west-2',
  EU_CENTRAL_1 = 'eu-central-1',
  AP_SOUTHEAST_2 = 'ap-southeast-2',
  AP_NORTHEAST_1 = 'ap-northeast-1',
  AP_NORTHEAST_2 = 'ap-northeast-2',
  AP_SOUTH_1 = 'ap-south-1'
}

/**
 * Internal token request payload
 */
export interface TokenRequest {
  tenantId: string;           // UUID v4 format
  type: ProviderType;         // 'genesys' | 'whatsapp'
  forceRefresh?: boolean;     // Optional: bypass cache
  correlationId?: string;     // Optional: request tracing
}

/**
 * Internal token response
 */
export interface TokenResponse {
  accessToken: string;        // The actual token (never log this)
  expiresIn: number;          // Seconds until expiration
  tokenType: string;          // 'Bearer' for OAuth 2.0
  source: 'cache' | 'fresh';  // Whether from cache or newly fetched
  cachedAt?: Date;            // When cached (if from cache)
  expiresAt: Date;            // Absolute expiration time
}

/**
 * Genesys OAuth credentials
 */
export interface GenesysCredentials {
  clientId: string;           // OAuth client ID
  clientSecret: string;       // OAuth client secret (NEVER LOG)
  region: GenesysRegion;      // Genesys region for endpoint
}

/**
 * WhatsApp credentials
 */
export interface WhatsAppCredentials {
  systemUserToken: string;    // Long-lived token (NEVER LOG)
  expiresAt?: Date;           // Optional expiration
}

/**
 * Unified credentials response from Tenant Service
 */
export interface TenantCredentials {
  tenantId: string;
  type: ProviderType;
  genesys?: GenesysCredentials;
  whatsapp?: WhatsAppCredentials;
}

/**
 * OAuth token response from Genesys
 */
export interface GenesysOAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * JWT validation request
 */
export interface JWTValidationRequest {
  token: string;              // The JWT to validate (NEVER LOG)
  region: GenesysRegion;      // Genesys region for JWKS endpoint
}

/**
 * JWT validation response
 */
export interface JWTValidationResponse {
  isValid: boolean;
  userId?: string;            // Subject claim (sub)
  orgId?: string;             // Organization ID
  roles?: string[];           // User roles (if present in token)
  expiresAt?: Date;           // Token expiration
  error?: string;             // Error message if invalid
}

/**
 * JWKS key
 */
export interface JWK {
  kid: string;                // Key ID
  kty: string;                // Key type
  use: string;                // Public key use
  n: string;                  // RSA modulus
  e: string;                  // RSA exponent
  alg: string;                // Algorithm
}

/**
 * JWKS response
 */
export interface JWKSResponse {
  keys: JWK[];
}

/**
 * Redis cache entry for tokens
 */
export interface CachedToken {
  token: string;
  expiresAt: number;          // Unix timestamp
  cachedAt: number;           // Unix timestamp
}

/**
 * Distributed lock
 */
export interface DistributedLock {
  key: string;
  value: string;              // Random token to identify lock owner
  ttl: number;                // Seconds
  acquiredAt: Date;
}
```

### 3.2 Error Models

```typescript
/**
 * Custom error types
 */
export enum ErrorCode {
  // Credential errors
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  CREDENTIALS_NOT_FOUND = 'CREDENTIALS_NOT_FOUND',
  CREDENTIALS_INVALID = 'CREDENTIALS_INVALID',
  CREDENTIALS_DECRYPT_FAILED = 'CREDENTIALS_DECRYPT_FAILED',
  
  // OAuth errors
  OAUTH_EXCHANGE_FAILED = 'OAUTH_EXCHANGE_FAILED',
  OAUTH_INVALID_GRANT = 'OAUTH_INVALID_GRANT',
  OAUTH_TIMEOUT = 'OAUTH_TIMEOUT',
  OAUTH_RATE_LIMITED = 'OAUTH_RATE_LIMITED',
  
  // Cache errors
  CACHE_UNAVAILABLE = 'CACHE_UNAVAILABLE',
  LOCK_TIMEOUT = 'LOCK_TIMEOUT',
  LOCK_ACQUISITION_FAILED = 'LOCK_ACQUISITION_FAILED',
  
  // JWT errors
  JWT_INVALID_SIGNATURE = 'JWT_INVALID_SIGNATURE',
  JWT_EXPIRED = 'JWT_EXPIRED',
  JWT_INVALID_FORMAT = 'JWT_INVALID_FORMAT',
  JWT_MISSING_CLAIMS = 'JWT_MISSING_CLAIMS',
  JWKS_FETCH_FAILED = 'JWKS_FETCH_FAILED',
  
  // Generic errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST'
}

/**
 * Base error class
 */
export class AuthServiceError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public tenantId?: string,
    public correlationId?: string
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

/**
 * OAuth-specific error
 */
export class OAuthError extends AuthServiceError {
  constructor(
    code: ErrorCode,
    message: string,
    public provider: ProviderType,
    public providerError?: string,
    tenantId?: string,
    correlationId?: string
  ) {
    super(code, message, 401, tenantId, correlationId);
    this.name = 'OAuthError';
  }
}

/**
 * Cache error
 */
export class CacheError extends AuthServiceError {
  constructor(
    code: ErrorCode,
    message: string,
    public operation: string,
    tenantId?: string,
    correlationId?: string
  ) {
    super(code, message, 503, tenantId, correlationId);
    this.name = 'CacheError';
  }
}
```

### 3.3 Redis Key Schema

```typescript
/**
 * Redis key patterns
 */
export class RedisKeys {
  /**
   * Token cache key
   * Pattern: auth:token:{provider}:{tenantId}
   * Example: auth:token:genesys:550e8400-e29b-41d4-a716-446655440000
   */
  static token(provider: ProviderType, tenantId: string): string {
    return `auth:token:${provider}:${tenantId}`;
  }

  /**
   * Distributed lock key for token fetching
   * Pattern: auth:lock:{provider}:{tenantId}
   * Example: auth:lock:genesys:550e8400-e29b-41d4-a716-446655440000
   */
  static lock(provider: ProviderType, tenantId: string): string {
    return `auth:lock:${provider}:${tenantId}`;
  }

  /**
   * JWKS cache key
   * Pattern: auth:jwks:{region}
   * Example: auth:jwks:us-east-1
   */
  static jwks(region: GenesysRegion): string {
    return `auth:jwks:${region}`;
  }

  /**
   * Rate limit key (used in Redis failure fallback)
   * Pattern: auth:ratelimit:{provider}:{tenantId}:{minute}
   * Example: auth:ratelimit:genesys:550e8400-e29b-41d4-a716-446655440000:202502121430
   */
  static rateLimit(provider: ProviderType, tenantId: string): string {
    const minute = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    return `auth:ratelimit:${provider}:${tenantId}:${minute}`;
  }
}

/**
 * Redis TTL constants
 */
export const RedisTTL = {
  TOKEN_SAFETY_BUFFER: 60,      // Subtract 60s from token expiry for safety
  LOCK_TTL: 30,                  // Lock expires after 30s
  JWKS_TTL: 21600,               // Cache JWKS for 6 hours (21600s)
  WHATSAPP_DEFAULT_TTL: 86400,   // Default 24h for WhatsApp tokens
  WHATSAPP_SAFETY_BUFFER: 3600   // 1 hour buffer for WhatsApp tokens
};
```

---

## 4. API Specifications

### 4.1 Internal REST API

**Base Path:** `/api/v1`

#### 4.1.1 Get Access Token

**Endpoint:** `POST /token`

**Purpose:** Retrieve a valid access token for a tenant and provider.

**Request:**
```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "genesys",
  "forceRefresh": false,
  "correlationId": "req-abc-123"
}
```

**Request Schema:**
```typescript
{
  tenantId: string;     // Required, must be valid UUID v4
  type: 'genesys' | 'whatsapp';  // Required
  forceRefresh?: boolean;        // Optional, default false
  correlationId?: string;        // Optional, for tracing
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86399,
  "tokenType": "Bearer",
  "source": "cache",
  "expiresAt": "2026-02-13T12:00:00Z"
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_REQUEST | Invalid tenantId or type |
| 401 | CREDENTIALS_INVALID | OAuth credentials rejected by IdP |
| 404 | TENANT_NOT_FOUND | Tenant does not exist |
| 404 | CREDENTIALS_NOT_FOUND | No credentials configured for tenant |
| 429 | OAUTH_RATE_LIMITED | Provider rate limit exceeded |
| 503 | OAUTH_EXCHANGE_FAILED | OAuth endpoint unavailable |
| 503 | CACHE_UNAVAILABLE | Redis down, degraded mode active |

**Example Error Response (401):**
```json
{
  "error": {
    "code": "CREDENTIALS_INVALID",
    "message": "OAuth credentials were rejected by Genesys",
    "statusCode": 401,
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "correlationId": "req-abc-123"
  }
}
```

#### 4.1.2 Validate JWT

**Endpoint:** `POST /validate/jwt`

**Purpose:** Validate a Genesys SSO JWT and extract user context.

**Request:**
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "region": "us-east-1"
}
```

**Request Schema:**
```typescript
{
  token: string;        // Required, must be non-empty
  region: GenesysRegion; // Required, must be valid region
}
```

**Response (200 OK - Valid Token):**
```json
{
  "isValid": true,
  "userId": "abc-123-def-456",
  "orgId": "org-789",
  "roles": ["admin", "supervisor"],
  "expiresAt": "2026-02-12T14:00:00Z"
}
```

**Response (200 OK - Invalid Token):**
```json
{
  "isValid": false,
  "error": "JWT signature verification failed"
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_REQUEST | Missing or empty token/region |
| 503 | JWKS_FETCH_FAILED | Cannot fetch JWKS keys |

#### 4.1.3 Health Check

**Endpoint:** `GET /health`

**Purpose:** Service health and dependency status.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-12T12:00:00Z",
  "dependencies": {
    "redis": {
      "status": "healthy",
      "latency": 2
    },
    "tenantService": {
      "status": "healthy",
      "latency": 15
    }
  }
}
```

**Response (503 Service Unavailable):**
```json
{
  "status": "unhealthy",
  "timestamp": "2026-02-12T12:00:00Z",
  "dependencies": {
    "redis": {
      "status": "unhealthy",
      "error": "Connection timeout"
    },
    "tenantService": {
      "status": "healthy",
      "latency": 18
    }
  }
}
```

### 4.2 External API Dependencies

#### 4.2.1 Tenant Service

**Endpoint:** `GET /tenants/{tenantId}/credentials`

**Query Parameters:**
- `type`: `genesys` or `whatsapp`

**Expected Response:**
```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "genesys",
  "genesys": {
    "clientId": "abc123def456",
    "clientSecret": "encrypted:AES256:...",
    "region": "us-east-1"
  }
}
```

#### 4.2.2 Genesys OAuth Endpoint

**Endpoint:** `POST https://login.{region}.genesys.cloud/oauth/token`

**Headers:**
```
Authorization: Basic {base64(clientId:clientSecret)}
Content-Type: application/x-www-form-urlencoded
```

**Body:**
```
grant_type=client_credentials
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

**Error Response (401):**
```json
{
  "error": "invalid_client",
  "error_description": "Client authentication failed"
}
```

**Error Response (429):**
```json
{
  "error": "rate_limit_exceeded",
  "error_description": "Too many requests"
}
```

#### 4.2.3 Genesys JWKS Endpoint

**Endpoint:** `GET https://login.{region}.genesys.cloud/.well-known/jwks.json`

**Expected Response:**
```json
{
  "keys": [
    {
      "kid": "key-1",
      "kty": "RSA",
      "use": "sig",
      "n": "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx...",
      "e": "AQAB",
      "alg": "RS256"
    }
  ]
}
```

---

## 5. Core Flows

### 5.1 Genesys Token Retrieval Flow

**Requirement ID:** REQ-AUTH-02

```mermaid
stateDiagram-v2
    [*] --> CheckCache
    CheckCache --> ReturnCachedToken: Cache Hit
    CheckCache --> AcquireLock: Cache Miss
    
    AcquireLock --> WaitForLock: Lock Exists
    AcquireLock --> FetchCredentials: Lock Acquired
    
    WaitForLock --> RetryCache: After 50ms
    RetryCache --> ReturnCachedToken: Cache Hit (another request populated)
    RetryCache --> WaitForLock: Still Miss (retry up to 5x)
    RetryCache --> AcquireLock: Max Retries Exceeded
    
    FetchCredentials --> OAuthExchange: Success
    FetchCredentials --> ReleaseLock: Tenant Not Found
    
    OAuthExchange --> CacheToken: Success
    OAuthExchange --> Retry: Timeout/5xx (up to 2 retries)
    OAuthExchange --> ReleaseLock: 401 Invalid Credentials
    OAuthExchange --> Backoff: 429 Rate Limited
    
    Retry --> OAuthExchange: Exponential Backoff
    Retry --> ReleaseLock: Max Retries Exceeded
    
    Backoff --> OAuthExchange: After Delay
    Backoff --> ReleaseLock: Max Retries Exceeded
    
    CacheToken --> ReleaseLock: Token Cached
    ReleaseLock --> ReturnFreshToken: Success Path
    ReleaseLock --> ReturnError: Error Path
    
    ReturnCachedToken --> [*]
    ReturnFreshToken --> [*]
    ReturnError --> [*]
```

**Implementation Steps:**

**Step 1: Cache Check**
```typescript
async function checkCache(
  provider: ProviderType,
  tenantId: string
): Promise<TokenResponse | null> {
  const cacheKey = RedisKeys.token(provider, tenantId);
  
  try {
    const cached = await redis.get(cacheKey);
    if (!cached) return null;
    
    const token: CachedToken = JSON.parse(cached);
    
    return {
      accessToken: token.token,
      expiresIn: Math.floor((token.expiresAt - Date.now()) / 1000),
      tokenType: 'Bearer',
      source: 'cache',
      cachedAt: new Date(token.cachedAt),
      expiresAt: new Date(token.expiresAt)
    };
  } catch (error) {
    // Redis error - log and continue to fresh fetch
    logger.warn('Cache check failed', { error, tenantId, provider });
    return null;
  }
}
```

**Step 2: Distributed Lock (Request Collapsing)**
```typescript
async function acquireLock(
  provider: ProviderType,
  tenantId: string,
  lockValue: string
): Promise<boolean> {
  const lockKey = RedisKeys.lock(provider, tenantId);
  
  try {
    // SET NX EX - atomic operation
    const result = await redis.set(
      lockKey,
      lockValue,
      'NX',  // Only set if not exists
      'EX',  // Set expiry
      RedisTTL.LOCK_TTL
    );
    
    return result === 'OK';
  } catch (error) {
    logger.error('Lock acquisition failed', { error, tenantId, provider });
    return false;
  }
}

async function releaseLock(
  provider: ProviderType,
  tenantId: string,
  lockValue: string
): Promise<void> {
  const lockKey = RedisKeys.lock(provider, tenantId);
  
  try {
    // Lua script to ensure we only delete our own lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    await redis.eval(script, 1, lockKey, lockValue);
  } catch (error) {
    logger.error('Lock release failed', { error, tenantId, provider });
    // Non-critical - lock will expire automatically
  }
}
```

**Step 3: Wait and Retry Pattern**
```typescript
async function waitForCachePopulation(
  provider: ProviderType,
  tenantId: string,
  maxRetries: number = 5
): Promise<TokenResponse | null> {
  for (let i = 0; i < maxRetries; i++) {
    // Wait 50ms
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Check cache again
    const token = await checkCache(provider, tenantId);
    if (token) {
      logger.info('Cache populated by another request', { 
        tenantId, 
        provider, 
        attempt: i + 1 
      });
      return token;
    }
  }
  
  logger.warn('Cache wait timeout', { tenantId, provider, maxRetries });
  return null;
}
```

**Step 4: Fetch Credentials from Tenant Service**
```typescript
async function fetchCredentials(
  tenantId: string,
  type: ProviderType
): Promise<TenantCredentials> {
  const url = `${config.tenantServiceUrl}/tenants/${tenantId}/credentials?type=${type}`;
  
  try {
    const response = await httpClient.get(url, {
      timeout: 3000,
      headers: {
        'Authorization': `Bearer ${config.internalServiceToken}`,
        'X-Service-Name': 'auth-service'
      }
    });
    
    if (response.status === 404) {
      throw new AuthServiceError(
        ErrorCode.TENANT_NOT_FOUND,
        `Tenant ${tenantId} not found`,
        404,
        tenantId
      );
    }
    
    const credentials: TenantCredentials = response.data;
    
    // Decrypt secrets in-memory
    if (credentials.genesys?.clientSecret) {
      credentials.genesys.clientSecret = decryptSecret(
        credentials.genesys.clientSecret
      );
    }
    
    if (credentials.whatsapp?.systemUserToken) {
      credentials.whatsapp.systemUserToken = decryptSecret(
        credentials.whatsapp.systemUserToken
      );
    }
    
    return credentials;
  } catch (error) {
    if (error instanceof AuthServiceError) throw error;
    
    logger.error('Credential fetch failed', { error, tenantId, type });
    throw new AuthServiceError(
      ErrorCode.CREDENTIALS_NOT_FOUND,
      `Failed to fetch credentials for tenant ${tenantId}`,
      503,
      tenantId
    );
  }
}

// Decrypt using AWS KMS or similar
function decryptSecret(encrypted: string): string {
  // Implementation depends on encryption method
  // Example: AWS KMS, HashiCorp Vault, etc.
  // CRITICAL: Never log decrypted values
  try {
    return cryptoUtil.decrypt(encrypted);
  } catch (error) {
    throw new AuthServiceError(
      ErrorCode.CREDENTIALS_DECRYPT_FAILED,
      'Failed to decrypt credentials',
      500
    );
  }
}
```

**Step 5: OAuth Exchange**
```typescript
async function performOAuthExchange(
  credentials: GenesysCredentials,
  tenantId: string
): Promise<GenesysOAuthResponse> {
  const url = `https://login.${credentials.region}.genesys.cloud/oauth/token`;
  const auth = Buffer.from(
    `${credentials.clientId}:${credentials.clientSecret}`
  ).toString('base64');
  
  const maxRetries = 2;
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await httpClient.post(
        url,
        'grant_type=client_credentials',
        {
          timeout: 3000,
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      metrics.increment('auth_oauth_success_total', { 
        provider: 'genesys',
        region: credentials.region 
      });
      
      return response.data;
    } catch (error: any) {
      lastError = error;
      
      // Handle specific error codes
      if (error.response?.status === 401) {
        // Invalid credentials - don't retry
        logger.error('OAuth credentials invalid', { 
          tenantId, 
          region: credentials.region,
          // DO NOT log clientId or clientSecret
        });
        
        metrics.increment('auth_oauth_failures_total', {
          provider: 'genesys',
          reason: 'invalid_credentials'
        });
        
        throw new OAuthError(
          ErrorCode.OAUTH_INVALID_GRANT,
          'OAuth credentials were rejected by Genesys',
          ProviderType.GENESYS,
          error.response.data?.error_description,
          tenantId
        );
      }
      
      if (error.response?.status === 429) {
        // Rate limited - exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        logger.warn('OAuth rate limited, retrying', { 
          tenantId, 
          attempt, 
          delay 
        });
        
        metrics.increment('auth_rate_limit_events_total', {
          provider: 'genesys'
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Timeout or 5xx - retry with backoff
      if (error.code === 'ETIMEDOUT' || 
          (error.response?.status >= 500 && error.response?.status < 600)) {
        const delay = Math.min(500 * Math.pow(2, attempt), 4000);
        logger.warn('OAuth request failed, retrying', { 
          tenantId, 
          attempt, 
          delay,
          status: error.response?.status,
          code: error.code
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Unknown error - don't retry
      break;
    }
  }
  
  // Max retries exceeded
  logger.error('OAuth exchange failed after retries', { 
    tenantId, 
    maxRetries,
    lastError: lastError.message
  });
  
  metrics.increment('auth_oauth_failures_total', {
    provider: 'genesys',
    reason: 'max_retries_exceeded'
  });
  
  throw new OAuthError(
    ErrorCode.OAUTH_EXCHANGE_FAILED,
    'Failed to exchange OAuth credentials after retries',
    ProviderType.GENESYS,
    undefined,
    tenantId
  );
}
```

**Step 6: Cache Token**
```typescript
async function cacheToken(
  provider: ProviderType,
  tenantId: string,
  token: string,
  expiresIn: number
): Promise<void> {
  const cacheKey = RedisKeys.token(provider, tenantId);
  const now = Date.now();
  
  // Calculate TTL with safety buffer
  const ttl = expiresIn - RedisTTL.TOKEN_SAFETY_BUFFER;
  
  if (ttl <= 0) {
    logger.warn('Token TTL too short, not caching', { 
      tenantId, 
      provider, 
      expiresIn 
    });
    return;
  }
  
  const cachedToken: CachedToken = {
    token,
    expiresAt: now + (expiresIn * 1000),
    cachedAt: now
  };
  
  try {
    await redis.setex(
      cacheKey,
      ttl,
      JSON.stringify(cachedToken)
    );
    
    logger.info('Token cached', { 
      tenantId, 
      provider, 
      ttl,
      expiresAt: new Date(cachedToken.expiresAt).toISOString()
    });
    
    metrics.increment('auth_cache_writes_total', { provider });
  } catch (error) {
    // Non-critical error - token still valid
    logger.error('Failed to cache token', { error, tenantId, provider });
  }
}
```

**Step 7: Complete Flow Orchestration**
```typescript
async function getGenesysToken(
  tenantId: string,
  forceRefresh: boolean = false,
  correlationId?: string
): Promise<TokenResponse> {
  const provider = ProviderType.GENESYS;
  const lockValue = `${Date.now()}-${Math.random()}`;
  
  try {
    // Step 1: Check cache (unless force refresh)
    if (!forceRefresh) {
      const cached = await checkCache(provider, tenantId);
      if (cached) {
        metrics.increment('auth_cache_hits_total', { provider });
        logger.debug('Token cache hit', { tenantId, correlationId });
        return cached;
      }
      
      metrics.increment('auth_cache_misses_total', { provider });
    }
    
    // Step 2: Try to acquire lock
    const lockAcquired = await acquireLock(provider, tenantId, lockValue);
    
    if (!lockAcquired) {
      // Step 3: Wait for another request to populate cache
      logger.debug('Lock not acquired, waiting for cache', { 
        tenantId, 
        correlationId 
      });
      
      const token = await waitForCachePopulation(provider, tenantId);
      if (token) {
        metrics.increment('auth_request_collapsed_total', { provider });
        return token;
      }
      
      // Timeout waiting - try to acquire lock again
      const retryLock = await acquireLock(provider, tenantId, lockValue);
      if (!retryLock) {
        throw new CacheError(
          ErrorCode.LOCK_ACQUISITION_FAILED,
          'Failed to acquire lock after timeout',
          'token_fetch',
          tenantId,
          correlationId
        );
      }
    }
    
    try {
      // Step 4: Fetch credentials
      const credentials = await fetchCredentials(tenantId, provider);
      if (!credentials.genesys) {
        throw new AuthServiceError(
          ErrorCode.CREDENTIALS_NOT_FOUND,
          `No Genesys credentials configured for tenant ${tenantId}`,
          404,
          tenantId,
          correlationId
        );
      }
      
      // Step 5: Perform OAuth exchange
      const oauthResponse = await performOAuthExchange(
        credentials.genesys,
        tenantId
      );
      
      // Step 6: Cache the token
      await cacheToken(
        provider,
        tenantId,
        oauthResponse.access_token,
        oauthResponse.expires_in
      );
      
      // Step 7: Return fresh token
      return {
        accessToken: oauthResponse.access_token,
        expiresIn: oauthResponse.expires_in,
        tokenType: oauthResponse.token_type,
        source: 'fresh',
        expiresAt: new Date(Date.now() + oauthResponse.expires_in * 1000)
      };
    } finally {
      // Always release lock
      await releaseLock(provider, tenantId, lockValue);
    }
  } catch (error) {
    logger.error('Token retrieval failed', { 
      error, 
      tenantId, 
      provider, 
      correlationId 
    });
    throw error;
  }
}
```

### 5.2 WhatsApp Token Retrieval Flow

**Requirement ID:** REQ-AUTH-03

**Flow Diagram:**
```
┌─────────────┐
│ Check Cache │
└──────┬──────┘
       │
    ┌──▼──┐
    │ Hit? │
    └─┬─┬─┘
      │ └─No──┐
     Yes      │
      │       ▼
      │  ┌────────────────────┐
      │  │ Fetch Credentials  │
      │  │ (from Tenant Svc)  │
      │  └─────────┬──────────┘
      │            │
      │            ▼
      │  ┌────────────────────┐
      │  │ Cache Token        │
      │  │ (configurable TTL) │
      │  └─────────┬──────────┘
      │            │
      └────────────┤
                   ▼
         ┌─────────────────┐
         │ Return Token    │
         └─────────────────┘
```

**Implementation:**
```typescript
async function getWhatsAppToken(
  tenantId: string,
  forceRefresh: boolean = false,
  correlationId?: string
): Promise<TokenResponse> {
  const provider = ProviderType.WHATSAPP;
  
  try {
    // Step 1: Check cache
    if (!forceRefresh) {
      const cached = await checkCache(provider, tenantId);
      if (cached) {
        metrics.increment('auth_cache_hits_total', { provider });
        logger.debug('WhatsApp token cache hit', { tenantId, correlationId });
        return cached;
      }
      
      metrics.increment('auth_cache_misses_total', { provider });
    }
    
    // Step 2: Fetch credentials (no lock needed - static token)
    const credentials = await fetchCredentials(tenantId, provider);
    if (!credentials.whatsapp) {
      throw new AuthServiceError(
        ErrorCode.CREDENTIALS_NOT_FOUND,
        `No WhatsApp credentials configured for tenant ${tenantId}`,
        404,
        tenantId,
        correlationId
      );
    }
    
    // Step 3: Determine TTL
    let ttl: number;
    if (credentials.whatsapp.expiresAt) {
      // Use actual expiration with buffer
      const expiresIn = Math.floor(
        (credentials.whatsapp.expiresAt.getTime() - Date.now()) / 1000
      );
      ttl = expiresIn - RedisTTL.WHATSAPP_SAFETY_BUFFER;
    } else {
      // Use default TTL
      ttl = RedisTTL.WHATSAPP_DEFAULT_TTL;
    }
    
    // Step 4: Cache token
    if (ttl > 0) {
      await cacheToken(
        provider,
        tenantId,
        credentials.whatsapp.systemUserToken,
        ttl
      );
    }
    
    // Step 5: Return token
    return {
      accessToken: credentials.whatsapp.systemUserToken,
      expiresIn: ttl,
      tokenType: 'Bearer',
      source: 'fresh',
      expiresAt: credentials.whatsapp.expiresAt || 
                 new Date(Date.now() + ttl * 1000)
    };
  } catch (error) {
    logger.error('WhatsApp token retrieval failed', { 
      error, 
      tenantId, 
      correlationId 
    });
    throw error;
  }
}
```

### 5.3 JWT Validation Flow

**Requirement ID:** REQ-PORTAL-01

**Flow Diagram:**
```
┌──────────────────┐
│ Receive JWT      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐      ┌─────────────┐
│ Check JWKS Cache │─Yes──│ Use Cached  │
└────────┬─────────┘      └──────┬──────┘
         │                       │
        No                       │
         │                       │
         ▼                       │
┌──────────────────┐             │
│ Fetch JWKS       │             │
│ (from Genesys)   │             │
└────────┬─────────┘             │
         │                       │
         ▼                       │
┌──────────────────┐             │
│ Cache JWKS       │             │
│ (6 hour TTL)     │             │
└────────┬─────────┘             │
         │                       │
         └───────────────────────┤
                                 ▼
                      ┌──────────────────┐
                      │ Verify Signature │
                      └────────┬─────────┘
                               │
                       ┌───────▼───────┐
                       │ Valid?        │
                       └───┬───────┬───┘
                          Yes     No
                           │       │
                           ▼       ▼
                    ┌──────────┐ ┌──────────┐
                    │ Validate │ │ Return   │
                    │ Claims   │ │ Invalid  │
                    └─────┬────┘ └──────────┘
                          │
                    ┌─────▼─────┐
                    │ Extract   │
                    │ User Info │
                    └─────┬─────┘
                          │
                          ▼
                    ┌──────────────┐
                    │ Return Valid │
                    └──────────────┘
```

**Implementation:**
```typescript
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';

/**
 * JWKS client with caching
 */
class JWKSCache {
  private clients: Map<GenesysRegion, jwksClient.JwksClient> = new Map();
  
  getClient(region: GenesysRegion): jwksClient.JwksClient {
    if (!this.clients.has(region)) {
      const client = jwksClient({
        jwksUri: `https://login.${region}.genesys.cloud/.well-known/jwks.json`,
        cache: true,
        cacheMaxAge: RedisTTL.JWKS_TTL * 1000,
        rateLimit: true,
        jwksRequestsPerMinute: 10
      });
      
      this.clients.set(region, client);
    }
    
    return this.clients.get(region)!;
  }
  
  async getSigningKey(region: GenesysRegion, kid: string): Promise<string> {
    try {
      const client = this.getClient(region);
      const key = await client.getSigningKey(kid);
      return key.getPublicKey();
    } catch (error) {
      logger.error('Failed to fetch signing key', { error, region, kid });
      throw new AuthServiceError(
        ErrorCode.JWKS_FETCH_FAILED,
        'Failed to fetch JWKS signing key',
        503
      );
    }
  }
}

const jwksCache = new JWKSCache();

/**
 * Validate JWT
 */
async function validateJWT(
  token: string,
  region: GenesysRegion
): Promise<JWTValidationResponse> {
  try {
    // Step 1: Decode to get header (kid)
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded || typeof decoded === 'string') {
      return {
        isValid: false,
        error: 'Invalid JWT format'
      };
    }
    
    const { header, payload } = decoded;
    
    // Step 2: Get signing key
    if (!header.kid) {
      return {
        isValid: false,
        error: 'Missing kid in JWT header'
      };
    }
    
    const signingKey = await jwksCache.getSigningKey(region, header.kid);
    
    // Step 3: Verify signature and claims
    const verified = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
      clockTolerance: 30  // Allow 30s clock skew
    });
    
    if (typeof verified === 'string') {
      return {
        isValid: false,
        error: 'Invalid JWT payload'
      };
    }
    
    // Step 4: Extract claims
    const userId = verified.sub;
    const orgId = verified.org_id || verified.organization_id;
    const roles = verified.roles || [];
    const expiresAt = verified.exp ? new Date(verified.exp * 1000) : undefined;
    
    if (!userId) {
      return {
        isValid: false,
        error: 'Missing required claim: sub'
      };
    }
    
    // Step 5: Return validation result
    metrics.increment('auth_jwt_validation_success_total', { region });
    
    return {
      isValid: true,
      userId,
      orgId,
      roles: Array.isArray(roles) ? roles : [],
      expiresAt
    };
  } catch (error: any) {
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      metrics.increment('auth_jwt_validation_failures_total', {
        region,
        reason: 'expired'
      });
      
      return {
        isValid: false,
        error: 'JWT has expired'
      };
    }
    
    if (error.name === 'JsonWebTokenError') {
      metrics.increment('auth_jwt_validation_failures_total', {
        region,
        reason: 'invalid_signature'
      });
      
      return {
        isValid: false,
        error: 'JWT signature verification failed'
      };
    }
    
    // Generic error
    logger.error('JWT validation error', { error, region });
    metrics.increment('auth_jwt_validation_failures_total', {
      region,
      reason: 'unknown'
    });
    
    return {
      isValid: false,
      error: error.message || 'JWT validation failed'
    };
  }
}
```

---

## 6. Error Handling

### 6.1 Error Classification

| Category | HTTP Status | Retry Strategy | Client Action |
|----------|-------------|----------------|---------------|
| Invalid Request | 400 | No retry | Fix request |
| Unauthorized | 401 | No retry | Update credentials |
| Not Found | 404 | No retry | Verify tenant exists |
| Rate Limited | 429 | Exponential backoff | Reduce request rate |
| Service Unavailable | 503 | Retry with backoff | Wait and retry |
| Internal Error | 500 | No retry | Contact support |

### 6.2 Redis Failure Handling

**Scenario:** Redis becomes unavailable

**Behavior:**
1. Detect Redis failure (connection timeout, connection refused)
2. Switch to degraded mode:
   - Skip cache checks
   - Skip distributed locks
   - Fetch tokens directly from IdP
   - Apply per-tenant rate limiting (in-memory)
3. Emit critical alert metric
4. Log degraded mode activation
5. Periodically check Redis health
6. Automatically exit degraded mode when Redis recovers

**Implementation:**
```typescript
class RedisHealthMonitor {
  private isHealthy: boolean = true;
  private lastCheck: Date = new Date();
  private checkInterval: number = 5000; // 5 seconds
  
  async checkHealth(): Promise<boolean> {
    try {
      await redis.ping();
      
      if (!this.isHealthy) {
        logger.info('Redis recovered');
        metrics.gauge('redis_health', 1);
      }
      
      this.isHealthy = true;
      this.lastCheck = new Date();
      return true;
    } catch (error) {
      if (this.isHealthy) {
        logger.error('Redis unhealthy', { error });
        metrics.gauge('redis_health', 0);
        metrics.increment('redis_failure_total');
      }
      
      this.isHealthy = false;
      this.lastCheck = new Date();
      return false;
    }
  }
  
  startMonitoring(): void {
    setInterval(() => this.checkHealth(), this.checkInterval);
  }
}

class DegradedModeRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequestsPerMinute: number = 10;
  
  async checkLimit(provider: ProviderType, tenantId: string): Promise<boolean> {
    const key = `${provider}:${tenantId}`;
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Get existing timestamps
    const timestamps = this.requests.get(key) || [];
    
    // Filter to last minute
    const recentTimestamps = timestamps.filter(ts => ts > oneMinuteAgo);
    
    // Check limit
    if (recentTimestamps.length >= this.maxRequestsPerMinute) {
      logger.warn('Degraded mode rate limit exceeded', { 
        provider, 
        tenantId,
        requests: recentTimestamps.length
      });
      
      metrics.increment('degraded_mode_rate_limit_total', { provider });
      return false;
    }
    
    // Add current request
    recentTimestamps.push(now);
    this.requests.set(key, recentTimestamps);
    
    return true;
  }
}

const healthMonitor = new RedisHealthMonitor();
const degradedLimiter = new DegradedModeRateLimiter();

healthMonitor.startMonitoring();

// Updated token retrieval with degraded mode
async function getTokenWithFallback(
  tenantId: string,
  type: ProviderType,
  forceRefresh: boolean = false
): Promise<TokenResponse> {
  const isRedisHealthy = await healthMonitor.checkHealth();
  
  if (!isRedisHealthy) {
    // Degraded mode
    logger.warn('Operating in degraded mode (Redis unavailable)', {
      tenantId,
      type
    });
    
    metrics.increment('degraded_mode_requests_total', { provider: type });
    
    // Apply in-memory rate limiting
    const allowed = await degradedLimiter.checkLimit(type, tenantId);
    if (!allowed) {
      throw new CacheError(
        ErrorCode.CACHE_UNAVAILABLE,
        'Rate limit exceeded in degraded mode',
        'token_fetch',
        tenantId
      );
    }
    
    // Fetch directly from IdP (no cache, no lock)
    return await fetchTokenDirectly(tenantId, type);
  }
  
  // Normal mode
  if (type === ProviderType.GENESYS) {
    return await getGenesysToken(tenantId, forceRefresh);
  } else {
    return await getWhatsAppToken(tenantId, forceRefresh);
  }
}

async function fetchTokenDirectly(
  tenantId: string,
  type: ProviderType
): Promise<TokenResponse> {
  // Simplified direct fetch without caching
  const credentials = await fetchCredentials(tenantId, type);
  
  if (type === ProviderType.GENESYS && credentials.genesys) {
    const oauthResponse = await performOAuthExchange(
      credentials.genesys,
      tenantId
    );
    
    return {
      accessToken: oauthResponse.access_token,
      expiresIn: oauthResponse.expires_in,
      tokenType: oauthResponse.token_type,
      source: 'fresh',
      expiresAt: new Date(Date.now() + oauthResponse.expires_in * 1000)
    };
  } else if (type === ProviderType.WHATSAPP && credentials.whatsapp) {
    const expiresIn = credentials.whatsapp.expiresAt
      ? Math.floor((credentials.whatsapp.expiresAt.getTime() - Date.now()) / 1000)
      : RedisTTL.WHATSAPP_DEFAULT_TTL;
    
    return {
      accessToken: credentials.whatsapp.systemUserToken,
      expiresIn,
      tokenType: 'Bearer',
      source: 'fresh',
      expiresAt: credentials.whatsapp.expiresAt || 
                 new Date(Date.now() + expiresIn * 1000)
    };
  }
  
  throw new AuthServiceError(
    ErrorCode.CREDENTIALS_NOT_FOUND,
    `No ${type} credentials found for tenant`,
    404,
    tenantId
  );
}
```

### 6.3 Tenant Service Failure

**Scenario:** Tenant Service is unavailable or returns errors

**Behavior:**
- HTTP 404: Tenant not found → Return 404 to caller
- HTTP 5xx: Service error → Retry up to 2 times with exponential backoff
- Timeout: → Retry up to 2 times
- Network error: → Retry up to 2 times

**Implementation:**
```typescript
async function fetchCredentialsWithRetry(
  tenantId: string,
  type: ProviderType,
  maxRetries: number = 2
): Promise<TenantCredentials> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchCredentials(tenantId, type);
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on 404 or 400
      if (error.statusCode === 404 || error.statusCode === 400) {
        throw error;
      }
      
      // Retry on 5xx or network errors
      if (attempt < maxRetries) {
        const delay = Math.min(500 * Math.pow(2, attempt), 4000);
        logger.warn('Tenant Service request failed, retrying', {
          tenantId,
          attempt,
          delay,
          error: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  
  logger.error('Tenant Service request failed after retries', {
    tenantId,
    maxRetries,
    error: lastError.message
  });
  
  throw lastError;
}
```

---

## 7. Security Requirements

### 7.1 Secret Handling

**CRITICAL RULES:**

1. **Never log secrets:**
   - clientSecret
   - systemUserToken
   - accessToken (in logs)
   - Decrypted credentials

2. **Memory handling:**
```typescript
// Example: Secure credential handling
async function secureCredentialHandling(
  credentials: GenesysCredentials
): Promise<void> {
  try {
    // Use credentials
    await performOAuthExchange(credentials, 'tenant-123');
  } finally {
    // Zero out sensitive data
    if (credentials.clientSecret) {
      credentials.clientSecret = '\0'.repeat(credentials.clientSecret.length);
    }
  }
}
```

3. **Encryption at rest:**
   - All credentials encrypted in Tenant Service
   - Decryption only in auth-service memory
   - Use AWS KMS, HashiCorp Vault, or similar

4. **Transport security:**
   - TLS 1.2+ for all external communication
   - mTLS for internal service communication (recommended)

### 7.2 Logging Security

**Safe Logging Pattern:**
```typescript
// ❌ NEVER do this
logger.error('OAuth failed', { 
  clientSecret: credentials.clientSecret,  // VIOLATION
  accessToken: token                       // VIOLATION
});

// ✅ ALWAYS do this
logger.error('OAuth failed', {
  tenantId,
  provider: 'genesys',
  region: credentials.region,
  // NO secrets logged
});

// ✅ Safe to log
logger.info('Token cached', {
  tenantId,
  provider,
  ttl,
  expiresAt,
  source: 'fresh',
  tokenLength: token.length  // Length is safe
});
```

### 7.3 API Security

**Request Authentication:**
```typescript
// Internal service authentication middleware
function internalServiceAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: ErrorCode.INVALID_REQUEST,
        message: 'Missing or invalid Authorization header'
      }
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Verify internal service token
    const verified = jwt.verify(token, config.internalServiceSecret);
    req.context = { serviceName: verified.serviceName };
    next();
  } catch (error) {
    return res.status(401).json({
      error: {
        code: ErrorCode.INVALID_REQUEST,
        message: 'Invalid service token'
      }
    });
  }
}

// Apply to all routes
app.use('/api/v1', internalServiceAuth);
```

### 7.4 Input Validation

```typescript
import * as Joi from 'joi';

const tokenRequestSchema = Joi.object({
  tenantId: Joi.string().uuid().required(),
  type: Joi.string().valid('genesys', 'whatsapp').required(),
  forceRefresh: Joi.boolean().optional().default(false),
  correlationId: Joi.string().max(100).optional()
});

const jwtValidationRequestSchema = Joi.object({
  token: Joi.string().required().min(1),
  region: Joi.string().valid(...Object.values(GenesysRegion)).required()
});

function validateRequest<T>(
  schema: Joi.Schema,
  data: any
): T {
  const { error, value } = schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true 
  });
  
  if (error) {
    throw new AuthServiceError(
      ErrorCode.INVALID_REQUEST,
      `Validation failed: ${error.message}`,
      400
    );
  }
  
  return value as T;
}
```

---

## 8. Performance Requirements

### 8.1 Latency Targets

| Operation | P50 | P95 | P99 | Description |
|-----------|-----|-----|-----|-------------|
| Token (cache hit) | < 3ms | < 5ms | < 10ms | Redis GET latency |
| Token (cache miss) | < 300ms | < 500ms | < 1000ms | Full OAuth flow |
| JWT validation | < 10ms | < 20ms | < 50ms | With JWKS cache |
| Health check | < 50ms | < 100ms | < 200ms | Dependency checks |

### 8.2 Throughput Targets

- **Sustained:** 100 requests/sec per instance
- **Peak:** 500 requests/sec per instance
- **Horizontal scaling:** 3-10 instances (based on load)

### 8.3 Cache Hit Rate

- **Target:** > 95% cache hit rate for tokens
- **Monitoring:** Track `auth_cache_hits_total / auth_token_requests_total`

### 8.4 Resource Limits

```typescript
// Example configuration
const config = {
  // Connection pools
  redis: {
    maxConnections: 50,
    minConnections: 10,
    connectionTimeout: 5000
  },
  
  http: {
    maxSockets: 100,
    maxFreeSockets: 10,
    timeout: 3000
  },
  
  // Rate limiting
  rateLimits: {
    perTenantPerMinute: 60,
    perServicePerMinute: 1000
  },
  
  // Memory
  maxMemoryMB: 512,
  
  // Workers (for Node.js cluster)
  workers: 4  // CPU cores
};
```

---

## 9. Implementation Guide

### 9.1 Technology Stack Recommendation

**Primary Stack:**
- **Runtime:** Node.js 20+ (TypeScript 5+)
- **Framework:** Express.js 4.x or Fastify 4.x
- **Redis Client:** ioredis 5.x
- **HTTP Client:** axios 1.x with retry logic
- **JWT:** jsonwebtoken 9.x + jwks-rsa 3.x
- **Validation:** Joi 17.x
- **Logging:** winston 3.x or pino 8.x
- **Metrics:** prom-client 15.x (Prometheus)

**Alternative Stack:**
- **Runtime:** Go 1.21+
- **Framework:** Gin or Fiber
- **Redis Client:** go-redis/redis v9
- **HTTP Client:** standard library with retries
- **JWT:** golang-jwt/jwt v5
- **Logging:** zap or zerolog
- **Metrics:** prometheus/client_golang

### 9.2 Folder Structure (Node.js/TypeScript)

```
auth-service/
├── src/
│   ├── api/
│   │   ├── controllers/
│   │   │   ├── token.controller.ts
│   │   │   ├── jwt.controller.ts
│   │   │   └── health.controller.ts
│   │   ├── routes/
│   │   │   ├── index.ts
│   │   │   ├── token.routes.ts
│   │   │   ├── jwt.routes.ts
│   │   │   └── health.routes.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── validation.middleware.ts
│   │   │   ├── error.middleware.ts
│   │   │   ├── correlation.middleware.ts
│   │   │   └── metrics.middleware.ts
│   │   └── validators/
│   │       ├── token.validator.ts
│   │       └── jwt.validator.ts
│   ├── services/
│   │   ├── token/
│   │   │   ├── token.service.ts
│   │   │   ├── genesys-token.service.ts
│   │   │   ├── whatsapp-token.service.ts
│   │   │   └── token-cache.service.ts
│   │   ├── oauth/
│   │   │   ├── oauth.service.ts
│   │   │   ├── oauth-client.factory.ts
│   │   │   └── genesys-oauth.client.ts
│   │   ├── jwt/
│   │   │   ├── jwt-validator.service.ts
│   │   │   └── jwks-cache.service.ts
│   │   ├── credentials/
│   │   │   └── credential-fetcher.service.ts
│   │   └── health/
│   │       └── health-monitor.service.ts
│   ├── repositories/
│   │   ├── token-cache.repository.ts
│   │   ├── lock.repository.ts
│   │   └── redis.client.ts
│   ├── models/
│   │   ├── token.model.ts
│   │   ├── credentials.model.ts
│   │   ├── errors.model.ts
│   │   └── enums.ts
│   ├── config/
│   │   ├── index.ts
│   │   ├── app.config.ts
│   │   ├── redis.config.ts
│   │   ├── providers.config.ts
│   │   └── logging.config.ts
│   ├── utils/
│   │   ├── crypto.util.ts
│   │   ├── logger.util.ts
│   │   ├── metrics.util.ts
│   │   └── redis-keys.util.ts
│   ├── app.ts
│   └── server.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
│   └── seed-test-data.ts
├── .env.example
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

### 9.3 Key Implementation Classes

**Token Service (Main Orchestrator):**
```typescript
// src/services/token/token.service.ts
export class TokenService {
  constructor(
    private genesysTokenService: GenesysTokenService,
    private whatsappTokenService: WhatsAppTokenService
  ) {}

  async getToken(request: TokenRequest): Promise<TokenResponse> {
    const { type, tenantId, forceRefresh, correlationId } = request;
    
    logger.info('Token request received', { 
      tenantId, 
      type, 
      forceRefresh,
      correlationId 
    });
    
    metrics.increment('auth_token_requests_total', { provider: type });
    
    const startTime = Date.now();
    
    try {
      let token: TokenResponse;
      
      if (type === ProviderType.GENESYS) {
        token = await this.genesysTokenService.getToken(
          tenantId,
          forceRefresh,
          correlationId
        );
      } else if (type === ProviderType.WHATSAPP) {
        token = await this.whatsappTokenService.getToken(
          tenantId,
          forceRefresh,
          correlationId
        );
      } else {
        throw new AuthServiceError(
          ErrorCode.INVALID_REQUEST,
          `Unsupported provider type: ${type}`,
          400,
          tenantId,
          correlationId
        );
      }
      
      const duration = Date.now() - startTime;
      metrics.histogram('auth_token_request_duration_ms', duration, {
        provider: type,
        source: token.source
      });
      
      logger.info('Token request completed', {
        tenantId,
        type,
        source: token.source,
        duration,
        correlationId
      });
      
      return token;
    } catch (error) {
      const duration = Date.now() - startTime;
      metrics.histogram('auth_token_request_duration_ms', duration, {
        provider: type,
        source: 'error'
      });
      
      throw error;
    }
  }
}
```

**Redis Client (Singleton):**
```typescript
// src/repositories/redis.client.ts
import Redis from 'ioredis';

class RedisClient {
  private static instance: Redis;
  
  static getInstance(): Redis {
    if (!RedisClient.instance) {
      RedisClient.instance = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy: (times: number) => {
          if (times > 10) return null;
          return Math.min(times * 100, 3000);
        },
        reconnectOnError: (err: Error) => {
          logger.error('Redis error', { error: err.message });
          return true;
        }
      });
      
      RedisClient.instance.on('connect', () => {
        logger.info('Redis connected');
        metrics.gauge('redis_connection_status', 1);
      });
      
      RedisClient.instance.on('error', (error) => {
        logger.error('Redis connection error', { error: error.message });
        metrics.gauge('redis_connection_status', 0);
      });
      
      RedisClient.instance.on('close', () => {
        logger.warn('Redis connection closed');
        metrics.gauge('redis_connection_status', 0);
      });
    }
    
    return RedisClient.instance;
  }
}

export const redis = RedisClient.getInstance();
```

### 9.4 Dependency Injection Setup

```typescript
// src/app.ts
import { Container } from 'inversify';
import { TYPES } from './types';

const container = new Container();

// Repositories
container.bind(TYPES.TokenCacheRepository).to(TokenCacheRepository);
container.bind(TYPES.LockRepository).to(LockRepository);

// Services
container.bind(TYPES.CredentialFetcherService).to(CredentialFetcherService);
container.bind(TYPES.OAuthService).to(OAuthService);
container.bind(TYPES.JWTValidatorService).to(JWTValidatorService);
container.bind(TYPES.GenesysTokenService).to(GenesysTokenService);
container.bind(TYPES.WhatsAppTokenService).to(WhatsAppTokenService);
container.bind(TYPES.TokenService).to(TokenService);

// Controllers
container.bind(TYPES.TokenController).to(TokenController);
container.bind(TYPES.JWTController).to(JWTController);
container.bind(TYPES.HealthController).to(HealthController);

export { container };
```

---

## 10. Test Scenarios

### 10.1 Unit Tests

**Test: Token Cache Hit**
```typescript
describe('TokenService', () => {
  let tokenService: TokenService;
  let mockCache: jest.Mocked<TokenCacheRepository>;
  
  beforeEach(() => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn()
    } as any;
    
    tokenService = new TokenService(/* inject mocks */);
  });
  
  it('should return cached token when cache hit', async () => {
    // Arrange
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    const cachedToken: CachedToken = {
      token: 'cached-token-123',
      expiresAt: Date.now() + 3600000,
      cachedAt: Date.now()
    };
    
    mockCache.get.mockResolvedValue(cachedToken);
    
    // Act
    const result = await tokenService.getToken({
      tenantId,
      type: ProviderType.GENESYS
    });
    
    // Assert
    expect(result.accessToken).toBe('cached-token-123');
    expect(result.source).toBe('cache');
    expect(mockCache.get).toHaveBeenCalledWith(
      ProviderType.GENESYS,
      tenantId
    );
  });
});
```

**Test: OAuth Exchange Failure**
```typescript
it('should retry on OAuth timeout', async () => {
  // Arrange
  const tenantId = '550e8400-e29b-41d4-a716-446655440000';
  const credentials: GenesysCredentials = {
    clientId: 'client-123',
    clientSecret: 'secret-456',
    region: GenesysRegion.US_EAST_1
  };
  
  mockOAuthClient.exchange
    .mockRejectedValueOnce(new Error('ETIMEDOUT'))
    .mockResolvedValueOnce({
      access_token: 'token-123',
      token_type: 'Bearer',
      expires_in: 86400
    });
  
  // Act
  const result = await oauthService.performExchange(credentials, tenantId);
  
  // Assert
  expect(result.access_token).toBe('token-123');
  expect(mockOAuthClient.exchange).toHaveBeenCalledTimes(2);
});
```

### 10.2 Integration Tests

**Test: Full Token Flow with Redis**
```typescript
describe('Token Flow Integration', () => {
  let redis: Redis;
  
  beforeAll(async () => {
    // Use test Redis instance
    redis = new Redis(testConfig.redis);
    await redis.flushdb();
  });
  
  afterAll(async () => {
    await redis.quit();
  });
  
  it('should fetch, cache, and retrieve token', async () => {
    // Mock Tenant Service
    nock(config.tenantServiceUrl)
      .get('/tenants/test-tenant/credentials')
      .query({ type: 'genesys' })
      .reply(200, {
        tenantId: 'test-tenant',
        type: 'genesys',
        genesys: {
          clientId: 'test-client',
          clientSecret: 'test-secret',
          region: 'us-east-1'
        }
      });
    
    // Mock Genesys OAuth
    nock('https://login.us-east-1.genesys.cloud')
      .post('/oauth/token')
      .reply(200, {
        access_token: 'test-token-123',
        token_type: 'Bearer',
        expires_in: 86400
      });
    
    // First request - cache miss
    const token1 = await tokenService.getToken({
      tenantId: 'test-tenant',
      type: ProviderType.GENESYS
    });
    
    expect(token1.source).toBe('fresh');
    expect(token1.accessToken).toBe('test-token-123');
    
    // Second request - cache hit
    const token2 = await tokenService.getToken({
      tenantId: 'test-tenant',
      type: ProviderType.GENESYS
    });
    
    expect(token2.source).toBe('cache');
    expect(token2.accessToken).toBe('test-token-123');
  });
});
```

### 10.3 Load Tests

**Test: Request Collapsing Under Load**
```typescript
describe('Load Tests', () => {
  it('should handle concurrent requests with request collapsing', async () => {
    // Mock slow OAuth response
    nock('https://login.us-east-1.genesys.cloud')
      .post('/oauth/token')
      .delay(500)  // 500ms delay
      .reply(200, {
        access_token: 'token-123',
        token_type: 'Bearer',
        expires_in: 86400
      });
    
    // Fire 100 concurrent requests
    const requests = Array.from({ length: 100 }, () => 
      tokenService.getToken({
        tenantId: 'test-tenant',
        type: ProviderType.GENESYS
      })
    );
    
    const results = await Promise.all(requests);
    
    // All should succeed
    expect(results.every(r => r.accessToken === 'token-123')).toBe(true);
    
    // Only 1 or 2 OAuth calls should have been made
    // (1 if perfect collapsing, 2 if lock timeout occurred)
    expect(nock.pendingMocks().length).toBeLessThanOrEqual(2);
  });
});
```

### 10.4 Edge Case Tests

**Test: Clock Skew**
```typescript
it('should handle JWT with clock skew', async () => {
  // Create JWT that expires in 25 seconds
  const futureToken = jwt.sign(
    {
      sub: 'user-123',
      org_id: 'org-456',
      exp: Math.floor(Date.now() / 1000) + 25
    },
    privateKey,
    { algorithm: 'RS256', keyid: 'test-key' }
  );
  
  // Should be valid with 30s clock tolerance
  const result = await jwtValidator.validate(futureToken, 'us-east-1');
  expect(result.isValid).toBe(true);
});
```

**Test: Token Expiring During Request**
```typescript
it('should handle token expiring mid-request', async () => {
  // Cache token that expires in 1 second
  const shortLivedToken: CachedToken = {
    token: 'expires-soon',
    expiresAt: Date.now() + 1000,
    cachedAt: Date.now()
  };
  
  await redis.setex(
    'auth:token:genesys:test-tenant',
    1,
    JSON.stringify(shortLivedToken)
  );
  
  // Wait for expiration
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Should fetch fresh token
  const result = await tokenService.getToken({
    tenantId: 'test-tenant',
    type: ProviderType.GENESYS
  });
  
  expect(result.source).toBe('fresh');
  expect(result.accessToken).not.toBe('expires-soon');
});
```

---

## 11. Configuration

### 11.1 Environment Variables

```bash
# App
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TLS_ENABLED=false

# Tenant Service
TENANT_SERVICE_URL=https://tenant-service.internal
TENANT_SERVICE_TIMEOUT=3000

# Internal Auth
INTERNAL_SERVICE_SECRET=your-secret-key-here

# Encryption
ENCRYPTION_KEY=your-encryption-key-here
ENCRYPTION_ALGORITHM=aes-256-gcm

# Rate Limiting
RATE_LIMIT_PER_TENANT_PER_MINUTE=60
RATE_LIMIT_PER_SERVICE_PER_MINUTE=1000

# Cache TTLs
TOKEN_SAFETY_BUFFER_SECONDS=60
LOCK_TTL_SECONDS=30
JWKS_TTL_SECONDS=21600
WHATSAPP_DEFAULT_TTL_SECONDS=86400

# OAuth
OAUTH_TIMEOUT_MS=3000
OAUTH_MAX_RETRIES=2

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090
SENTRY_DSN=

# Health Check
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_INTERVAL_MS=5000
```

### 11.2 Configuration Schema

```typescript
// src/config/index.ts
import * as Joi from 'joi';

const configSchema = Joi.object({
  app: Joi.object({
    env: Joi.string().valid('development', 'staging', 'production').required(),
    port: Joi.number().port().default(3000),
    logLevel: Joi.string().valid('error', 'warn', 'info', 'debug').default('info')
  }),
  
  redis: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().port().required(),
    password: Joi.string().allow('').optional(),
    db: Joi.number().integer().min(0).max(15).default(0),
    tlsEnabled: Joi.boolean().default(false)
  }),
  
  tenantService: Joi.object({
    url: Joi.string().uri().required(),
    timeout: Joi.number().integer().positive().default(3000)
  }),
  
  internalAuth: Joi.object({
    secret: Joi.string().min(32).required()
  }),
  
  encryption: Joi.object({
    key: Joi.string().required(),
    algorithm: Joi.string().default('aes-256-gcm')
  }),
  
  rateLimiting: Joi.object({
    perTenantPerMinute: Joi.number().integer().positive().default(60),
    perServicePerMinute: Joi.number().integer().positive().default(1000)
  }),
  
  ttls: Joi.object({
    tokenSafetyBuffer: Joi.number().integer().positive().default(60),
    lockTTL: Joi.number().integer().positive().default(30),
    jwksTTL: Joi.number().integer().positive().default(21600),
    whatsappDefault: Joi.number().integer().positive().default(86400)
  }),
  
  oauth: Joi.object({
    timeout: Joi.number().integer().positive().default(3000),
    maxRetries: Joi.number().integer().min(0).max(5).default(2)
  }),
  
  monitoring: Joi.object({
    metricsEnabled: Joi.boolean().default(true),
    metricsPort: Joi.number().port().default(9090),
    sentryDSN: Joi.string().uri().allow('').optional()
  }),
  
  healthCheck: Joi.object({
    enabled: Joi.boolean().default(true),
    intervalMs: Joi.number().integer().positive().default(5000)
  })
});

export const config = validateConfig();

function validateConfig() {
  const rawConfig = {
    app: {
      env: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT || '3000'),
      logLevel: process.env.LOG_LEVEL || 'info'
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      tlsEnabled: process.env.REDIS_TLS_ENABLED === 'true'
    },
    // ... map all env vars
  };
  
  const { error, value } = configSchema.validate(rawConfig, { 
    abortEarly: false 
  });
  
  if (error) {
    throw new Error(`Config validation failed: ${error.message}`);
  }
  
  return value;
}
```

---

## 12. Monitoring & Observability

### 12.1 Metrics

**Counter Metrics:**
```typescript
// Total token requests
auth_token_requests_total{provider="genesys|whatsapp"}

// Cache performance
auth_cache_hits_total{provider="genesys|whatsapp"}
auth_cache_misses_total{provider="genesys|whatsapp"}
auth_cache_writes_total{provider="genesys|whatsapp"}

// OAuth
auth_oauth_success_total{provider="genesys",region="us-east-1"}
auth_oauth_failures_total{provider="genesys",reason="invalid_credentials|timeout|rate_limited"}

// JWT
auth_jwt_validation_success_total{region="us-east-1"}
auth_jwt_validation_failures_total{region="us-east-1",reason="expired|invalid_signature"}

// Request collapsing
auth_request_collapsed_total{provider="genesys|whatsapp"}

// Rate limiting
auth_rate_limit_events_total{provider="genesys|whatsapp"}

// Degraded mode
degraded_mode_requests_total{provider="genesys|whatsapp"}
degraded_mode_rate_limit_total{provider="genesys|whatsapp"}

// Redis
redis_failure_total
```

**Histogram Metrics:**
```typescript
// Request duration
auth_token_request_duration_ms{provider="genesys|whatsapp",source="cache|fresh|error"}
// Buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]

// OAuth duration
auth_oauth_exchange_duration_ms{provider="genesys",region="us-east-1"}
// Buckets: [100, 250, 500, 1000, 2000, 3000, 5000]

// JWT validation duration
auth_jwt_validation_duration_ms{region="us-east-1"}
// Buckets: [1, 5, 10, 20, 50, 100, 200]
```

**Gauge Metrics:**
```typescript
// Health status
redis_health{} // 1 = healthy, 0 = unhealthy
redis_connection_status{} // 1 = connected, 0 = disconnected
tenant_service_health{} // 1 = healthy, 0 = unhealthy

// Cache stats
auth_cached_tokens_count{provider="genesys|whatsapp"}
```

### 12.2 Logging

**Log Levels:**
- **ERROR:** Failed operations, exceptions
- **WARN:** Degraded mode, retries, rate limits
- **INFO:** Successful operations, cache hits/misses
- **DEBUG:** Detailed flow, parameter values

**Structured Log Format:**
```json
{
  "timestamp": "2026-02-12T12:00:00.000Z",
  "level": "info",
  "service": "auth-service",
  "correlationId": "req-abc-123",
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "provider": "genesys",
  "message": "Token request completed",
  "duration": 245,
  "source": "cache"
}
```

**Key Log Events:**
```typescript
// Token operations
logger.info('Token request received', { tenantId, provider, correlationId });
logger.info('Token cache hit', { tenantId, provider });
logger.info('Token cache miss', { tenantId, provider });
logger.info('Token request completed', { tenantId, provider, source, duration });

// OAuth
logger.info('OAuth exchange started', { tenantId, region });
logger.info('OAuth exchange completed', { tenantId, region, duration });
logger.warn('OAuth retry attempt', { tenantId, attempt, reason });
logger.error('OAuth exchange failed', { tenantId, region, error });

// Redis
logger.warn('Cache check failed', { error, tenantId, provider });
logger.error('Redis unhealthy', { error });
logger.info('Redis recovered');
logger.warn('Operating in degraded mode');

// Security
logger.error('JWT validation failed', { region, reason }); // No token in log
logger.error('OAuth credentials invalid', { tenantId, region }); // No secrets
```

### 12.3 Alerts

**Critical Alerts:**
1. **Redis Down**
   - Condition: `redis_health == 0` for > 1 minute
   - Action: Page on-call, activate degraded mode

2. **High OAuth Failure Rate**
   - Condition: `rate(auth_oauth_failures_total[5m]) / rate(auth_token_requests_total[5m]) > 0.1`
   - Action: Alert team, check credentials

3. **Low Cache Hit Rate**
   - Condition: `auth_cache_hits_total / auth_token_requests_total < 0.8`
   - Action: Investigate cache TTLs, check Redis

4. **High Latency**
   - Condition: `p95(auth_token_request_duration_ms) > 1000ms`
   - Action: Check dependencies, scale up

**Warning Alerts:**
1. **Degraded Mode Active**
   - Condition: `degraded_mode_requests_total > 0`
   - Action: Monitor, investigate Redis

2. **Rate Limiting**
   - Condition: `rate(auth_rate_limit_events_total[5m]) > 10`
   - Action: Check tenant activity, verify limits

3. **JWT Validation Failures**
   - Condition: `rate(auth_jwt_validation_failures_total[5m]) > 5`
   - Action: Check JWKS availability, clock sync

### 12.4 Dashboards

**Dashboard 1: Service Health**
- Service uptime
- Request rate (req/sec)
- Error rate (%)
- p50/p95/p99 latency
- Dependency health (Redis, Tenant Service)

**Dashboard 2: Token Operations**
- Token requests by provider
- Cache hit rate
- Cache miss rate
- Fresh token fetches
- Request collapsed count

**Dashboard 3: OAuth Performance**
- OAuth exchange success rate
- OAuth exchange duration
- OAuth retry count
- Rate limit events by provider
- Failure reasons breakdown

**Dashboard 4: JWT Validation**
- Validation requests
- Validation success rate
- Validation duration
- Failure reasons (expired, invalid signature, etc.)
- JWKS cache hits

---

## Appendix A: Genesys Region Endpoints

| Region | OAuth Endpoint | JWKS Endpoint |
|--------|----------------|---------------|
| us-east-1 | `https://login.use1.us-gov-pure-cloud.com/oauth/token` | `https://login.use1.us-gov-pure-cloud.com/.well-known/jwks.json` |
| us-east-2 | `https://login.us-east-2.pure.cloud/oauth/token` | `https://login.us-east-2.pure.cloud/.well-known/jwks.json` |
| us-west-2 | `https://login.usw2.pure.cloud/oauth/token` | `https://login.usw2.pure.cloud/.well-known/jwks.json` |
| ca-central-1 | `https://login.cac1.pure.cloud/oauth/token` | `https://login.cac1.pure.cloud/.well-known/jwks.json` |
| eu-west-1 | `https://login.mypurecloud.ie/oauth/token` | `https://login.mypurecloud.ie/.well-known/jwks.json` |
| eu-west-2 | `https://login.euw2.pure.cloud/oauth/token` | `https://login.euw2.pure.cloud/.well-known/jwks.json` |
| eu-central-1 | `https://login.mypurecloud.de/oauth/token` | `https://login.mypurecloud.de/.well-known/jwks.json` |
| ap-southeast-2 | `https://login.mypurecloud.com.au/oauth/token` | `https://login.mypurecloud.com.au/.well-known/jwks.json` |
| ap-northeast-1 | `https://login.mypurecloud.jp/oauth/token` | `https://login.mypurecloud.jp/.well-known/jwks.json` |
| ap-northeast-2 | `https://login.apne2.pure.cloud/oauth/token` | `https://login.apne2.pure.cloud/.well-known/jwks.json` |
| ap-south-1 | `https://login.aps1.pure.cloud/oauth/token` | `https://login.aps1.pure.cloud/.well-known/jwks.json` |

---

## Appendix B: Checklist for Implementation

### Phase 1: Foundation
- [ ] Set up project structure
- [ ] Configure TypeScript/ESLint/Prettier
- [ ] Set up dependency injection (InversifyJS)
- [ ] Create base error classes
- [ ] Implement configuration management
- [ ] Set up structured logging (Winston/Pino)
- [ ] Set up metrics (Prometheus)

### Phase 2: Core Infrastructure
- [ ] Implement Redis client with connection pooling
- [ ] Create Redis key utility
- [ ] Implement distributed lock repository
- [ ] Implement token cache repository
- [ ] Set up health monitoring service
- [ ] Implement HTTP client with retry logic

### Phase 3: Credential & OAuth
- [ ] Implement credential fetcher service
- [ ] Implement encryption/decryption utilities
- [ ] Create Genesys OAuth client
- [ ] Implement OAuth service with retry and backoff
- [ ] Add secret zeroization

### Phase 4: Token Services
- [ ] Implement Genesys token service
- [ ] Implement WhatsApp token service
- [ ] Implement main token orchestrator
- [ ] Add request collapsing logic
- [ ] Implement degraded mode fallback

### Phase 5: JWT Validation
- [ ] Implement JWKS cache service
- [ ] Implement JWT validator service
- [ ] Add clock skew tolerance
- [ ] Test with all Genesys regions

### Phase 6: API Layer
- [ ] Create Express/Fastify app
- [ ] Implement authentication middleware
- [ ] Implement validation middleware
- [ ] Implement error handling middleware
- [ ] Implement correlation ID middleware
- [ ] Create token routes & controller
- [ ] Create JWT validation routes & controller
- [ ] Create health check endpoint

### Phase 7: Testing
- [ ] Write unit tests (>80% coverage)
- [ ] Write integration tests with test Redis
- [ ] Write end-to-end tests
- [ ] Perform load testing
- [ ] Test edge cases (clock skew, expiring tokens, etc.)
- [ ] Test failure scenarios (Redis down, OAuth timeouts)

### Phase 8: Deployment
- [ ] Create Dockerfile
- [ ] Create docker-compose for local development
- [ ] Set up CI/CD pipeline
- [ ] Configure environment variables
- [ ] Set up monitoring dashboards
- [ ] Configure alerts
- [ ] Deploy to staging
- [ ] Perform smoke tests
- [ ] Deploy to production

### Phase 9: Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Developer guide (README)
- [ ] Runbook for operations
- [ ] Architecture diagram
- [ ] Deployment guide

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | Original | Initial functional requirements |
| 1.2 | 2025-02-01 | Original | Enterprise hardening updates |
| 2.0 | 2026-02-12 | LLM-Optimized | Complete rewrite for code generation |

---

**END OF DOCUMENT**
--- END auth-service/auth-frd.md ---


--- BEGIN genesys-api-service/genesys-api-frd.md ---

# Genesys API Service - Comprehensive Requirements Document

**Version:** 1.1 (Enhanced MVP)  
**Service Name:** `genesys-api-service`  
**Document Purpose:** Code generation, implementation guidance, and debugging reference  
**Parent Document:** System Design Document

---

## Table of Contents

1. [Service Overview](#service-overview)
2. [Architecture Context](#architecture-context)
3. [Core Responsibilities](#core-responsibilities)
4. [Technology Stack & Dependencies](#technology-stack--dependencies)
5. [Data Contracts](#data-contracts)
6. [Functional Requirements](#functional-requirements)
7. [Authentication & Authorization](#authentication--authorization)
8. [Rate Limiting & Throttling](#rate-limiting--throttling)
9. [Error Handling & Resilience](#error-handling--resilience)
10. [Non-Functional Requirements](#non-functional-requirements)
11. [Security Requirements](#security-requirements)
12. [Observability & Monitoring](#observability--monitoring)
13. [Testing Requirements](#testing-requirements)
14. [Deployment & Operations](#deployment--operations)
15. [Implementation Guidelines](#implementation-guidelines)
16. [Common Pitfalls & Anti-Patterns](#common-pitfalls--anti-patterns)

---

## Service Overview

### Purpose
The **Genesys API Service** is a stateless, queue-driven, multi-tenant gateway that delivers enriched WhatsApp inbound messages to Genesys Cloud using the Open Messaging Inbound API. It acts as the critical bridge between internal middleware and the Genesys ecosystem.

### Key Characteristics
- **Stateless**: No persistent storage, horizontally scalable
- **Queue-Driven**: Consumes from RabbitMQ, publishes correlation events
- **Multi-Tenant**: Strict tenant isolation with per-tenant configuration
- **OAuth-Authenticated**: Secure token management with caching
- **Rate-Limit Compliant**: Respects Genesys API throttling limits
- **Resilient**: Retry logic, circuit breakers, graceful degradation

### What This Service DOES
✅ Consume enriched messages from RabbitMQ  
✅ Retrieve and cache OAuth tokens per tenant  
✅ Deliver messages to Genesys Cloud Open Messaging API  
✅ Handle region-specific endpoints dynamically  
✅ Capture conversation IDs and publish correlation events  
✅ Implement rate limiting per tenant and globally  
✅ Handle retries with exponential backoff  
✅ Route failures to dead-letter queue  
✅ Emit metrics and structured logs  

### What This Service DOES NOT DO
❌ Message transformation (handled by Inbound Transformer)  
❌ Identity resolution (handled by State Manager)  
❌ Token generation (handled by Auth Service)  
❌ State storage (stateless by design)  
❌ Direct WhatsApp API interaction  
❌ Business logic or routing decisions  
❌ Agent assignment or routing  

---

## Architecture Context

### Position in Data Flow

```
[Inbound Transformer Service]
        ↓
    RabbitMQ Queue: inbound-processed
        ↓
[Genesys API Service]  ← THIS SERVICE
        ↓
Genesys Cloud Open Messaging API
        ↓
    Genesys Agent Desktop

Correlation Flow:
[Genesys API Service]
        ↓
    RabbitMQ Queue: correlation-events
        ↓
    [State Manager Service]
```

### Upstream Dependencies
- **Inbound Transformer Service**: Produces Genesys-formatted messages
- **RabbitMQ**: Message broker providing `inbound-processed` queue
- **Auth Service**: Provides OAuth tokens for Genesys API
- **Redis**: Token cache and deduplication

### Downstream Dependencies
- **Genesys Cloud API**: External delivery endpoint (region-specific)
- **State Manager Service**: Consumes correlation events

### Service Boundaries
- **Input Boundary**: RabbitMQ consumer on `inbound-processed`
- **Output Boundary**: HTTPS client to Genesys Cloud + RabbitMQ publisher
- **No Direct Database**: All state via Redis cache

---

## Core Responsibilities

### 1. Message Consumption (REQ-IN-07)

**Trigger**: Message arrives in `inbound-processed` queue

**Steps**:
1. Deserialize JSON payload
2. Validate schema and required fields
3. Extract tenant ID
4. Retrieve tenant configuration
5. Check for duplicates (idempotency)
6. Proceed to authentication and delivery

**Validation Rules**:
- `metadata.tenantId` must be present (UUID format)
- `genesysPayload.id` must be present (UUID format)
- `genesysPayload.direction` must be "Inbound"
- `genesysPayload` must be valid JSON object

**Tenant Configuration Required**:
- OAuth client ID
- OAuth client secret
- Genesys region (e.g., "usw2.pure.cloud")
- Rate limit settings
- Retry configuration

### 2. Authentication (REQ-AUTH-02)

**OAuth Flow**: Client Credentials Grant

**Token Management**:
- Cache tokens in Redis with TTL
- Refresh before expiration
- Invalidate on 401 errors
- Retry authentication failures with backoff

**Cache Key Structure**:
```
genesys:token:{tenantId}
```

**Token Metadata**:
- Access token value
- Expiry timestamp
- Token type (Bearer)
- Scope

### 3. Message Delivery (REQ-IN-08)

**HTTP Request**:
- Method: POST
- URL: `https://api.{region}.genesys.cloud/api/v2/conversations/messages/inbound/open`
- Headers: Authorization (Bearer token), Content-Type
- Body: Genesys payload from message
- Timeout: 5 seconds (configurable)

**Response Handling**:
- 200-299: Success, extract conversation ID
- 400-499: Client errors, specific handling per code
- 500-599: Server errors, retry with backoff
- Timeout: Retry with backoff

### 4. Conversation Correlation (REQ-STATE-04)

**On Success**:
- Extract conversation ID from Genesys response
- Extract communication ID from response
- Publish correlation event to `correlation-events` queue
- Enable State Manager to update mapping

**Correlation Event Purpose**:
- Link WhatsApp message ID to Genesys conversation
- Enable bi-directional message routing
- Support conversation continuity

### 5. Rate Limiting & Throttling

**Genesys Limits**:
- Typical: ~300 requests/minute per OAuth client
- Varies by Genesys edition and configuration
- 429 responses indicate limit exceeded

**Implementation Requirements**:
- Per-tenant rate limiting (token bucket)
- Global rate limiting (prevent single tenant saturation)
- Respect Retry-After headers
- Queue pausing when throttled
- Fair scheduling across tenants

### 6. Idempotency & Deduplication

**Duplicate Prevention**:
- Store processed WhatsApp message IDs
- Use Redis with TTL (24 hours recommended)
- Reject duplicates before API call
- Prevent duplicate conversation creation in Genesys

**Deduplication Key**:
```
genesys:dedupe:{tenantId}:{whatsapp_message_id}
```

---

## Technology Stack & Dependencies

### Required Components

| Component | Purpose | Version/Type | Configuration |
|-----------|---------|--------------|---------------|
| **RabbitMQ** | Message broker | 3.11+ | Queue: `inbound-processed`, Exchange: `inbound`, Correlation Queue: `correlation-events` |
| **Auth Service** | OAuth token provider | Internal | Endpoint: `/auth/token` |
| **Redis** | Token cache & deduplication | 6.0+ | TTL support, Namespaces: `genesys:token:*`, `genesys:dedupe:*` |
| **Genesys Cloud API** | External delivery | Open Messaging API | Region-specific endpoints |
| **Prometheus** | Metrics | 2.x | Scrape endpoint: `/metrics` |
| **Logging System** | Log aggregation | - | Format: JSON, Level: INFO minimum |

### Language & Runtime Recommendations
- **Node.js** (16+): Good async I/O, OAuth libraries
- **Go**: High performance, excellent concurrency
- **Python** (3.9+): Rapid development, requests library
- **Java/Kotlin** (11+): Enterprise-grade, Spring Boot ecosystem

### Key Libraries Needed
- **AMQP Client**: RabbitMQ connection
- **HTTP Client**: Genesys API calls (with timeout, retry)
- **OAuth Client**: Token retrieval
- **Redis Client**: Caching and deduplication
- **JSON Parser**: Payload processing
- **Logging**: Structured JSON output
- **Metrics**: Prometheus client
- **Rate Limiter**: Token bucket implementation
- **UUID Validation**: Tenant and message ID validation

---

## Data Contracts

### 5.1 Input Schema - Enriched Message from Inbound Transformer

**Source**: Inbound Transformer via RabbitMQ `inbound-processed` queue

```json
{
  "metadata": {
    "tenantId": "uuid-tenant-1111-2222-3333",
    "whatsapp_message_id": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
    "timestamp": "2023-11-15T03:33:20.000Z",
    "retryCount": 0,
    "correlationId": "uuid-1234-5678-9abc-def0"
  },
  "genesysPayload": {
    "id": "uuid-1234-5678-9abc-def0",
    "channel": {
      "platform": "Open",
      "type": "Private",
      "messageId": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
      "to": {
        "id": "integration-id-from-config"
      },
      "from": {
        "nickname": "John Doe",
        "id": "919876543210",
        "idType": "Phone",
        "firstName": "John"
      },
      "time": "2023-11-15T03:33:20.000Z"
    },
    "type": "Text",
    "text": "Hello World",
    "direction": "Inbound"
  }
}
```

**Field Specifications**:

#### Metadata Section

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `tenantId` | string | Yes | UUID v4 format | Organization identifier |
| `whatsapp_message_id` | string | Yes | Starts with `wamid.` | WhatsApp message ID for deduplication |
| `timestamp` | string | Yes | ISO 8601 UTC | Message processing timestamp |
| `retryCount` | integer | No | Default: 0 | Number of retry attempts |
| `correlationId` | string | Yes | UUID v4 format | Request tracing ID |

#### Genesys Payload Section

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | string | Yes | UUID v4 format | Message identifier |
| `channel` | object | Yes | Valid structure | Channel information |
| `type` | string | Yes | "Text" or "Receipt" | Message type |
| `text` | string | Conditional | Required for Text type | Message content |
| `direction` | string | Yes | Must be "Inbound" | Message direction |

**Validation Rules**:
1. `metadata.tenantId` must be valid UUID
2. `genesysPayload.id` must be valid UUID
3. `genesysPayload.direction` must be exactly "Inbound"
4. `genesysPayload` must be a non-empty object
5. If `genesysPayload.type` is "Text", `text` field must be present

**Validation Pseudo-code**:
```python
def validate_input_payload(payload):
    """
    Validate input message structure
    
    Raises:
        ValidationError: If validation fails
    """
    # Check metadata section
    if "metadata" not in payload:
        raise ValidationError("Missing metadata section")
    
    metadata = payload["metadata"]
    
    if "tenantId" not in metadata:
        raise ValidationError("Missing metadata.tenantId")
    
    if not is_uuid(metadata["tenantId"]):
        raise ValidationError("metadata.tenantId must be valid UUID")
    
    if "whatsapp_message_id" not in metadata:
        raise ValidationError("Missing metadata.whatsapp_message_id")
    
    # Check genesysPayload section
    if "genesysPayload" not in payload:
        raise ValidationError("Missing genesysPayload section")
    
    genesys_payload = payload["genesysPayload"]
    
    if "id" not in genesys_payload:
        raise ValidationError("Missing genesysPayload.id")
    
    if not is_uuid(genesys_payload["id"]):
        raise ValidationError("genesysPayload.id must be valid UUID")
    
    if "direction" not in genesys_payload:
        raise ValidationError("Missing genesysPayload.direction")
    
    if genesys_payload["direction"] != "Inbound":
        raise ValidationError(f"Invalid direction: {genesys_payload['direction']}")
    
    if genesys_payload.get("type") == "Text" and "text" not in genesys_payload:
        raise ValidationError("Text type requires text field")
    
    return True
```

### 5.2 Tenant Configuration Schema

**Source**: Configuration service or environment variables

```json
{
  "tenantId": "uuid-tenant-1111-2222-3333",
  "genesys": {
    "region": "usw2.pure.cloud",
    "oauthClientId": "client-id-from-genesys",
    "oauthClientSecret": "secret-from-genesys",
    "integrationId": "integration-uuid-from-genesys",
    "rateLimits": {
      "requestsPerMinute": 300,
      "burstSize": 50
    },
    "retry": {
      "maxAttempts": 5,
      "baseDelayMs": 1000,
      "maxDelayMs": 32000
    },
    "timeout": {
      "connectMs": 5000,
      "readMs": 10000
    }
  }
}
```

**Field Specifications**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenantId` | string | Yes | Tenant identifier |
| `genesys.region` | string | Yes | Genesys Cloud region (e.g., "usw2.pure.cloud") |
| `genesys.oauthClientId` | string | Yes | OAuth client ID from Genesys |
| `genesys.oauthClientSecret` | string | Yes | OAuth client secret (stored securely) |
| `genesys.integrationId` | string | Yes | Open Messaging integration ID |
| `genesys.rateLimits.requestsPerMinute` | integer | No | Rate limit (default: 300) |
| `genesys.rateLimits.burstSize` | integer | No | Burst capacity (default: 50) |
| `genesys.retry.maxAttempts` | integer | No | Max retry attempts (default: 5) |
| `genesys.retry.baseDelayMs` | integer | No | Base retry delay (default: 1000) |
| `genesys.retry.maxDelayMs` | integer | No | Max retry delay (default: 32000) |

**Region Format**:
- Format: `{region}.{environment}.cloud`
- Examples: 
  - US West: `usw2.pure.cloud`
  - US East: `use2.us-gov-pure.cloud`
  - Europe: `euw2.pure.cloud`
  - Australia: `apse2.pure.cloud`

**Configuration Loading**:
```python
def load_tenant_config(tenant_id, config_source):
    """
    Load tenant configuration
    
    Args:
        tenant_id: Tenant identifier
        config_source: Configuration provider (DB, file, env)
    
    Returns:
        TenantConfig object
        
    Raises:
        ConfigurationError: If config not found or invalid
    """
    config = config_source.get(tenant_id)
    
    if not config:
        raise ConfigurationError(f"No configuration for tenant: {tenant_id}")
    
    # Validate required fields
    required_fields = [
        "genesys.region",
        "genesys.oauthClientId",
        "genesys.oauthClientSecret",
        "genesys.integrationId"
    ]
    
    for field in required_fields:
        if not get_nested(config, field):
            raise ConfigurationError(f"Missing required field: {field}")
    
    return config
```

### 5.3 Output Request - Genesys API Call

**Destination**: Genesys Cloud Open Messaging Inbound API

**Request Format**:
```
POST https://api.{region}.genesys.cloud/api/v2/conversations/messages/inbound/open
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "id": "uuid-1234-5678-9abc-def0",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "messageId": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
    "to": {
      "id": "integration-id-from-config"
    },
    "from": {
      "nickname": "John Doe",
      "id": "919876543210",
      "idType": "Phone",
      "firstName": "John"
    },
    "time": "2023-11-15T03:33:20.000Z"
  },
  "type": "Text",
  "text": "Hello World",
  "direction": "Inbound"
}
```

**Request Construction**:
```python
def construct_genesys_request(message, tenant_config, access_token):
    """
    Build HTTP request for Genesys API
    
    Args:
        message: Input message from queue
        tenant_config: Tenant configuration
        access_token: OAuth token
        
    Returns:
        dict with url, headers, body, timeout
    """
    region = tenant_config["genesys"]["region"]
    url = f"https://api.{region}.genesys.cloud/api/v2/conversations/messages/inbound/open"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Correlation-ID": message["metadata"]["correlationId"]
    }
    
    body = message["genesysPayload"]
    
    timeout = {
        "connect": tenant_config["genesys"]["timeout"]["connectMs"] / 1000,
        "read": tenant_config["genesys"]["timeout"]["readMs"] / 1000
    }
    
    return {
        "url": url,
        "headers": headers,
        "body": body,
        "timeout": timeout
    }
```

### 5.4 Genesys API Response Schema

**Success Response (200 OK)**:
```json
{
  "id": "conversation-uuid-7890-abcd-ef12",
  "communicationId": "communication-uuid-3456-7890-abcd",
  "startTime": "2023-11-15T03:33:21.234Z",
  "participants": [
    {
      "id": "participant-uuid",
      "purpose": "customer"
    }
  ]
}
```

**Field Specifications**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Genesys conversation ID (UUID) |
| `communicationId` | string | Communication session ID (UUID) |
| `startTime` | string | Conversation start timestamp (ISO 8601) |
| `participants` | array | Participant information (optional) |

**Error Response (4xx/5xx)**:
```json
{
  "message": "Error description",
  "code": "ERROR_CODE",
  "status": 400,
  "contextId": "context-uuid",
  "details": []
}
```

**Response Parsing**:
```python
def parse_genesys_response(response):
    """
    Parse Genesys API response
    
    Args:
        response: HTTP response object
        
    Returns:
        Parsed response data
        
    Raises:
        GenesysAPIError: If response indicates error
    """
    if 200 <= response.status_code < 300:
        data = response.json()
        
        if "id" not in data:
            raise GenesysAPIError("Missing conversation ID in response")
        
        return {
            "conversation_id": data["id"],
            "communication_id": data.get("communicationId"),
            "start_time": data.get("startTime")
        }
    
    else:
        # Error response
        try:
            error_data = response.json()
            error_message = error_data.get("message", "Unknown error")
            error_code = error_data.get("code", "UNKNOWN")
        except:
            error_message = response.text
            error_code = "PARSE_ERROR"
        
        raise GenesysAPIError(
            f"API error: {error_message}",
            status_code=response.status_code,
            error_code=error_code
        )
```

### 5.5 Output Event - Correlation Message

**Destination**: RabbitMQ `correlation-events` queue

```json
{
  "tenantId": "uuid-tenant-1111-2222-3333",
  "conversationId": "conversation-uuid-7890-abcd-ef12",
  "communicationId": "communication-uuid-3456-7890-abcd",
  "whatsapp_message_id": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
  "status": "created",
  "timestamp": "2023-11-15T03:33:21.234Z",
  "correlationId": "uuid-1234-5678-9abc-def0"
}
```

**Field Specifications**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenantId` | string | Yes | Tenant identifier |
| `conversationId` | string | Yes | Genesys conversation ID |
| `communicationId` | string | Yes | Genesys communication ID |
| `whatsapp_message_id` | string | Yes | Original WhatsApp message ID |
| `status` | string | Yes | "created" (future: "updated", "closed") |
| `timestamp` | string | Yes | Event timestamp (ISO 8601) |
| `correlationId` | string | Yes | Original correlation ID |

**Event Publishing**:
```python
def publish_correlation_event(message, genesys_response, rabbitmq_channel):
    """
    Publish correlation event to queue
    
    Args:
        message: Original input message
        genesys_response: Parsed Genesys response
        rabbitmq_channel: RabbitMQ channel
    """
    event = {
        "tenantId": message["metadata"]["tenantId"],
        "conversationId": genesys_response["conversation_id"],
        "communicationId": genesys_response["communication_id"],
        "whatsapp_message_id": message["metadata"]["whatsapp_message_id"],
        "status": "created",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "correlationId": message["metadata"]["correlationId"]
    }
    
    rabbitmq_channel.basic_publish(
        exchange="correlation",
        routing_key="correlation.created",
        body=json.dumps(event),
        properties=pika.BasicProperties(
            delivery_mode=2,  # Persistent
            content_type="application/json",
            correlation_id=event["correlationId"]
        )
    )
    
    log_info(
        "Correlation event published",
        tenant_id=event["tenantId"],
        conversation_id=event["conversationId"],
        correlation_id=event["correlationId"]
    )
    
    metrics.increment("correlation_events_published_total", {
        "tenant_id": event["tenantId"]
    })
```

---

## Functional Requirements

### 6.1 Message Consumption Flow (REQ-IN-07)

**Requirement**: Consume and validate messages from RabbitMQ

**Implementation Steps**:

1. **Connect to RabbitMQ**
   ```python
   connection = pika.BlockingConnection(
       pika.ConnectionParameters(
           host=config["RABBITMQ_HOST"],
           credentials=pika.PlainCredentials(
               config["RABBITMQ_USER"],
               config["RABBITMQ_PASSWORD"]
           ),
           heartbeat=30
       )
   )
   
   channel = connection.channel()
   channel.basic_qos(prefetch_count=10)  # Limit in-flight messages
   ```

2. **Consume Messages**
   ```python
   def consume_messages():
       """Main message consumption loop"""
       channel.basic_consume(
           queue="inbound-processed",
           on_message_callback=handle_message,
           auto_ack=False  # Manual acknowledgment
       )
       
       log_info("Starting message consumption")
       channel.start_consuming()
   ```

3. **Message Handler**
   ```python
   def handle_message(channel, method, properties, body):
       """
       Process individual message
       
       Args:
           channel: RabbitMQ channel
           method: Delivery method
           properties: Message properties
           body: Message body (bytes)
       """
       start_time = time.time()
       
       try:
           # 1. Deserialize
           payload = json.loads(body)
           
           # 2. Validate
           validate_input_payload(payload)
           
           # 3. Extract tenant ID
           tenant_id = payload["metadata"]["tenantId"]
           
           # 4. Load tenant config
           tenant_config = load_tenant_config(tenant_id)
           
           # 5. Check idempotency
           if is_duplicate(payload, tenant_config):
               log_info("Duplicate message detected", 
                       whatsapp_message_id=payload["metadata"]["whatsapp_message_id"])
               channel.basic_ack(delivery_tag=method.delivery_tag)
               return
           
           # 6. Process message
           success = process_message(payload, tenant_config)
           
           if success:
               # ACK message
               channel.basic_ack(delivery_tag=method.delivery_tag)
               metrics.increment("messages_processed_total", {"tenant_id": tenant_id})
           else:
               # NACK for retry
               channel.basic_nack(
                   delivery_tag=method.delivery_tag,
                   requeue=True
               )
               metrics.increment("messages_retried_total", {"tenant_id": tenant_id})
           
       except ValidationError as e:
           # Invalid message - send to DLQ
           log_error("Validation failed", error=str(e), body=body)
           route_to_dlq(body, f"Validation error: {e}")
           channel.basic_ack(delivery_tag=method.delivery_tag)
           metrics.increment("validation_failures_total")
       
       except ConfigurationError as e:
           # Unknown tenant - send to DLQ + alert
           log_error("Configuration error", error=str(e))
           route_to_dlq(body, f"Config error: {e}")
           channel.basic_ack(delivery_tag=method.delivery_tag)
           alert("Unknown tenant", tenant_id=payload.get("metadata", {}).get("tenantId"))
           metrics.increment("config_errors_total")
       
       except Exception as e:
           # Unexpected error - retry
           log_error("Unexpected error processing message", error=str(e), traceback=traceback.format_exc())
           channel.basic_nack(
               delivery_tag=method.delivery_tag,
               requeue=True
           )
           metrics.increment("unexpected_errors_total")
       
       finally:
           latency = time.time() - start_time
           metrics.observe("message_processing_duration_seconds", latency, {"tenant_id": tenant_id})
   ```

**Error Scenarios**:

| Error Type | Action | Rationale |
|------------|--------|-----------|
| Invalid JSON | Route to DLQ + ACK | Cannot process, permanent failure |
| Missing required field | Route to DLQ + ACK | Invalid input, permanent failure |
| Unknown tenant | Route to DLQ + ACK + Alert | Configuration issue, needs investigation |
| Duplicate message | ACK silently | Already processed |
| Genesys 4xx error | Route to DLQ + ACK | Client error, won't succeed on retry |
| Genesys 5xx error | NACK (requeue) | Temporary failure, retry |
| Timeout | NACK (requeue) | Network issue, retry |
| Max retries exceeded | Route to DLQ + ACK | Persistent failure |

### 6.2 Idempotency Check

**Requirement**: Prevent duplicate message processing

**Implementation**:
```python
def is_duplicate(payload, tenant_config):
    """
    Check if message has already been processed
    
    Args:
        payload: Input message
        tenant_config: Tenant configuration
        
    Returns:
        True if duplicate, False if new
    """
    tenant_id = payload["metadata"]["tenantId"]
    whatsapp_message_id = payload["metadata"]["whatsapp_message_id"]
    
    # Generate deduplication key
    dedupe_key = f"genesys:dedupe:{tenant_id}:{whatsapp_message_id}"
    
    # Check Redis
    try:
        # SET if not exists, with TTL
        ttl = 86400  # 24 hours
        result = redis_client.set(dedupe_key, "1", ex=ttl, nx=True)
        
        # nx=True returns None if key already existed
        if result is None:
            return True  # Duplicate
        else:
            return False  # New
    
    except RedisError as e:
        log_warning("Redis error in deduplication check", error=str(e))
        # Fail open - allow processing
        # Better to process duplicate than lose message
        return False
```

**Deduplication Cache**:
- **Key Format**: `genesys:dedupe:{tenantId}:{whatsapp_message_id}`
- **Value**: Simple flag "1"
- **TTL**: 24 hours (configurable)
- **Failure Mode**: Fail open (process message if Redis unavailable)

### 6.3 Main Processing Logic

**Requirement**: Orchestrate authentication, delivery, and correlation

**Implementation**:
```python
def process_message(payload, tenant_config):
    """
    Main message processing logic
    
    Args:
        payload: Input message
        tenant_config: Tenant configuration
        
    Returns:
        True if successful, False if retry needed
    """
    tenant_id = payload["metadata"]["tenantId"]
    correlation_id = payload["metadata"]["correlationId"]
    
    # Set correlation context for logging
    set_correlation_context(correlation_id, tenant_id)
    
    try:
        # Step 1: Get OAuth token
        access_token = get_access_token(tenant_id, tenant_config)
        
        # Step 2: Check rate limit
        if not check_rate_limit(tenant_id, tenant_config):
            log_warning("Rate limit exceeded, will retry later")
            return False  # Retry later
        
        # Step 3: Send to Genesys
        genesys_response = send_to_genesys(
            payload,
            tenant_config,
            access_token
        )
        
        # Step 4: Publish correlation event
        publish_correlation_event(payload, genesys_response)
        
        log_info("Message processed successfully",
                conversation_id=genesys_response["conversation_id"])
        
        return True
    
    except TokenRetrievalError as e:
        log_error("Failed to get access token", error=str(e))
        # Retry - token service may be temporarily down
        return False
    
    except GenesysAPIError as e:
        if e.status_code == 401:
            # Invalid token - invalidate cache and retry
            log_warning("Token invalid, invalidating cache")
            invalidate_token_cache(tenant_id)
            return False
        
        elif e.status_code == 429:
            # Rate limited - back off
            log_warning("Rate limited by Genesys API")
            apply_rate_limit_backoff(tenant_id, e.retry_after)
            return False
        
        elif 400 <= e.status_code < 500:
            # Client error - permanent failure
            log_error("Genesys API client error", status=e.status_code, error=str(e))
            route_to_dlq(payload, f"Genesys API error: {e}")
            return True  # Don't retry
        
        elif 500 <= e.status_code < 600:
            # Server error - retry
            log_error("Genesys API server error", status=e.status_code, error=str(e))
            return False
        
        else:
            # Unknown error - retry
            log_error("Unexpected Genesys API error", status=e.status_code, error=str(e))
            return False
    
    except TimeoutError as e:
        log_warning("Genesys API timeout", error=str(e))
        return False  # Retry
    
    except Exception as e:
        log_error("Unexpected error in processing", error=str(e))
        return False  # Retry
```

---

## Authentication & Authorization

### 7.1 OAuth Token Management (REQ-AUTH-02)

**OAuth Flow**: Client Credentials Grant

**Token Lifecycle**:
1. Check cache for valid token
2. If not found/expired, request new token from Auth Service
3. Cache token with TTL
4. Use token for Genesys API calls
5. Invalidate on 401 errors
6. Refresh before expiration

**Implementation**:

```python
def get_access_token(tenant_id, tenant_config):
    """
    Get valid OAuth access token for tenant
    
    Args:
        tenant_id: Tenant identifier
        tenant_config: Tenant configuration
        
    Returns:
        Access token string
        
    Raises:
        TokenRetrievalError: If token cannot be obtained
    """
    # Check cache first
    cache_key = f"genesys:token:{tenant_id}"
    
    try:
        cached_token = redis_client.get(cache_key)
        
        if cached_token:
            token_data = json.loads(cached_token)
            
            # Check if token is still valid (with 5 min buffer)
            expiry = token_data["expiry"]
            if time.time() < expiry - 300:  # 5 min buffer
                log_debug("Using cached token", tenant_id=tenant_id)
                metrics.increment("token_cache_hits_total", {"tenant_id": tenant_id})
                return token_data["access_token"]
            else:
                log_debug("Cached token expired", tenant_id=tenant_id)
    
    except RedisError as e:
        log_warning("Redis error fetching cached token", error=str(e))
        # Continue to fetch new token
    
    # Fetch new token
    log_info("Fetching new OAuth token", tenant_id=tenant_id)
    metrics.increment("token_cache_misses_total", {"tenant_id": tenant_id})
    
    token_data = fetch_token_from_auth_service(tenant_id, tenant_config)
    
    # Cache token
    try:
        ttl = token_data["expires_in"] - 300  # Cache for slightly less than expiry
        redis_client.setex(
            cache_key,
            ttl,
            json.dumps(token_data)
        )
        log_debug("Token cached", tenant_id=tenant_id, ttl=ttl)
    except RedisError as e:
        log_warning("Failed to cache token", error=str(e))
        # Continue - token is still valid
    
    return token_data["access_token"]


def fetch_token_from_auth_service(tenant_id, tenant_config):
    """
    Request OAuth token from Auth Service
    
    Args:
        tenant_id: Tenant identifier
        tenant_config: Tenant configuration
        
    Returns:
        Token data dict with access_token, expires_in, expiry
        
    Raises:
        TokenRetrievalError: If request fails
    """
    auth_service_url = config["AUTH_SERVICE_URL"]
    
    request_data = {
        "grant_type": "client_credentials",
        "client_id": tenant_config["genesys"]["oauthClientId"],
        "client_secret": tenant_config["genesys"]["oauthClientSecret"]
    }
    
    try:
        response = requests.post(
            f"{auth_service_url}/auth/token",
            json=request_data,
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Calculate absolute expiry time
            expires_in = data.get("expires_in", 3600)  # Default 1 hour
            expiry = time.time() + expires_in
            
            token_data = {
                "access_token": data["access_token"],
                "token_type": data.get("token_type", "Bearer"),
                "expires_in": expires_in,
                "expiry": expiry
            }
            
            log_info("OAuth token obtained", tenant_id=tenant_id, expires_in=expires_in)
            metrics.increment("tokens_obtained_total", {"tenant_id": tenant_id})
            
            return token_data
        
        else:
            error_msg = f"Auth service returned {response.status_code}"
            log_error("Token fetch failed", tenant_id=tenant_id, error=error_msg)
            metrics.increment("token_fetch_failures_total", {"tenant_id": tenant_id})
            raise TokenRetrievalError(error_msg)
    
    except RequestException as e:
        log_error("Auth service request failed", error=str(e))
        metrics.increment("token_fetch_failures_total", {"tenant_id": tenant_id})
        raise TokenRetrievalError(f"Request failed: {e}")


def invalidate_token_cache(tenant_id):
    """
    Invalidate cached token (e.g., after 401 error)
    
    Args:
        tenant_id: Tenant identifier
    """
    cache_key = f"genesys:token:{tenant_id}"
    
    try:
        redis_client.delete(cache_key)
        log_info("Token cache invalidated", tenant_id=tenant_id)
        metrics.increment("tokens_invalidated_total", {"tenant_id": tenant_id})
    except RedisError as e:
        log_warning("Failed to invalidate token cache", error=str(e))
```

**Token Cache Structure**:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "expiry": 1700000000
}
```

**Cache Key**: `genesys:token:{tenantId}`  
**TTL**: `expires_in - 300` seconds (5 minute buffer)  
**Invalidation**: On 401 errors from Genesys API

---

## Rate Limiting & Throttling

### 8.1 Multi-Level Rate Limiting

**Rate Limit Levels**:
1. **Per-Tenant**: Enforce tenant-specific limits
2. **Global**: Prevent single tenant from saturating service
3. **Genesys-Imposed**: Respect 429 responses

**Genesys API Limits**:
- Typical: ~300 requests/minute per OAuth client
- Varies by Genesys edition (CX1, CX2, CX3)
- 429 responses include `Retry-After` header

### 8.2 Token Bucket Implementation

**Algorithm**: Token Bucket (per-tenant)

**Implementation**:
```python
class TokenBucket:
    """
    Token bucket rate limiter
    
    Tokens refill at constant rate.
    Each request consumes one token.
    """
    
    def __init__(self, rate, capacity):
        """
        Args:
            rate: Tokens per second
            capacity: Maximum token capacity (burst size)
        """
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_refill = time.time()
        self.lock = threading.Lock()
    
    def consume(self, tokens=1):
        """
        Try to consume tokens
        
        Args:
            tokens: Number of tokens to consume
            
        Returns:
            True if allowed, False if rate limited
        """
        with self.lock:
            # Refill tokens
            now = time.time()
            elapsed = now - self.last_refill
            refill_amount = elapsed * self.rate
            
            self.tokens = min(self.capacity, self.tokens + refill_amount)
            self.last_refill = now
            
            # Check if we have enough tokens
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            else:
                return False


class RateLimiter:
    """
    Per-tenant rate limiter using token buckets
    """
    
    def __init__(self):
        self.buckets = {}  # tenant_id -> TokenBucket
        self.lock = threading.Lock()
    
    def check_limit(self, tenant_id, tenant_config):
        """
        Check if request is allowed for tenant
        
        Args:
            tenant_id: Tenant identifier
            tenant_config: Tenant configuration
            
        Returns:
            True if allowed, False if rate limited
        """
        # Get or create bucket for tenant
        with self.lock:
            if tenant_id not in self.buckets:
                rate_limit = tenant_config["genesys"]["rateLimits"]["requestsPerMinute"]
                burst_size = tenant_config["genesys"]["rateLimits"]["burstSize"]
                
                # Convert rate to tokens per second
                tokens_per_second = rate_limit / 60.0
                
                self.buckets[tenant_id] = TokenBucket(
                    rate=tokens_per_second,
                    capacity=burst_size
                )
        
        # Try to consume token
        bucket = self.buckets[tenant_id]
        allowed = bucket.consume(tokens=1)
        
        if not allowed:
            log_warning("Rate limit exceeded", tenant_id=tenant_id)
            metrics.increment("rate_limit_exceeded_total", {"tenant_id": tenant_id})
        
        return allowed


# Global rate limiter instance
rate_limiter = RateLimiter()


def check_rate_limit(tenant_id, tenant_config):
    """
    Check rate limit for tenant
    
    Args:
        tenant_id: Tenant identifier
        tenant_config: Tenant configuration
        
    Returns:
        True if allowed, False if rate limited
    """
    return rate_limiter.check_limit(tenant_id, tenant_config)
```

### 8.3 Genesys 429 Handling

**When Genesys returns 429**:
1. Extract `Retry-After` header (seconds)
2. Apply backoff for tenant
3. NACK message for requeue
4. Temporarily block tenant requests

**Implementation**:
```python
class BackoffManager:
    """
    Manage backoff periods for rate-limited tenants
    """
    
    def __init__(self):
        self.backoffs = {}  # tenant_id -> expiry_time
        self.lock = threading.Lock()
    
    def apply_backoff(self, tenant_id, duration):
        """
        Apply backoff for tenant
        
        Args:
            tenant_id: Tenant identifier
            duration: Backoff duration in seconds
        """
        with self.lock:
            expiry = time.time() + duration
            self.backoffs[tenant_id] = expiry
            
        log_info("Backoff applied", tenant_id=tenant_id, duration=duration)
        metrics.gauge("tenant_backoff_seconds", duration, {"tenant_id": tenant_id})
    
    def is_backed_off(self, tenant_id):
        """
        Check if tenant is in backoff period
        
        Args:
            tenant_id: Tenant identifier
            
        Returns:
            True if backed off, False if ready
        """
        with self.lock:
            if tenant_id not in self.backoffs:
                return False
            
            expiry = self.backoffs[tenant_id]
            
            if time.time() < expiry:
                return True  # Still backed off
            else:
                # Backoff expired, remove
                del self.backoffs[tenant_id]
                return False


# Global backoff manager
backoff_manager = BackoffManager()


def apply_rate_limit_backoff(tenant_id, retry_after):
    """
    Apply backoff after 429 response
    
    Args:
        tenant_id: Tenant identifier
        retry_after: Retry-After value from response (seconds or HTTP date)
    """
    # Parse retry_after (can be seconds or HTTP date)
    try:
        duration = int(retry_after)
    except (ValueError, TypeError):
        # Try parsing as HTTP date
        try:
            retry_date = parsedate_to_datetime(retry_after)
            duration = (retry_date - datetime.now(timezone.utc)).total_seconds()
            duration = max(0, duration)
        except:
            # Default to 60 seconds
            duration = 60
    
    # Apply backoff with minimum 60 seconds
    duration = max(60, duration)
    
    backoff_manager.apply_backoff(tenant_id, duration)
    
    log_warning("Rate limit backoff applied",
               tenant_id=tenant_id,
               duration=duration)


def check_backoff(tenant_id):
    """
    Check if tenant is in backoff period
    
    Args:
        tenant_id: Tenant identifier
        
    Returns:
        True if ready, False if backed off
    """
    if backoff_manager.is_backed_off(tenant_id):
        log_debug("Tenant in backoff period", tenant_id=tenant_id)
        return False
    
    return True
```

### 8.4 Global Rate Limiting

**Purpose**: Prevent single tenant from consuming all resources

**Implementation**:
```python
# Global rate limiter (shared across all tenants)
global_rate_limiter = TokenBucket(
    rate=500 / 60,  # 500 requests per minute globally
    capacity=100     # 100 burst
)


def check_global_rate_limit():
    """
    Check global rate limit (across all tenants)
    
    Returns:
        True if allowed, False if globally rate limited
    """
    allowed = global_rate_limiter.consume(tokens=1)
    
    if not allowed:
        log_warning("Global rate limit exceeded")
        metrics.increment("global_rate_limit_exceeded_total")
    
    return allowed
```

**Integration in Processing**:
```python
def process_message(payload, tenant_config):
    tenant_id = payload["metadata"]["tenantId"]
    
    # Check backoff period
    if not check_backoff(tenant_id):
        log_debug("Tenant in backoff, requeueing")
        return False  # Retry later
    
    # Check global rate limit
    if not check_global_rate_limit():
        log_warning("Global rate limit hit, requeueing")
        return False  # Retry later
    
    # Check tenant rate limit
    if not check_rate_limit(tenant_id, tenant_config):
        log_warning("Tenant rate limit hit, requeueing")
        return False  # Retry later
    
    # Proceed with processing
    # ...
```

---

## Error Handling & Resilience

### 9.1 Retry Strategy

**Exponential Backoff with Jitter**:
```python
def calculate_backoff(attempt, tenant_config):
    """
    Calculate backoff delay for retry attempt
    
    Args:
        attempt: Retry attempt number (1-indexed)
        tenant_config: Tenant configuration
        
    Returns:
        Delay in seconds
    """
    base_delay = tenant_config["genesys"]["retry"]["baseDelayMs"] / 1000
    max_delay = tenant_config["genesys"]["retry"]["maxDelayMs"] / 1000
    
    # Exponential: base * 2^(attempt-1)
    delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
    
    # Add jitter: ±0-1000ms
    jitter = random.uniform(0, 1.0)
    
    return delay + jitter


def send_to_genesys_with_retry(payload, tenant_config, access_token):
    """
    Send message to Genesys with retry logic
    
    Args:
        payload: Message payload
        tenant_config: Tenant configuration
        access_token: OAuth token
        
    Returns:
        Genesys response
        
    Raises:
        GenesysAPIError: If all retries exhausted
    """
    max_attempts = tenant_config["genesys"]["retry"]["maxAttempts"]
    retry_count = payload["metadata"].get("retryCount", 0)
    
    for attempt in range(1, max_attempts + 1):
        try:
            response = send_to_genesys(payload, tenant_config, access_token)
            return response
        
        except GenesysAPIError as e:
            # Check if error is retriable
            if not is_retriable_error(e):
                raise  # Don't retry
            
            if attempt < max_attempts:
                delay = calculate_backoff(attempt, tenant_config)
                log_warning(f"Genesys API error, retrying in {delay}s",
                          attempt=attempt,
                          max_attempts=max_attempts,
                          error=str(e))
                
                time.sleep(delay)
                metrics.increment("genesys_retries_total", {
                    "tenant_id": payload["metadata"]["tenantId"],
                    "attempt": attempt
                })
            else:
                # Max retries exhausted
                log_error("Max retries exhausted",
                         attempt=attempt,
                         error=str(e))
                raise
        
        except (TimeoutError, ConnectionError) as e:
            if attempt < max_attempts:
                delay = calculate_backoff(attempt, tenant_config)
                log_warning(f"Network error, retrying in {delay}s",
                          attempt=attempt,
                          error=str(e))
                
                time.sleep(delay)
            else:
                raise GenesysAPIError(f"Network error after {max_attempts} attempts: {e}")


def is_retriable_error(error):
    """
    Determine if error is retriable
    
    Args:
        error: GenesysAPIError
        
    Returns:
        True if should retry, False otherwise
    """
    if not isinstance(error, GenesysAPIError):
        return True  # Unexpected errors are retriable
    
    status_code = error.status_code
    
    # Retriable: 5xx, 408, 429
    if 500 <= status_code < 600:
        return True
    
    if status_code == 408:  # Request Timeout
        return True
    
    if status_code == 429:  # Rate Limited
        return True
    
    if status_code == 401:  # Unauthorized (token might be refreshed)
        return True
    
    # Non-retriable: 4xx (except above)
    return False
```

### 9.2 Circuit Breaker Pattern

**Purpose**: Prevent cascading failures when Genesys is down

**Implementation**:
```python
class CircuitBreaker:
    """
    Circuit breaker for Genesys API calls
    
    States:
    - CLOSED: Normal operation
    - OPEN: Block requests, fail fast
    - HALF_OPEN: Allow test request
    """
    
    def __init__(self, failure_threshold=10, timeout=60):
        """
        Args:
            failure_threshold: Consecutive failures before opening
            timeout: Seconds before attempting recovery
        """
        self.state = "CLOSED"
        self.failure_count = 0
        self.success_count = 0
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.last_failure_time = None
        self.lock = threading.Lock()
    
    def call(self, func, *args, **kwargs):
        """
        Execute function with circuit breaker protection
        
        Args:
            func: Function to execute
            *args, **kwargs: Function arguments
            
        Returns:
            Function result
            
        Raises:
            CircuitBreakerOpenError: If circuit is open
            Original exception: If function fails
        """
        with self.lock:
            if self.state == "OPEN":
                # Check if timeout expired
                if time.time() - self.last_failure_time > self.timeout:
                    self.state = "HALF_OPEN"
                    self.success_count = 0
                    log_info("Circuit breaker entering HALF_OPEN state")
                else:
                    raise CircuitBreakerOpenError("Circuit breaker is OPEN")
        
        try:
            result = func(*args, **kwargs)
            
            # Success
            with self.lock:
                if self.state == "HALF_OPEN":
                    self.success_count += 1
                    
                    # After 3 successes, close circuit
                    if self.success_count >= 3:
                        self.state = "CLOSED"
                        self.failure_count = 0
                        log_info("Circuit breaker CLOSED (recovered)")
                
                elif self.state == "CLOSED":
                    # Reset failure count on success
                    self.failure_count = 0
            
            return result
        
        except Exception as e:
            with self.lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                if self.state == "HALF_OPEN":
                    # Failed during recovery attempt
                    self.state = "OPEN"
                    log_error("Circuit breaker reopened after failure in HALF_OPEN")
                
                elif self.failure_count >= self.failure_threshold:
                    self.state = "OPEN"
                    log_error(f"Circuit breaker OPEN after {self.failure_count} failures")
                    metrics.increment("circuit_breaker_opened_total")
            
            raise


# Per-region circuit breakers
circuit_breakers = {}  # region -> CircuitBreaker


def get_circuit_breaker(region):
    """Get circuit breaker for region"""
    if region not in circuit_breakers:
        circuit_breakers[region] = CircuitBreaker(
            failure_threshold=10,
            timeout=60
        )
    return circuit_breakers[region]


def send_to_genesys(payload, tenant_config, access_token):
    """
    Send message to Genesys with circuit breaker protection
    
    Args:
        payload: Message payload
        tenant_config: Tenant configuration
        access_token: OAuth token
        
    Returns:
        Genesys response
    """
    region = tenant_config["genesys"]["region"]
    circuit_breaker = get_circuit_breaker(region)
    
    try:
        response = circuit_breaker.call(
            _send_to_genesys_internal,
            payload,
            tenant_config,
            access_token
        )
        return response
    
    except CircuitBreakerOpenError:
        log_error("Circuit breaker open, failing fast", region=region)
        metrics.increment("circuit_breaker_rejected_total", {"region": region})
        raise GenesysAPIError("Circuit breaker open", status_code=503)


def _send_to_genesys_internal(payload, tenant_config, access_token):
    """
    Internal implementation of Genesys API call
    """
    request = construct_genesys_request(payload, tenant_config, access_token)
    
    response = requests.post(
        request["url"],
        headers=request["headers"],
        json=request["body"],
        timeout=(request["timeout"]["connect"], request["timeout"]["read"])
    )
    
    if 200 <= response.status_code < 300:
        return parse_genesys_response(response)
    else:
        raise GenesysAPIError(
            f"API error: {response.text}",
            status_code=response.status_code
        )
```

### 9.3 HTTP Status Code Handling

**Comprehensive Error Matrix**:

| Status Code | Category | Action | Retriable |
|-------------|----------|--------|-----------|
| 200-299 | Success | Parse response, publish correlation | N/A |
| 400 | Bad Request | Log + DLQ | No |
| 401 | Unauthorized | Invalidate token + retry once | Yes (once) |
| 403 | Forbidden | Log + Alert + DLQ | No |
| 404 | Not Found | Log + DLQ | No |
| 408 | Request Timeout | Retry with backoff | Yes |
| 429 | Rate Limited | Apply backoff + retry | Yes |
| 500 | Internal Server Error | Retry with backoff | Yes |
| 502 | Bad Gateway | Retry with backoff | Yes |
| 503 | Service Unavailable | Retry with backoff | Yes |
| 504 | Gateway Timeout | Retry with backoff | Yes |
| Timeout | Network | Retry with backoff | Yes |
| Connection Error | Network | Retry with backoff | Yes |

**Implementation**:
```python
def handle_genesys_response(response, payload, tenant_config):
    """
    Handle Genesys API response
    
    Args:
        response: HTTP response
        payload: Original message
        tenant_config: Tenant configuration
        
    Returns:
        Parsed response or raises exception
    """
    status_code = response.status_code
    tenant_id = payload["metadata"]["tenantId"]
    
    if 200 <= status_code < 300:
        # Success
        log_info("Genesys API success", status_code=status_code)
        metrics.increment("genesys_success_total", {"tenant_id": tenant_id})
        return parse_genesys_response(response)
    
    elif status_code == 400:
        # Bad Request - permanent failure
        error_msg = extract_error_message(response)
        log_error("Genesys API bad request", error=error_msg)
        metrics.increment("genesys_4xx_errors_total", {
            "tenant_id": tenant_id,
            "status_code": "400"
        })
        route_to_dlq(payload, f"Bad request: {error_msg}")
        raise GenesysAPIError(error_msg, status_code=400, retriable=False)
    
    elif status_code == 401:
        # Unauthorized - invalidate token and retry
        log_warning("Genesys API unauthorized, token may be expired")
        metrics.increment("genesys_4xx_errors_total", {
            "tenant_id": tenant_id,
            "status_code": "401"
        })
        invalidate_token_cache(tenant_id)
        raise GenesysAPIError("Unauthorized", status_code=401, retriable=True)
    
    elif status_code == 403:
        # Forbidden - configuration issue
        error_msg = extract_error_message(response)
        log_error("Genesys API forbidden", error=error_msg)
        metrics.increment("genesys_4xx_errors_total", {
            "tenant_id": tenant_id,
            "status_code": "403"
        })
        alert("Genesys API forbidden error", tenant_id=tenant_id, error=error_msg)
        route_to_dlq(payload, f"Forbidden: {error_msg}")
        raise GenesysAPIError(error_msg, status_code=403, retriable=False)
    
    elif status_code == 404:
        # Not Found - configuration issue
        error_msg = extract_error_message(response)
        log_error("Genesys API not found", error=error_msg)
        metrics.increment("genesys_4xx_errors_total", {
            "tenant_id": tenant_id,
            "status_code": "404"
        })
        route_to_dlq(payload, f"Not found: {error_msg}")
        raise GenesysAPIError(error_msg, status_code=404, retriable=False)
    
    elif status_code == 408:
        # Request Timeout - retry
        log_warning("Genesys API request timeout")
        metrics.increment("genesys_4xx_errors_total", {
            "tenant_id": tenant_id,
            "status_code": "408"
        })
        raise GenesysAPIError("Request timeout", status_code=408, retriable=True)
    
    elif status_code == 429:
        # Rate Limited - apply backoff and retry
        retry_after = response.headers.get("Retry-After", "60")
        log_warning("Genesys API rate limited", retry_after=retry_after)
        metrics.increment("genesys_rate_limited_total", {"tenant_id": tenant_id})
        apply_rate_limit_backoff(tenant_id, retry_after)
        raise GenesysAPIError("Rate limited", status_code=429, retriable=True)
    
    elif 500 <= status_code < 600:
        # Server Error - retry
        error_msg = extract_error_message(response)
        log_error("Genesys API server error",
                 status_code=status_code,
                 error=error_msg)
        metrics.increment("genesys_5xx_errors_total", {
            "tenant_id": tenant_id,
            "status_code": str(status_code)
        })
        raise GenesysAPIError(error_msg, status_code=status_code, retriable=True)
    
    else:
        # Unexpected status code
        error_msg = extract_error_message(response)
        log_error("Genesys API unexpected status",
                 status_code=status_code,
                 error=error_msg)
        metrics.increment("genesys_unexpected_status_total", {
            "tenant_id": tenant_id,
            "status_code": str(status_code)
        })
        raise GenesysAPIError(error_msg, status_code=status_code, retriable=True)


def extract_error_message(response):
    """Extract error message from response"""
    try:
        data = response.json()
        return data.get("message", response.text)
    except:
        return response.text
```

### 9.4 Dead Letter Queue

**DLQ Routing**:
```python
def route_to_dlq(payload, reason):
    """
    Route message to dead letter queue
    
    Args:
        payload: Original message or raw bytes
        reason: Human-readable failure reason
    """
    dlq_message = {
        "original_payload": payload if isinstance(payload, dict) else payload.decode(),
        "failure_reason": reason,
        "failure_timestamp": datetime.utcnow().isoformat() + "Z",
        "service": "genesys-api-service",
        "tenant_id": payload.get("metadata", {}).get("tenantId") if isinstance(payload, dict) else None
    }
    
    try:
        rabbitmq_channel.basic_publish(
            exchange="dlq",
            routing_key="genesys-api.dlq",
            body=json.dumps(dlq_message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Persistent
                content_type="application/json"
            )
        )
        
        log_error("Message routed to DLQ", reason=reason)
        metrics.increment("messages_dlq_total", {
            "tenant_id": dlq_message.get("tenant_id", "unknown")
        })
    
    except Exception as e:
        log_error("Failed to route to DLQ", error=str(e))
        # This is critical - alert
        alert("DLQ routing failed", error=str(e))
```

---

## Non-Functional Requirements

### 10.1 Performance Requirements

**Throughput Targets**:
- **Multi-Tenant**: 1000+ messages/minute aggregate
- **Per Instance**: 100-200 messages/minute
- **Average Processing**: < 100ms (excluding Genesys API latency)

**Latency Targets**:
- **Authentication**: < 50ms (cached) or < 200ms (fresh token)
- **Rate Limit Check**: < 5ms
- **Total Processing**: < 100ms internal + Genesys API latency

**Resource Limits**:
```
CPU: 0.5-2.0 cores per instance
Memory: 512MB-2GB per instance
Network: 20Mbps per instance
```

### 10.2 Scalability

**Horizontal Scaling**:
- Multiple consumer instances
- Stateless design enables easy scaling
- Load balancing via RabbitMQ consumer count
- No coordination required between instances

**Scaling Triggers**:
```
Scale up when:
- Queue depth > 100 messages for > 5 minutes
- CPU usage > 70%
- Processing latency p95 > 200ms

Scale down when:
- Queue depth < 10 for > 10 minutes
- CPU usage < 30%
```

### 10.3 Reliability

**Uptime Target**: 99.9% (three nines)

**High Availability**:
- Multiple service instances (min 2)
- No single point of failure
- Circuit breakers prevent cascading failures
- Graceful degradation

**Data Durability**:
- RabbitMQ persistent messages
- Redis optional (degrades gracefully if unavailable)
- Dead letter queue for failed messages

**Failure Recovery**:
```
Service crash: Messages remain in queue, reprocessed on restart
Network partition: Messages retry until success or DLQ
Genesys outage: Circuit breaker opens, messages requeue
Redis outage: Service continues without cache (fresh tokens each time)
```

### 10.4 Consistency Guarantees

**Message Processing**:
- **At-least-once delivery**: Messages may be reprocessed
- **Idempotent**: Deduplication prevents duplicate conversations
- **Ordered**: Not guaranteed (stateless design)

**Token Caching**:
- **Eventually consistent**: Token cache may be stale
- **Self-healing**: Invalid tokens detected via 401 errors

**Correlation Events**:
- **Best-effort**: Published after successful delivery
- **Not guaranteed**: If service crashes after delivery but before publish

---

## Security Requirements

### 11.1 Authentication Security

**OAuth Token Storage**:
- Tokens stored in Redis with encryption at rest
- Never logged or exposed externally
- TTL prevents long-lived token exposure

**Secrets Management**:
```python
def load_secrets():
    """
    Load secrets from secure store
    
    Supports:
    - Environment variables (dev)
    - AWS Secrets Manager (prod)
    - HashiCorp Vault (prod)
    """
    if config["ENVIRONMENT"] == "production":
        # Load from secrets manager
        secrets_client = boto3.client("secretsmanager")
        response = secrets_client.get_secret_value(
            SecretId=config["SECRETS_ARN"]
        )
        secrets = json.loads(response["SecretString"])
    else:
        # Load from environment (dev only)
        secrets = {
            "RABBITMQ_PASSWORD": os.getenv("RABBITMQ_PASSWORD"),
            "REDIS_PASSWORD": os.getenv("REDIS_PASSWORD")
        }
    
    return secrets
```

### 11.2 Network Security

**HTTPS Only**:
- All external calls use HTTPS
- TLS 1.2 minimum
- Certificate validation enabled

**Connection Security**:
```python
# Genesys API client configuration
session = requests.Session()
session.verify = True  # Validate certificates
session.headers.update({
    "User-Agent": "genesys-api-service/1.1"
})

# Disable insecure SSL warnings in production
if config["ENVIRONMENT"] != "production":
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
```

### 11.3 Tenant Isolation

**Strict Boundaries**:
- Each tenant has own OAuth credentials
- Rate limits enforced per tenant
- No cross-tenant data access
- Tenant ID validated on every request

**Configuration Isolation**:
```python
def validate_tenant_access(payload, tenant_config):
    """
    Ensure payload tenant matches config tenant
    
    Args:
        payload: Input message
        tenant_config: Loaded tenant configuration
        
    Raises:
        SecurityError: If tenant mismatch
    """
    payload_tenant = payload["metadata"]["tenantId"]
    config_tenant = tenant_config["tenantId"]
    
    if payload_tenant != config_tenant:
        raise SecurityError(
            f"Tenant mismatch: payload={payload_tenant}, config={config_tenant}"
        )
```

### 11.4 Logging Security

**Sensitive Data Redaction**:
```python
def sanitize_log_payload(payload):
    """
    Remove sensitive fields from logs
    
    Redacted fields:
    - OAuth tokens
    - Client secrets
    - Phone numbers (optional, based on PII policy)
    """
    sanitized = copy.deepcopy(payload)
    
    # Redact tokens
    if "access_token" in sanitized:
        sanitized["access_token"] = "[REDACTED]"
    
    # Redact secrets in config
    if "oauthClientSecret" in sanitized.get("config", {}):
        sanitized["config"]["oauthClientSecret"] = "[REDACTED]"
    
    # Optionally redact phone numbers
    if config.get("REDACT_PHONE_NUMBERS"):
        genesys_payload = sanitized.get("genesysPayload", {})
        channel = genesys_payload.get("channel", {})
        from_info = channel.get("from", {})
        
        if "id" in from_info:
            phone = from_info["id"]
            from_info["id"] = phone[:3] + "****" + phone[-2:]
    
    return sanitized
```

---

## Observability & Monitoring

### 12.1 Structured Logging

**Log Format**:
```json
{
  "timestamp": "2023-11-15T03:33:20.123Z",
  "level": "INFO",
  "service": "genesys-api-service",
  "message": "Message delivered successfully",
  "tenantId": "uuid-tenant-1111",
  "correlationId": "uuid-1234-5678",
  "conversationId": "conversation-uuid-7890",
  "whatsappMessageId": "wamid.HBg...",
  "genesysRegion": "usw2.pure.cloud",
  "latencyMs": 145,
  "genesysStatus": 200
}
```

**Log Levels**:
- **DEBUG**: Detailed flow, token cache hits/misses (disabled in prod)
- **INFO**: Successful operations, normal flow
- **WARN**: Rate limits, backoffs, degraded mode
- **ERROR**: Processing failures, API errors
- **CRITICAL**: Service-level failures, DLQ issues

**Key Log Events**:

1. **Message Received**:
   ```json
   {
     "level": "INFO",
     "message": "Message received from queue",
     "tenantId": "uuid-tenant-1111",
     "correlationId": "uuid-1234"
   }
   ```

2. **Token Retrieved**:
   ```json
   {
     "level": "INFO",
     "message": "OAuth token obtained",
     "tenantId": "uuid-tenant-1111",
     "cached": false,
     "expiresIn": 3600
   }
   ```

3. **Genesys API Call**:
   ```json
   {
     "level": "INFO",
     "message": "Sending to Genesys API",
     "tenantId": "uuid-tenant-1111",
     "region": "usw2.pure.cloud",
     "messageType": "Text"
   }
   ```

4. **Conversation Created**:
   ```json
   {
     "level": "INFO",
     "message": "Conversation created in Genesys",
     "tenantId": "uuid-tenant-1111",
     "conversationId": "conversation-uuid-7890",
     "communicationId": "communication-uuid-3456"
   }
   ```

5. **Correlation Published**:
   ```json
   {
     "level": "INFO",
     "message": "Correlation event published",
     "tenantId": "uuid-tenant-1111",
     "conversationId": "conversation-uuid-7890"
   }
   ```

### 12.2 Metrics

**Prometheus Metrics**:

```python
# Counter metrics
messages_received_total = Counter(
    "messages_received_total",
    "Total messages received from queue",
    ["tenant_id"]
)

messages_processed_total = Counter(
    "messages_processed_total",
    "Total messages successfully processed",
    ["tenant_id"]
)

messages_duplicate_total = Counter(
    "messages_duplicate_total",
    "Total duplicate messages detected",
    ["tenant_id"]
)

validation_failures_total = Counter(
    "validation_failures_total",
    "Total validation failures"
)

config_errors_total = Counter(
    "config_errors_total",
    "Total configuration errors"
)

token_cache_hits_total = Counter(
    "token_cache_hits_total",
    "Total token cache hits",
    ["tenant_id"]
)

token_cache_misses_total = Counter(
    "token_cache_misses_total",
    "Total token cache misses",
    ["tenant_id"]
)

tokens_obtained_total = Counter(
    "tokens_obtained_total",
    "Total OAuth tokens obtained",
    ["tenant_id"]
)

tokens_invalidated_total = Counter(
    "tokens_invalidated_total",
    "Total tokens invalidated",
    ["tenant_id"]
)

token_fetch_failures_total = Counter(
    "token_fetch_failures_total",
    "Total token fetch failures",
    ["tenant_id"]
)

rate_limit_exceeded_total = Counter(
    "rate_limit_exceeded_total",
    "Total rate limit exceeded events",
    ["tenant_id"]
)

global_rate_limit_exceeded_total = Counter(
    "global_rate_limit_exceeded_total",
    "Total global rate limit exceeded events"
)

genesys_success_total = Counter(
    "genesys_success_total",
    "Total successful Genesys API calls",
    ["tenant_id"]
)

genesys_4xx_errors_total = Counter(
    "genesys_4xx_errors_total",
    "Total Genesys 4xx errors",
    ["tenant_id", "status_code"]
)

genesys_5xx_errors_total = Counter(
    "genesys_5xx_errors_total",
    "Total Genesys 5xx errors",
    ["tenant_id", "status_code"]
)

genesys_rate_limited_total = Counter(
    "genesys_rate_limited_total",
    "Total Genesys rate limit responses",
    ["tenant_id"]
)

genesys_retries_total = Counter(
    "genesys_retries_total",
    "Total Genesys API retries",
    ["tenant_id", "attempt"]
)

correlation_events_published_total = Counter(
    "correlation_events_published_total",
    "Total correlation events published",
    ["tenant_id"]
)

messages_dlq_total = Counter(
    "messages_dlq_total",
    "Total messages routed to DLQ",
    ["tenant_id"]
)

circuit_breaker_opened_total = Counter(
    "circuit_breaker_opened_total",
    "Total circuit breaker opens"
)

circuit_breaker_rejected_total = Counter(
    "circuit_breaker_rejected_total",
    "Total requests rejected by circuit breaker",
    ["region"]
)

# Histogram metrics
message_processing_duration_seconds = Histogram(
    "message_processing_duration_seconds",
    "End-to-end message processing duration",
    ["tenant_id"],
    buckets=[0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

token_fetch_duration_seconds = Histogram(
    "token_fetch_duration_seconds",
    "OAuth token fetch duration",
    buckets=[0.05, 0.1, 0.2, 0.5, 1.0]
)

genesys_api_duration_seconds = Histogram(
    "genesys_api_duration_seconds",
    "Genesys API call duration",
    ["tenant_id", "status_code"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

rate_limit_check_duration_seconds = Histogram(
    "rate_limit_check_duration_seconds",
    "Rate limit check duration",
    buckets=[0.001, 0.005, 0.01, 0.05]
)

# Gauge metrics
rabbitmq_queue_depth = Gauge(
    "rabbitmq_queue_depth",
    "Current message count in queue"
)

tenant_backoff_seconds = Gauge(
    "tenant_backoff_seconds",
    "Current backoff duration for tenant",
    ["tenant_id"]
)

circuit_breaker_state = Gauge(
    "circuit_breaker_state",
    "Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)",
    ["region"]
)
```

### 12.3 Health Checks

**Liveness Probe**:
```python
@app.route("/health/live")
def liveness():
    """
    Liveness check - is the service running?
    
    Returns 200 if service is alive
    """
    return {"status": "alive", "service": "genesys-api-service"}, 200
```

**Readiness Probe**:
```python
@app.route("/health/ready")
def readiness():
    """
    Readiness check - is the service ready to process messages?
    
    Checks:
    - RabbitMQ connection
    - Auth service reachability
    - Redis connection (warning only)
    
    Returns 200 if ready, 503 if not
    """
    checks = {}
    ready = True
    
    # Check RabbitMQ
    try:
        rabbitmq_channel.queue_declare(
            queue="inbound-processed",
            passive=True
        )
        checks["rabbitmq"] = "OK"
    except Exception as e:
        checks["rabbitmq"] = f"FAILED: {e}"
        ready = False
    
    # Check Auth Service
    try:
        response = requests.get(
            f"{config['AUTH_SERVICE_URL']}/health",
            timeout=2
        )
        if response.status_code == 200:
            checks["auth_service"] = "OK"
        else:
            checks["auth_service"] = f"FAILED: {response.status_code}"
            ready = False
    except Exception as e:
        checks["auth_service"] = f"FAILED: {e}"
        ready = False
    
    # Check Redis (degraded OK)
    try:
        redis_client.ping()
        checks["redis"] = "OK"
    except Exception as e:
        checks["redis"] = f"DEGRADED: {e}"
        # Don't fail readiness - Redis is optional
    
    status = "ready" if ready else "not ready"
    http_code = 200 if ready else 503
    
    return {"status": status, "checks": checks}, http_code
```

### 12.4 Distributed Tracing

**Correlation ID Propagation**:
```python
def set_correlation_context(correlation_id, tenant_id):
    """
    Set correlation context for current request
    
    Propagates through:
    - All log messages
    - HTTP headers to downstream services
    - Metrics labels (where appropriate)
    """
    context.correlation_id = correlation_id
    context.tenant_id = tenant_id


def get_correlation_context():
    """Get current correlation context"""
    return {
        "correlation_id": getattr(context, "correlation_id", None),
        "tenant_id": getattr(context, "tenant_id", None)
    }


def log_with_context(level, message, **kwargs):
    """Log with correlation context"""
    ctx = get_correlation_context()
    
    log_data = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "level": level,
        "service": "genesys-api-service",
        "message": message,
        "correlationId": ctx["correlation_id"],
        "tenantId": ctx["tenant_id"],
        **kwargs
    }
    
    print(json.dumps(log_data))
```

---

## Testing Requirements

### 13.1 Unit Tests

**Test Coverage Goals**: >80% code coverage

**Key Test Scenarios**:

1. **Validation Tests**:
   ```python
   def test_validate_valid_payload():
       payload = create_valid_payload()
       assert validate_input_payload(payload) == True
   
   def test_validate_missing_tenant_id():
       payload = create_valid_payload()
       del payload["metadata"]["tenantId"]
       
       with pytest.raises(ValidationError):
           validate_input_payload(payload)
   
   def test_validate_invalid_direction():
       payload = create_valid_payload()
       payload["genesysPayload"]["direction"] = "Outbound"
       
       with pytest.raises(ValidationError):
           validate_input_payload(payload)
   ```

2. **Token Management Tests**:
   ```python
   def test_token_cache_hit():
       tenant_id = "test-tenant"
       cached_token = {
           "access_token": "test-token",
           "expiry": time.time() + 3600
       }
       redis_client.set(f"genesys:token:{tenant_id}", json.dumps(cached_token))
       
       token = get_access_token(tenant_id, tenant_config)
       
       assert token == "test-token"
       assert metrics.get("token_cache_hits_total") == 1
   
   def test_token_cache_miss():
       tenant_id = "test-tenant"
       # No cached token
       
       with mock.patch("fetch_token_from_auth_service") as mock_fetch:
           mock_fetch.return_value = {
               "access_token": "new-token",
               "expires_in": 3600,
               "expiry": time.time() + 3600
           }
           
           token = get_access_token(tenant_id, tenant_config)
           
           assert token == "new-token"
           assert mock_fetch.called
           assert metrics.get("token_cache_misses_total") == 1
   ```

3. **Rate Limiting Tests**:
   ```python
   def test_rate_limit_allows_within_limit():
       tenant_id = "test-tenant"
       rate_limiter = RateLimiter()
       
       # Should allow requests within limit
       for i in range(10):
           assert rate_limiter.check_limit(tenant_id, tenant_config) == True
   
   def test_rate_limit_blocks_over_limit():
       tenant_id = "test-tenant"
       config = {
           "genesys": {
               "rateLimits": {
                   "requestsPerMinute": 10,
                   "burstSize": 5
               }
           }
       }
       rate_limiter = RateLimiter()
       
       # Exhaust tokens
       for i in range(5):
           rate_limiter.check_limit(tenant_id, config)
       
       # Next request should be blocked
       assert rate_limiter.check_limit(tenant_id, config) == False
   ```

4. **Circuit Breaker Tests**:
   ```python
   def test_circuit_breaker_opens_after_failures():
       cb = CircuitBreaker(failure_threshold=3, timeout=60)
       
       # Simulate failures
       for i in range(3):
           try:
               cb.call(failing_function)
           except:
               pass
       
       assert cb.state == "OPEN"
   
   def test_circuit_breaker_half_open_after_timeout():
       cb = CircuitBreaker(failure_threshold=3, timeout=1)
       
       # Open circuit
       for i in range(3):
           try:
               cb.call(failing_function)
           except:
               pass
       
       assert cb.state == "OPEN"
       
       # Wait for timeout
       time.sleep(1.1)
       
       # Next call should enter HALF_OPEN
       try:
           cb.call(failing_function)
       except:
           pass
       
       assert cb.state == "HALF_OPEN" or cb.state == "OPEN"
   ```

### 13.2 Integration Tests

**Test Scenarios**:

1. **End-to-End Flow**:
   ```python
   def test_e2e_message_processing():
       # 1. Publish message to RabbitMQ
       message = create_valid_message()
       publish_to_queue("inbound-processed", message)
       
       # 2. Mock Auth Service
       mock_auth_service.add_response(200, {
           "access_token": "test-token",
           "expires_in": 3600
       })
       
       # 3. Mock Genesys API
       mock_genesys_api.add_response(200, {
           "id": "conv-123",
           "communicationId": "comm-456"
       })
       
       # 4. Wait for processing
       time.sleep(2)
       
       # 5. Verify Genesys API called
       assert mock_genesys_api.call_count == 1
       
       # 6. Verify correlation event published
       correlation_event = consume_from_queue("correlation-events")
       assert correlation_event["conversationId"] == "conv-123"
   ```

2. **Retry After 5xx Error**:
   ```python
   def test_retry_after_genesys_5xx():
       message = create_valid_message()
       
       # Mock token
       mock_auth_service.add_response(200, {"access_token": "token"})
       
       # Mock Genesys to return 500 twice, then 200
       mock_genesys_api.add_responses([
           (500, {"message": "Internal error"}),
           (500, {"message": "Internal error"}),
           (200, {"id": "conv-123", "communicationId": "comm-456"})
       ])
       
       publish_to_queue("inbound-processed", message)
       time.sleep(5)
       
       # Verify 3 calls (2 retries + 1 success)
       assert mock_genesys_api.call_count == 3
       
       # Verify success metrics
       assert metrics.get("genesys_success_total") == 1
       assert metrics.get("genesys_retries_total") == 2
   ```

3. **Rate Limit Handling**:
   ```python
   def test_handle_genesys_429():
       message = create_valid_message()
       
       # Mock token
       mock_auth_service.add_response(200, {"access_token": "token"})
       
       # Mock Genesys to return 429 with Retry-After
       mock_genesys_api.add_response(429, 
           body={"message": "Rate limited"},
           headers={"Retry-After": "60"}
       )
       
       publish_to_queue("inbound-processed", message)
       time.sleep(1)
       
       # Verify message was NACKed (will be retried)
       assert mock_genesys_api.call_count == 1
       assert metrics.get("genesys_rate_limited_total") == 1
       
       # Verify backoff applied
       tenant_id = message["metadata"]["tenantId"]
       assert backoff_manager.is_backed_off(tenant_id) == True
   ```

### 13.3 Performance Tests

**Load Testing**:
```python
def test_throughput():
    """
    Test: Service can handle 1000 msg/min
    
    Setup:
    - Start service with 3 instances
    - Publish 1000 messages to queue
    - Measure processing time
    
    Assert:
    - All messages processed within 60 seconds
    - p95 latency < 200ms
    - No message loss
    """
    pass

def test_sustained_load():
    """
    Test: Service handles sustained load
    
    Setup:
    - Sustained load of 500 msg/min
    - Run for 30 minutes
    
    Assert:
    - No memory leaks
    - Latency remains stable
    - No DLQ messages
    """
    pass
```

---

## Deployment & Operations

### 14.1 Environment Variables

**Required Configuration**:
```bash
# Service Identity
SERVICE_NAME=genesys-api-service
SERVICE_VERSION=1.1.0
ENVIRONMENT=production

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@rabbitmq.internal:5672/vhost
RABBITMQ_QUEUE=inbound-processed
RABBITMQ_PREFETCH_COUNT=10
RABBITMQ_CORRELATION_QUEUE=correlation-events

# Auth Service
AUTH_SERVICE_URL=http://auth-service.internal:8080

# Redis
REDIS_URL=redis://redis.internal:6379/0
REDIS_PASSWORD=secret
TOKEN_CACHE_TTL=3600
DEDUPE_CACHE_TTL=86400

# Genesys
DEFAULT_REGION=usw2.pure.cloud
DEFAULT_TIMEOUT_CONNECT_MS=5000
DEFAULT_TIMEOUT_READ_MS=10000

# Rate Limiting
GLOBAL_RATE_LIMIT_RPM=500
DEFAULT_TENANT_RATE_LIMIT_RPM=300

# Retry Configuration
MAX_RETRY_ATTEMPTS=5
BASE_RETRY_DELAY_MS=1000
MAX_RETRY_DELAY_MS=32000

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=10
CIRCUIT_BREAKER_TIMEOUT=60

# Observability
LOG_LEVEL=INFO
METRICS_PORT=9090
REDACT_PHONE_NUMBERS=true
```

**Tenant Configuration** (loaded from config service):
```json
{
  "tenants": [
    {
      "tenantId": "uuid-tenant-1111",
      "genesys": {
        "region": "usw2.pure.cloud",
        "oauthClientId": "client-id-1",
        "oauthClientSecret": "secret-1",
        "integrationId": "integration-id-1",
        "rateLimits": {
          "requestsPerMinute": 300,
          "burstSize": 50
        }
      }
    }
  ]
}
```

### 14.2 Container Configuration

**Dockerfile Example**:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src ./src

# Create non-root user
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python src/healthcheck.py

# Expose metrics port
EXPOSE 9090

CMD ["python", "-u", "src/main.py"]
```

**Kubernetes Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: genesys-api-service
spec:
  replicas: 3  # Minimum for HA
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: genesys-api-service
  template:
    metadata:
      labels:
        app: genesys-api-service
        version: "1.1"
    spec:
      containers:
      - name: genesys-api-service
        image: genesys-api-service:1.1.0
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        env:
        - name: SERVICE_NAME
          value: "genesys-api-service"
        - name: RABBITMQ_URL
          valueFrom:
            secretKeyRef:
              name: rabbitmq-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: redis-config
              key: url
        - name: AUTH_SERVICE_URL
          value: "http://auth-service:8080"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
        ports:
        - containerPort: 9090
          name: metrics
```

### 14.3 Monitoring Alerts

**Alert Definitions**:

1. **High Error Rate**:
   ```yaml
   alert: GenesysAPIHighErrorRate
   expr: rate(genesys_4xx_errors_total[5m]) + rate(genesys_5xx_errors_total[5m]) > 0.1
   severity: warning
   description: High error rate in Genesys API calls
   ```

2. **Token Fetch Failures**:
   ```yaml
   alert: GenesysAPITokenFetchFailures
   expr: rate(token_fetch_failures_total[5m]) > 0.05
   severity: critical
   description: High failure rate fetching OAuth tokens
   ```

3. **Circuit Breaker Open**:
   ```yaml
   alert: GenesysAPICircuitBreakerOpen
   expr: circuit_breaker_state > 1
   severity: critical
   description: Circuit breaker open for Genesys API
   ```

4. **High DLQ Rate**:
   ```yaml
   alert: GenesysAPIHighDLQRate
   expr: rate(messages_dlq_total[5m]) > 0.05
   severity: warning
   description: High rate of messages to DLQ
   ```

5. **Service Down**:
   ```yaml
   alert: GenesysAPIServiceDown
   expr: up{job="genesys-api-service"} == 0
   severity: critical
   description: Genesys API service is down
   ```

### 14.4 Runbook

**Common Issues**:

1. **Messages Not Processing**:
   ```
   Symptom: Queue depth increasing
   
   Check:
   - Service instances running?
   - Auth service reachable?
   - Genesys API reachable?
   - Circuit breaker open?
   - Rate limits exhausted?
   
   Debug:
   kubectl get pods -l app=genesys-api-service
   kubectl logs -l app=genesys-api-service --tail=100
   ```

2. **High 401 Error Rate**:
   ```
   Symptom: Many token validation failures
   
   Check:
   - Auth service status
   - Tenant OAuth credentials valid?
   - Token cache corruption?
   
   Fix:
   - Flush Redis token cache
   - Restart Auth service
   - Verify OAuth credentials in config
   ```

3. **Circuit Breaker Open**:
   ```
   Symptom: All requests failing fast
   
   Check:
   - Genesys Cloud status page
   - Network connectivity to Genesys
   - Recent Genesys maintenance?
   
   Action:
   - Wait for circuit breaker timeout (60s)
   - If Genesys is down, scale down service to save resources
   - Alert Genesys support if prolonged
   ```

---

## Implementation Guidelines

### 15.1 Project Structure

**Recommended Layout**:
```
genesys-api-service/
├── src/
│   ├── main.py                  # Entry point
│   ├── config.py                # Configuration loading
│   ├── rabbitmq/
│   │   ├── consumer.py          # Message consumer
│   │   ├── publisher.py         # Correlation event publisher
│   │   └── connection.py        # Connection management
│   ├── auth/
│   │   ├── token_manager.py     # OAuth token management
│   │   └── cache.py             # Token caching
│   ├── genesys/
│   │   ├── client.py            # Genesys API client
│   │   ├── retry.py             # Retry logic
│   │   └── circuit_breaker.py   # Circuit breaker
│   ├── rate_limit/
│   │   ├── token_bucket.py      # Token bucket algorithm
│   │   ├── limiter.py           # Rate limiter
│   │   └── backoff.py           # Backoff manager
│   ├── validation/
│   │   └── validator.py         # Input validation
│   ├── observability/
│   │   ├── logger.py            # Structured logging
│   │   ├── metrics.py           # Prometheus metrics
│   │   └── health.py            # Health checks
│   └── utils/
│       ├── deduplication.py     # Duplicate detection
│       └── dlq.py               # Dead letter queue
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/
│   └── requirements.md          # This document
├── Dockerfile
├── docker-compose.yml
├── k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── hpa.yaml
└── requirements.txt
```

### 15.2 Code Style Guidelines

**Key Principles**:

1. **Multi-Tenant Awareness**: Always validate tenant context
2. **Statelessness**: No global mutable state except caches
3. **Idempotency**: Deduplication on every request
4. **Error Handling**: Explicit handling, no silent failures
5. **Testing**: High test coverage for critical paths

---

## Common Pitfalls & Anti-Patterns

### 16.1 Pitfalls to Avoid

**1. Missing Tenant Validation**:
```python
# ❌ BAD: Assuming tenant in payload matches config
def process(payload, config):
    # Directly use config without validation
    token = get_token(config["tenantId"])

# ✅ GOOD: Validate tenant match
def process(payload, config):
    validate_tenant_access(payload, config)
    token = get_token(config["tenantId"])
```

**2. Token Leakage in Logs**:
```python
# ❌ BAD: Logging token
log.info(f"Using token: {access_token}")

# ✅ GOOD: Redact sensitive data
log.info("Using cached token", cached=True)
```

**3. Ignoring Rate Limits**:
```python
# ❌ BAD: No rate limit checking
def process(message):
    send_to_genesys(message)

# ✅ GOOD: Check rate limits
def process(message):
    if not check_rate_limit(tenant_id):
        return False  # Retry later
    send_to_genesys(message)
```

**4. Missing Idempotency**:
```python
# ❌ BAD: No deduplication
def process(message):
    send_to_genesys(message)
    publish_correlation(message)

# ✅ GOOD: Check for duplicates
def process(message):
    if is_duplicate(message):
        return True
    send_to_genesys(message)
    publish_correlation(message)
```

**5. Incorrect 401 Handling**:
```python
# ❌ BAD: Treating 401 as permanent failure
if response.status_code == 401:
    route_to_dlq(message)

# ✅ GOOD: Invalidate token and retry
if response.status_code == 401:
    invalidate_token_cache(tenant_id)
    raise RetryableError("Token expired")
```

**6. Hardcoded Regions**:
```python
# ❌ BAD: Hardcoded region
url = "https://api.usw2.pure.cloud/..."

# ✅ GOOD: Dynamic region from config
region = tenant_config["genesys"]["region"]
url = f"https://api.{region}.genesys.cloud/..."
```

---

## Summary

This document provides comprehensive requirements for implementing the Genesys API Service. Key principles:

1. **Multi-Tenant Architecture**: Strict tenant isolation, per-tenant configuration
2. **OAuth Token Management**: Secure caching, automatic refresh, 401 handling
3. **Rate Limiting**: Per-tenant and global limits, respect Genesys throttling
4. **Resilient Delivery**: Retries, circuit breakers, backoff strategies
5. **Idempotent Processing**: Deduplication prevents duplicate conversations
6. **Conversation Correlation**: Link WhatsApp ↔ Genesys conversations
7. **Observable**: Comprehensive metrics, structured logs, health checks

The service must be **reliable and secure** - it's the critical gateway to Genesys Cloud. Proper error handling, rate limiting, and tenant isolation are essential for production stability.

For implementation, follow the patterns in this document closely. The architecture accounts for real-world Genesys API behavior, rate limits, and failure modes.
--- END genesys-api-service/genesys-api-frd.md ---


--- BEGIN genesys-webhook-service/genesys-webhook-frd.md ---

# Functional Requirements Document (FRD)
## Genesys Webhook Service - Implementation Guide

**Service Name:** `genesys-webhook-service`  
**Version:** 1.2 (LLM-Optimized)  
**Purpose:** Ingress gateway for Genesys Cloud webhook events  
**Architecture Pattern:** Stateless, Event-Driven Microservice

---

## Table of Contents
1. [Service Overview](#1-service-overview)
2. [Core Responsibilities](#2-core-responsibilities)
3. [External Dependencies](#3-external-dependencies)
4. [Data Models](#4-data-models)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Error Handling](#7-error-handling)
8. [Security Requirements](#8-security-requirements)
9. [Testing Scenarios](#9-testing-scenarios)
10. [Implementation Notes](#10-implementation-notes)

---

## 1. Service Overview

### 1.1 Purpose
This service acts as the **SOLE ingress point** for all Genesys Cloud webhook events. It:
- Validates webhook authenticity using HMAC-SHA256 signatures
- Processes outbound agent messages (text and media)
- Routes lifecycle events (read, delivered, typing, disconnect)
- Prevents feedback loops from middleware-injected messages
- Buffers validated events into RabbitMQ for downstream processing

### 1.2 Service Characteristics
- **Stateless**: No local state persistence; all data stored in external systems
- **Multi-tenant**: Single deployment serving multiple tenants via `integrationId` routing
- **Security-critical**: First line of defense against unauthorized access
- **Latency-sensitive**: Must respond to Genesys within 5 seconds to avoid retries
- **Idempotent**: Same event processed multiple times produces same outcome

### 1.3 Architecture Position
```
Genesys Cloud → [genesys-webhook-service] → RabbitMQ → state-manager-service
                         ↓
                      MinIO (media storage)
                         ↓
                   Tenant Service (metadata)
                         ↓
                   Auth Service (OAuth tokens)
```

---

## 2. Core Responsibilities

### 2.1 Ingress Security (REQ-SEC-01)
**What:** Validate every incoming webhook request using HMAC-SHA256 signature verification.

**Why:** Ensure requests are genuinely from Genesys Cloud and haven't been tampered with.

**How:**
1. Extract `integrationId` from `channel.from.id`
2. Lookup tenant's `webhook_secret` from Tenant Service
3. Compute HMAC-SHA256 of raw request body using secret
4. Compare with `x-hub-signature-256` header using constant-time comparison
5. Reject mismatches with `403 Forbidden`

### 2.2 Event Classification (REQ-OUT-01)
**What:** Categorize incoming events by type and route to appropriate queue.

**Types:**
- **Outbound Message** (Text/Attachment) → `outboundQueue`
- **Status Event** (Receipt/Typing/Disconnect) → `statusQueue`
- **Health Check** → Acknowledge immediately, no processing

### 2.3 Media Handling (REQ-OUT-02, REQ-OUT-03)
**What:** Download agent-sent media from authenticated Genesys URLs and re-host on MinIO.

**Why:** 
- Genesys URLs are temporary and require OAuth authentication
- Centralized storage enables consistent access control
- Presigned URLs provide time-limited, secure access

**Flow:**
1. Detect `contentType: "Attachment"` in payload
2. Obtain OAuth token from Auth Service
3. Stream download from Genesys URL (no memory buffering)
4. Stream upload to MinIO bucket `media-outbound`
5. Generate 7-day presigned URL
6. Replace original URL in RabbitMQ payload

### 2.4 Loop Prevention (REQ-OUT-06)
**What:** Detect and suppress webhook events triggered by middleware's own message injections.

**Why:** Messages sent via `genesys-api-service` echo back as webhooks, creating infinite loops.

**Detection:**
- Inspect `channel.messageId`
- If matches known internal UUID pattern or middleware prefix → suppress
- Return `200 OK` to Genesys but don't publish to RabbitMQ
- Log as `echo_filtered`

### 2.5 Event Buffering
**What:** Publish structured events to RabbitMQ for asynchronous processing.

**Queues:**
- `RabbitMQ-outboundQueue`: Agent messages to be sent to customers
- `RabbitMQ-statusQueue`: Status updates for conversation state

---

## 3. External Dependencies

### 3.1 RabbitMQ
**Purpose:** Message queue for downstream event processing

**Queues Used:**
- `outboundQueue`: Outbound messages (text + media)
- `statusQueue`: Status events (delivered, read, typing, disconnect)

**Connection:**
- Protocol: AMQP 0.9.1
- Exchange: Direct
- Durability: Persistent messages
- Acknowledgment: Publisher confirms enabled

**Failure Handling:**
- Retry once on publish failure
- Log critical error if both attempts fail
- Do NOT retry webhook response to Genesys (avoid timeout)

### 3.2 MinIO
**Purpose:** Object storage for outbound media files

**Bucket:** `media-outbound`

**Operations:**
- `PUT object`: Upload media stream
- `GET presigned URL`: Generate 7-day temporary access URL

**Configuration:**
- Endpoint: `MINIO_ENDPOINT` env var
- Access Key: `MINIO_ACCESS_KEY` env var
- Secret Key: `MINIO_SECRET_KEY` env var
- Region: `us-east-1` (default)

**File Naming:**
```
{tenantId}/{year}/{month}/{day}/{uuid}.{extension}
```

**Size Limits:**
- Maximum file size: 20 MB
- Timeout: 30 seconds per upload

### 3.3 Tenant Service
**Purpose:** Resolve tenant metadata from Genesys integration ID

**API Endpoint:**
```
GET /api/v1/tenants/by-integration/{integrationId}
```

**Request:**
```http
GET /api/v1/tenants/by-integration/integration-id-5678
Authorization: Bearer {service_token}
```

**Response:**
```json
{
  "tenantId": "uuid-5678",
  "integrationId": "integration-id-5678",
  "webhookSecret": "base64-encoded-secret",
  "status": "active"
}
```

**Error Cases:**
- 404: Integration ID not found → Return `400 Bad Request` to Genesys
- 500: Tenant Service down → Return `503 Service Unavailable`

### 3.4 Auth Service
**Purpose:** Provide OAuth tokens for authenticated Genesys API calls

**API Endpoint:**
```
POST /api/v1/auth/token
```

**Request:**
```json
{
  "tenantId": "uuid-5678",
  "scope": "genesys:media:download"
}
```

**Response:**
```json
{
  "accessToken": "Bearer eyJhbGc...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

**Usage:**
```http
GET https://api.genesys.cloud/v2/downloads/{mediaId}
Authorization: Bearer eyJhbGc...
```

---

## 4. Data Models

### 4.1 Genesys Webhook Input Schema

#### 4.1.1 Text Message Example
```json
{
  "id": "msg-abc-123",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "to": {
      "id": "919876543210",
      "idType": "Phone"
    },
    "from": {
      "id": "integration-id-5678",
      "idType": "Email"
    },
    "time": "2023-01-01T12:00:00.000Z",
    "messageId": null
  },
  "type": "Text",
  "text": "Hello, how can I help you?",
  "direction": "Outbound"
}
```

#### 4.1.2 Attachment Message Example
```json
{
  "id": "msg-def-456",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "to": {
      "id": "919876543210",
      "idType": "Phone"
    },
    "from": {
      "id": "integration-id-5678",
      "idType": "Email"
    },
    "time": "2023-01-01T12:05:00.000Z",
    "messageId": null
  },
  "type": "Text",
  "text": "Here is your document",
  "direction": "Outbound",
  "content": [
    {
      "contentType": "Attachment",
      "attachment": {
        "id": "media-789",
        "url": "https://api.genesys.cloud/v2/downloads/auth-token-xyz/media-789",
        "mime": "application/pdf",
        "filename": "invoice.pdf"
      }
    }
  ]
}
```

#### 4.1.3 Status Event Example (Delivered)
```json
{
  "id": "receipt-ghi-789",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "to": {
      "id": "integration-id-5678",
      "idType": "Email"
    },
    "from": {
      "id": "919876543210",
      "idType": "Phone"
    },
    "time": "2023-01-01T12:01:00.000Z",
    "messageId": "msg-abc-123"
  },
  "type": "Receipt",
  "status": "Delivered",
  "direction": "Outbound"
}
```

#### 4.1.4 Echo Event Example (Should be Filtered)
```json
{
  "id": "msg-jkl-012",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "to": {
      "id": "919876543210",
      "idType": "Phone"
    },
    "from": {
      "id": "integration-id-5678",
      "idType": "Email"
    },
    "time": "2023-01-01T12:10:00.000Z",
    "messageId": "mw-injected-uuid-12345"
  },
  "type": "Text",
  "text": "Message sent via middleware",
  "direction": "Outbound"
}
```

### 4.2 RabbitMQ Output Schema

#### 4.2.1 Outbound Message Payload
**Queue:** `outboundQueue`

```json
{
  "tenantId": "uuid-5678",
  "genesysId": "msg-abc-123",
  "type": "message",
  "timestamp": "2023-01-01T12:00:00.000Z",
  "payload": {
    "text": "Hello, how can I help you?",
    "to_id": "919876543210",
    "to_id_type": "Phone",
    "media": null
  }
}
```

#### 4.2.2 Outbound Message with Media
```json
{
  "tenantId": "uuid-5678",
  "genesysId": "msg-def-456",
  "type": "message",
  "timestamp": "2023-01-01T12:05:00.000Z",
  "payload": {
    "text": "Here is your document",
    "to_id": "919876543210",
    "to_id_type": "Phone",
    "media": {
      "url": "https://minio.internal/media-outbound/uuid-5678/2023/01/01/abc-def-789.pdf?X-Amz-Expires=604800",
      "mime_type": "application/pdf",
      "filename": "invoice.pdf",
      "original_id": "media-789"
    }
  }
}
```

#### 4.2.3 Status Event Payload
**Queue:** `statusQueue`

```json
{
  "tenantId": "uuid-5678",
  "genesysId": "receipt-ghi-789",
  "originalMessageId": "msg-abc-123",
  "status": "delivered",
  "timestamp": "2023-01-01T12:01:00.000Z"
}
```

**Status Mapping:**
| Genesys Status | Internal Status |
|----------------|-----------------|
| Delivered      | delivered       |
| Read           | read            |
| Typing         | typing          |
| Disconnect     | disconnect      |

---

## 5. Functional Requirements

### 5.1 Webhook Ingress (REQ-SEC-01, REQ-OUT-01)

#### 5.1.1 HTTP Endpoint
```
POST /webhook
Content-Type: application/json
x-hub-signature-256: sha256=<hex-digest>
```

#### 5.1.2 Processing Steps

**Step 1: Extract Integration ID**
```python
integration_id = request_json["channel"]["from"]["id"]
```

**Step 2: Resolve Tenant**
```python
tenant_response = tenant_service.get_by_integration(integration_id)
tenant_id = tenant_response["tenantId"]
webhook_secret = tenant_response["webhookSecret"]
```

**Step 3: Validate Signature**
```python
import hmac
import hashlib

def validate_signature(raw_body: bytes, secret: str, signature_header: str) -> bool:
    """
    Validate HMAC-SHA256 signature.
    
    Args:
        raw_body: Raw request body bytes (not parsed JSON)
        secret: Webhook secret from tenant config
        signature_header: Value of x-hub-signature-256 header
        
    Returns:
        True if signature is valid, False otherwise
    """
    # Compute expected signature
    expected_signature = hmac.new(
        key=secret.encode('utf-8'),
        msg=raw_body,
        digestmod=hashlib.sha256
    ).hexdigest()
    
    # Extract signature from header (format: "sha256=<hex>")
    provided_signature = signature_header.replace("sha256=", "")
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(expected_signature, provided_signature)
```

**Step 4: Classify Event**
```python
def classify_event(payload: dict) -> str:
    """
    Determine event type based on payload structure.
    
    Returns: "outbound_message" | "status_event" | "health_check" | "unknown"
    """
    if payload["direction"] != "Outbound":
        return "unknown"
    
    event_type = payload.get("type")
    
    if event_type == "Text" or event_type == "Structured":
        return "outbound_message"
    elif event_type in ["Receipt", "Typing", "Disconnect"]:
        return "status_event"
    elif event_type == "HealthCheck":
        return "health_check"
    else:
        return "unknown"
```

**Step 5: Check for Echo**
```python
def is_echo_event(payload: dict) -> bool:
    """
    Detect middleware-injected messages that should be filtered.
    
    Returns: True if this is an echo that should be suppressed
    """
    message_id = payload.get("channel", {}).get("messageId")
    
    if not message_id:
        return False
    
    # Check for middleware-specific prefixes
    echo_prefixes = ["mw-", "middleware-", "injected-"]
    
    for prefix in echo_prefixes:
        if message_id.startswith(prefix):
            return True
    
    # Check if UUID matches known injection pattern
    if is_internal_uuid(message_id):
        return True
    
    return False

def is_internal_uuid(value: str) -> bool:
    """Check if value matches internal UUID format."""
    import re
    pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    return bool(re.match(pattern, value, re.IGNORECASE))
```

#### 5.1.3 Response Codes

| Scenario | Status Code | Response Body |
|----------|-------------|---------------|
| Success | 200 OK | `{"status": "accepted"}` |
| Invalid signature | 403 Forbidden | `{"error": "Invalid signature"}` |
| Tenant not found | 400 Bad Request | `{"error": "Unknown integration"}` |
| Malformed JSON | 400 Bad Request | `{"error": "Invalid JSON"}` |
| Service error | 500 Internal Server Error | `{"error": "Processing failed"}` |
| Dependency unavailable | 503 Service Unavailable | `{"error": "Service temporarily unavailable"}` |

### 5.2 Media Processing (REQ-OUT-02, REQ-OUT-03)

#### 5.2.1 Detection Logic
```python
def has_media(payload: dict) -> bool:
    """Check if payload contains media attachments."""
    content = payload.get("content", [])
    return any(item.get("contentType") == "Attachment" for item in content)

def extract_attachments(payload: dict) -> list:
    """Extract all attachment objects from payload."""
    content = payload.get("content", [])
    attachments = []
    
    for item in content:
        if item.get("contentType") == "Attachment":
            attachments.append(item["attachment"])
    
    return attachments
```

#### 5.2.2 Download and Upload Flow
```python
import requests
from io import BytesIO

async def process_media(attachment: dict, tenant_id: str) -> dict:
    """
    Download media from Genesys and upload to MinIO.
    
    Args:
        attachment: Genesys attachment object
        tenant_id: Tenant identifier for MinIO path
        
    Returns:
        dict with url, mime_type, filename, original_id
    """
    # Step 1: Get OAuth token
    auth_token = await auth_service.get_token(tenant_id, scope="genesys:media:download")
    
    # Step 2: Download from Genesys (streaming)
    genesys_url = attachment["url"]
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    response = requests.get(genesys_url, headers=headers, stream=True, timeout=30)
    response.raise_for_status()
    
    # Step 3: Determine file extension
    mime_type = attachment.get("mime", "application/octet-stream")
    extension = get_extension_from_mime(mime_type)
    
    # Step 4: Generate MinIO object key
    import uuid
    from datetime import datetime
    
    now = datetime.utcnow()
    object_key = f"{tenant_id}/{now.year}/{now.month:02d}/{now.day:02d}/{uuid.uuid4()}{extension}"
    
    # Step 5: Stream upload to MinIO
    minio_client.put_object(
        bucket_name="media-outbound",
        object_name=object_key,
        data=response.raw,
        length=-1,  # Unknown length, stream until EOF
        content_type=mime_type
    )
    
    # Step 6: Generate presigned URL (7 days)
    presigned_url = minio_client.presigned_get_object(
        bucket_name="media-outbound",
        object_name=object_key,
        expires=timedelta(days=7)
    )
    
    return {
        "url": presigned_url,
        "mime_type": mime_type,
        "filename": attachment.get("filename", "attachment"),
        "original_id": attachment["id"]
    }

def get_extension_from_mime(mime_type: str) -> str:
    """Map MIME type to file extension."""
    mime_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "application/pdf": ".pdf",
        "video/mp4": ".mp4",
        "audio/mpeg": ".mp3",
        "text/plain": ".txt"
    }
    return mime_map.get(mime_type, "")
```

#### 5.2.3 MIME Type Validation
```python
ALLOWED_MIME_TYPES = [
    # Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    
    # Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    
    # Audio
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    
    # Video
    "video/mp4",
    "video/quicktime",
    
    # Other
    "text/plain",
    "text/csv"
]

def validate_mime_type(mime_type: str) -> bool:
    """Check if MIME type is allowed for upload."""
    return mime_type in ALLOWED_MIME_TYPES
```

#### 5.2.4 Size and Timeout Limits
```python
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
DOWNLOAD_TIMEOUT_SECONDS = 30
UPLOAD_TIMEOUT_SECONDS = 30

def validate_file_size(content_length: int) -> bool:
    """Check if file size is within allowed limit."""
    return content_length <= MAX_FILE_SIZE_BYTES
```

### 5.3 Event Publishing (REQ-OUT-04, REQ-STATE-05)

#### 5.3.1 Outbound Message Publishing
```python
import json
import pika

def publish_outbound_message(
    tenant_id: str,
    genesys_id: str,
    payload: dict,
    timestamp: str
) -> bool:
    """
    Publish outbound message to RabbitMQ.
    
    Returns: True if published successfully, False otherwise
    """
    message = {
        "tenantId": tenant_id,
        "genesysId": genesys_id,
        "type": "message",
        "timestamp": timestamp,
        "payload": payload
    }
    
    try:
        channel.basic_publish(
            exchange='',
            routing_key='outboundQueue',
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Persistent
                content_type='application/json'
            )
        )
        return True
    except Exception as e:
        logger.error(f"Failed to publish to outboundQueue: {e}")
        return False
```

#### 5.3.2 Status Event Publishing
```python
def publish_status_event(
    tenant_id: str,
    genesys_id: str,
    original_message_id: str,
    status: str,
    timestamp: str
) -> bool:
    """
    Publish status event to RabbitMQ.
    
    Returns: True if published successfully, False otherwise
    """
    message = {
        "tenantId": tenant_id,
        "genesysId": genesys_id,
        "originalMessageId": original_message_id,
        "status": status.lower(),
        "timestamp": timestamp
    }
    
    try:
        channel.basic_publish(
            exchange='',
            routing_key='statusQueue',
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Persistent
                content_type='application/json'
            )
        )
        return True
    except Exception as e:
        logger.error(f"Failed to publish to statusQueue: {e}")
        return False
```

#### 5.3.3 Retry Logic
```python
def publish_with_retry(publish_func, *args, max_retries=1, **kwargs) -> bool:
    """
    Attempt to publish message with single retry on failure.
    
    Returns: True if any attempt succeeded
    """
    for attempt in range(max_retries + 1):
        try:
            if publish_func(*args, **kwargs):
                return True
        except Exception as e:
            logger.warning(f"Publish attempt {attempt + 1} failed: {e}")
            if attempt < max_retries:
                time.sleep(0.1)  # Brief delay before retry
    
    logger.critical("All publish attempts failed")
    return False
```

### 5.4 Complete Request Flow

```python
async def handle_webhook_request(request):
    """
    Main webhook handler - complete processing flow.
    
    Returns: HTTP response
    """
    start_time = time.time()
    
    try:
        # Step 1: Extract raw body for signature validation
        raw_body = await request.body()
        
        # Step 2: Parse JSON
        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError:
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid JSON"}
            )
        
        # Step 3: Extract integration ID
        integration_id = payload.get("channel", {}).get("from", {}).get("id")
        if not integration_id:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing integration ID"}
            )
        
        # Step 4: Resolve tenant
        try:
            tenant_data = await tenant_service.get_by_integration(integration_id)
            tenant_id = tenant_data["tenantId"]
            webhook_secret = tenant_data["webhookSecret"]
        except TenantNotFoundError:
            return JSONResponse(
                status_code=400,
                content={"error": "Unknown integration"}
            )
        
        # Step 5: Validate signature
        signature_header = request.headers.get("x-hub-signature-256", "")
        if not validate_signature(raw_body, webhook_secret, signature_header):
            logger.warning(f"Invalid signature for tenant {tenant_id}")
            return JSONResponse(
                status_code=403,
                content={"error": "Invalid signature"}
            )
        
        # Step 6: Check for echo
        if is_echo_event(payload):
            logger.info(f"Echo filtered for tenant {tenant_id}, genesysId {payload['id']}")
            return JSONResponse(
                status_code=200,
                content={"status": "accepted", "echo_filtered": True}
            )
        
        # Step 7: Classify event type
        event_type = classify_event(payload)
        
        if event_type == "health_check":
            return JSONResponse(
                status_code=200,
                content={"status": "healthy"}
            )
        
        # Step 8: Process based on type
        if event_type == "outbound_message":
            await process_outbound_message(tenant_id, payload)
        elif event_type == "status_event":
            await process_status_event(tenant_id, payload)
        else:
            logger.warning(f"Unknown event type: {payload.get('type')}")
        
        # Step 9: Log metrics
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Processed webhook in {processing_time:.2f}ms")
        
        return JSONResponse(
            status_code=200,
            content={"status": "accepted"}
        )
        
    except Exception as e:
        logger.error(f"Webhook processing failed: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Processing failed"}
        )

async def process_outbound_message(tenant_id: str, payload: dict):
    """Process outbound message event."""
    genesys_id = payload["id"]
    timestamp = payload["channel"]["time"]
    
    # Extract base payload
    message_payload = {
        "text": payload.get("text", ""),
        "to_id": payload["channel"]["to"]["id"],
        "to_id_type": payload["channel"]["to"]["idType"],
        "media": None
    }
    
    # Process media if present
    if has_media(payload):
        attachments = extract_attachments(payload)
        if attachments:
            # Process first attachment only (extend for multiple if needed)
            media_info = await process_media(attachments[0], tenant_id)
            message_payload["media"] = media_info
    
    # Publish to RabbitMQ
    publish_with_retry(
        publish_outbound_message,
        tenant_id=tenant_id,
        genesys_id=genesys_id,
        payload=message_payload,
        timestamp=timestamp
    )

async def process_status_event(tenant_id: str, payload: dict):
    """Process status event."""
    genesys_id = payload["id"]
    original_message_id = payload["channel"].get("messageId", "")
    status = payload.get("status", "").lower()
    timestamp = payload["channel"]["time"]
    
    # Publish to RabbitMQ
    publish_with_retry(
        publish_status_event,
        tenant_id=tenant_id,
        genesys_id=genesys_id,
        original_message_id=original_message_id,
        status=status,
        timestamp=timestamp
    )
```

---

## 6. Non-Functional Requirements

### 6.1 Performance

#### 6.1.1 Response Time (REQ-NFR-01)
- **Target:** 95th percentile < 2 seconds
- **Maximum:** 5 seconds (Genesys timeout threshold)
- **Measurement:** Time from request received to response sent

**Implementation:**
```python
RESPONSE_TIMEOUT_SECONDS = 4.5  # Safety margin before Genesys timeout

async def handle_with_timeout(request):
    """Ensure response within timeout."""
    try:
        return await asyncio.wait_for(
            handle_webhook_request(request),
            timeout=RESPONSE_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        logger.error("Request processing exceeded timeout")
        return JSONResponse(
            status_code=500,
            content={"error": "Processing timeout"}
        )
```

#### 6.1.2 Throughput
- **Target:** Handle 100 requests/second per instance
- **Scaling:** Horizontal scaling via container replication
- **Connection pooling:** Reuse RabbitMQ and HTTP connections

### 6.2 Reliability

#### 6.2.1 Idempotency (REQ-NFR-02)
**Mechanism:** Preserve Genesys event `id` throughout processing chain

**Deduplication:** Handled by downstream State Manager service

**Requirements:**
- Never modify `genesysId` field
- Don't generate new IDs for events
- Maintain correlation across systems

#### 6.2.2 Fault Tolerance
```python
# Connection pooling with auto-recovery
rabbitmq_connection = pika.BlockingConnection(
    pika.ConnectionParameters(
        host=RABBITMQ_HOST,
        heartbeat=600,
        blocked_connection_timeout=300,
        connection_attempts=3,
        retry_delay=2
    )
)

# Circuit breaker for external services
from circuitbreaker import circuit

@circuit(failure_threshold=5, recovery_timeout=60)
async def call_tenant_service(integration_id: str):
    """Call tenant service with circuit breaker protection."""
    # Implementation
```

### 6.3 Scalability

#### 6.3.1 Stateless Design
- No local state storage
- No in-memory session data
- No file system dependencies (except temp streams)

#### 6.3.2 Horizontal Scaling
```yaml
# Kubernetes deployment example
apiVersion: apps/v1
kind: Deployment
metadata:
  name: genesys-webhook-service
spec:
  replicas: 3  # Scale based on load
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

### 6.4 Observability

#### 6.4.1 Structured Logging
```python
import structlog

logger = structlog.get_logger()

# Example log entry
logger.info(
    "webhook_processed",
    tenant_id=tenant_id,
    genesys_id=genesys_id,
    integration_id=integration_id,
    event_type=event_type,
    processing_time_ms=processing_time,
    echo_filtered=is_echo,
    has_media=has_media,
    status="success"
)
```

#### 6.4.2 Metrics (Prometheus Format)
```python
from prometheus_client import Counter, Histogram, Gauge

# Request counters
webhook_requests_total = Counter(
    'webhook_requests_total',
    'Total webhook requests',
    ['tenant_id', 'event_type', 'status']
)

# Processing time histogram
webhook_processing_seconds = Histogram(
    'webhook_processing_seconds',
    'Webhook processing time',
    ['event_type']
)

# Signature validation failures
signature_failures_total = Counter(
    'signature_failures_total',
    'Total signature validation failures',
    ['tenant_id']
)

# Echo filtered events
echo_filtered_total = Counter(
    'echo_filtered_total',
    'Total echo events filtered',
    ['tenant_id']
)

# Media processing
media_processed_total = Counter(
    'media_processed_total',
    'Total media files processed',
    ['tenant_id', 'mime_type', 'status']
)

# RabbitMQ publish failures
rabbitmq_publish_failures_total = Counter(
    'rabbitmq_publish_failures_total',
    'Total RabbitMQ publish failures',
    ['queue']
)
```

#### 6.4.3 Health Check Endpoint
```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
async def health_check():
    """
    Health check endpoint for load balancers.
    
    Checks:
    - Service is running
    - RabbitMQ connection alive
    - MinIO accessible
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "dependencies": {}
    }
    
    # Check RabbitMQ
    try:
        rabbitmq_connection.process_data_events(time_limit=0)
        health_status["dependencies"]["rabbitmq"] = "healthy"
    except:
        health_status["dependencies"]["rabbitmq"] = "unhealthy"
        health_status["status"] = "degraded"
    
    # Check MinIO
    try:
        minio_client.bucket_exists("media-outbound")
        health_status["dependencies"]["minio"] = "healthy"
    except:
        health_status["dependencies"]["minio"] = "unhealthy"
        health_status["status"] = "degraded"
    
    status_code = 200 if health_status["status"] == "healthy" else 503
    return JSONResponse(status_code=status_code, content=health_status)

@app.get("/ready")
async def readiness_check():
    """Readiness check for Kubernetes."""
    # Similar to health but stricter - all dependencies must be healthy
    pass
```

---

## 7. Error Handling

### 7.1 Error Categories

#### 7.1.1 Client Errors (4xx)
| Error | HTTP Code | Cause | Action |
|-------|-----------|-------|--------|
| Invalid JSON | 400 | Malformed request body | Return error, log warning |
| Missing integration ID | 400 | Missing `channel.from.id` | Return error, log warning |
| Unknown integration | 400 | Integration ID not in tenant DB | Return error, log info |
| Invalid signature | 403 | HMAC mismatch | Return error, log security event |
| Request too large | 413 | Body exceeds size limit | Return error, log warning |

#### 7.1.2 Server Errors (5xx)
| Error | HTTP Code | Cause | Action |
|-------|-----------|-------|--------|
| Processing failure | 500 | Unhandled exception | Return error, log critical |
| Dependency unavailable | 503 | Tenant/Auth service down | Return error, retry internally |
| Timeout | 504 | Processing exceeded 5s | Return error, log warning |

### 7.2 Media Processing Errors

```python
class MediaProcessingError(Exception):
    """Base exception for media processing failures."""
    pass

class MediaDownloadError(MediaProcessingError):
    """Failed to download media from Genesys."""
    pass

class MediaUploadError(MediaProcessingError):
    """Failed to upload media to MinIO."""
    pass

class InvalidMediaError(MediaProcessingError):
    """Media validation failed."""
    pass

async def safe_process_media(attachment: dict, tenant_id: str) -> Optional[dict]:
    """
    Process media with comprehensive error handling.
    
    Returns: Media info dict on success, None on failure
    """
    try:
        # Validate MIME type
        mime_type = attachment.get("mime", "")
        if not validate_mime_type(mime_type):
            raise InvalidMediaError(f"Unsupported MIME type: {mime_type}")
        
        # Process media
        return await process_media(attachment, tenant_id)
        
    except MediaDownloadError as e:
        logger.error(f"Media download failed: {e}", extra={
            "tenant_id": tenant_id,
            "media_id": attachment.get("id"),
            "url": attachment.get("url")
        })
        return None
        
    except MediaUploadError as e:
        logger.error(f"Media upload failed: {e}", extra={
            "tenant_id": tenant_id,
            "media_id": attachment.get("id")
        })
        return None
        
    except InvalidMediaError as e:
        logger.warning(f"Invalid media: {e}", extra={
            "tenant_id": tenant_id,
            "media_id": attachment.get("id"),
            "mime_type": mime_type
        })
        return None
        
    except Exception as e:
        logger.exception(f"Unexpected media processing error: {e}")
        return None
```

### 7.3 Graceful Degradation

**Strategy:** Continue processing text even if media fails

```python
async def process_outbound_message_with_degradation(tenant_id: str, payload: dict):
    """
    Process message with graceful degradation for media failures.
    """
    message_payload = {
        "text": payload.get("text", ""),
        "to_id": payload["channel"]["to"]["id"],
        "to_id_type": payload["channel"]["to"]["idType"],
        "media": None
    }
    
    # Attempt media processing
    if has_media(payload):
        attachments = extract_attachments(payload)
        if attachments:
            media_info = await safe_process_media(attachments[0], tenant_id)
            if media_info:
                message_payload["media"] = media_info
            else:
                # Media failed but continue with text
                logger.warning("Continuing without media due to processing failure")
                # Optionally add flag to indicate media was stripped
                message_payload["media_processing_failed"] = True
    
    # Always publish message (with or without media)
    publish_with_retry(
        publish_outbound_message,
        tenant_id=tenant_id,
        genesys_id=payload["id"],
        payload=message_payload,
        timestamp=payload["channel"]["time"]
    )
```

---

## 8. Security Requirements

### 8.1 Authentication and Authorization

#### 8.1.1 Webhook Signature Validation
**CRITICAL:** Use raw request body, not parsed JSON

```python
# CORRECT: Use raw bytes
raw_body = await request.body()
is_valid = validate_signature(raw_body, secret, signature_header)

# INCORRECT: Using parsed JSON will fail
parsed = await request.json()
is_valid = validate_signature(json.dumps(parsed), secret, signature_header)  # WRONG!
```

**Why:** JSON parsing may reorder keys or change whitespace, invalidating signature.

#### 8.1.2 Constant-Time Comparison
```python
import hmac

# CORRECT: Prevents timing attacks
hmac.compare_digest(expected, provided)

# INCORRECT: Vulnerable to timing attacks
expected == provided  # NEVER use this for security!
```

### 8.2 Input Validation

#### 8.2.1 Request Size Limits
```python
MAX_REQUEST_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    """Reject oversized requests."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_REQUEST_SIZE_BYTES:
        return JSONResponse(
            status_code=413,
            content={"error": "Request too large"}
        )
    return await call_next(request)
```

#### 8.2.2 Content-Type Validation
```python
ALLOWED_CONTENT_TYPES = ["application/json"]

def validate_content_type(content_type: str) -> bool:
    """Ensure only JSON webhooks are accepted."""
    return content_type.lower().startswith("application/json")
```

### 8.3 Data Protection

#### 8.3.1 Secrets Management
```python
# Use environment variables or secrets manager
WEBHOOK_SECRETS = {}  # Never hardcode secrets

# Fetch from tenant service at runtime
def get_webhook_secret(integration_id: str) -> str:
    """Retrieve webhook secret from secure source."""
    tenant = tenant_service.get_by_integration(integration_id)
    return tenant["webhookSecret"]
```

#### 8.3.2 Logging Security
```python
def sanitize_for_logging(payload: dict) -> dict:
    """Remove sensitive data before logging."""
    safe_payload = payload.copy()
    
    # Remove or mask sensitive fields
    if "content" in safe_payload:
        for item in safe_payload["content"]:
            if "attachment" in item and "url" in item["attachment"]:
                # Log only media ID, not authenticated URL
                item["attachment"]["url"] = "[REDACTED]"
    
    return safe_payload

# Usage
logger.info("Received webhook", payload=sanitize_for_logging(payload))
```

### 8.4 Network Security

#### 8.4.1 TLS/HTTPS Enforcement
```python
# Enforce HTTPS in production
@app.middleware("http")
async def enforce_https(request: Request, call_next):
    """Redirect HTTP to HTTPS in production."""
    if request.url.scheme != "https" and not is_development():
        return RedirectResponse(
            url=request.url.replace(scheme="https"),
            status_code=301
        )
    return await call_next(request)
```

#### 8.4.2 Rate Limiting
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/webhook")
@limiter.limit("100/minute")  # 100 requests per minute per IP
async def webhook(request: Request):
    """Rate-limited webhook endpoint."""
    pass
```

---

## 9. Testing Scenarios

### 9.1 Unit Tests

#### 9.1.1 Signature Validation Tests
```python
import unittest

class TestSignatureValidation(unittest.TestCase):
    
    def test_valid_signature(self):
        """Test with correct signature."""
        body = b'{"test": "data"}'
        secret = "my-secret-key"
        signature = generate_signature(body, secret)
        
        self.assertTrue(
            validate_signature(body, secret, f"sha256={signature}")
        )
    
    def test_invalid_signature(self):
        """Test with incorrect signature."""
        body = b'{"test": "data"}'
        secret = "my-secret-key"
        wrong_signature = "invalid-signature-hash"
        
        self.assertFalse(
            validate_signature(body, secret, f"sha256={wrong_signature}")
        )
    
    def test_tampered_body(self):
        """Test with tampered request body."""
        original_body = b'{"test": "data"}'
        secret = "my-secret-key"
        signature = generate_signature(original_body, secret)
        
        tampered_body = b'{"test": "modified"}'
        
        self.assertFalse(
            validate_signature(tampered_body, secret, f"sha256={signature}")
        )
    
    def test_missing_signature_header(self):
        """Test with missing signature header."""
        body = b'{"test": "data"}'
        secret = "my-secret-key"
        
        self.assertFalse(
            validate_signature(body, secret, "")
        )
```

#### 9.1.2 Echo Detection Tests
```python
class TestEchoDetection(unittest.TestCase):
    
    def test_echo_with_middleware_prefix(self):
        """Test detection of middleware-prefixed message."""
        payload = {
            "channel": {
                "messageId": "mw-12345-67890"
            }
        }
        self.assertTrue(is_echo_event(payload))
    
    def test_echo_with_internal_uuid(self):
        """Test detection of internal UUID pattern."""
        payload = {
            "channel": {
                "messageId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
            }
        }
        self.assertTrue(is_echo_event(payload))
    
    def test_non_echo_genesys_message(self):
        """Test genuine Genesys message is not filtered."""
        payload = {
            "channel": {
                "messageId": None
            }
        }
        self.assertFalse(is_echo_event(payload))
    
    def test_non_echo_with_external_id(self):
        """Test external message ID is not filtered."""
        payload = {
            "channel": {
                "messageId": "external-system-msg-123"
            }
        }
        self.assertFalse(is_echo_event(payload))
```

#### 9.1.3 Event Classification Tests
```python
class TestEventClassification(unittest.TestCase):
    
    def test_classify_text_message(self):
        """Test classification of text message."""
        payload = {
            "type": "Text",
            "direction": "Outbound",
            "text": "Hello"
        }
        self.assertEqual(classify_event(payload), "outbound_message")
    
    def test_classify_receipt_event(self):
        """Test classification of delivery receipt."""
        payload = {
            "type": "Receipt",
            "direction": "Outbound",
            "status": "Delivered"
        }
        self.assertEqual(classify_event(payload), "status_event")
    
    def test_classify_health_check(self):
        """Test classification of health check."""
        payload = {
            "type": "HealthCheck",
            "direction": "Outbound"
        }
        self.assertEqual(classify_event(payload), "health_check")
    
    def test_reject_inbound_events(self):
        """Test inbound events are not processed."""
        payload = {
            "type": "Text",
            "direction": "Inbound",
            "text": "Customer message"
        }
        self.assertEqual(classify_event(payload), "unknown")
```

### 9.2 Integration Tests

#### 9.2.1 End-to-End Message Flow
```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_successful_text_message_processing(test_client: AsyncClient):
    """Test complete flow for text message."""
    
    # Prepare webhook payload
    payload = {
        "id": "test-msg-123",
        "channel": {
            "from": {"id": "integration-test-001"},
            "to": {"id": "919876543210"},
            "time": "2023-01-01T12:00:00.000Z"
        },
        "type": "Text",
        "text": "Test message",
        "direction": "Outbound"
    }
    
    # Generate valid signature
    secret = "test-webhook-secret"
    body_bytes = json.dumps(payload).encode()
    signature = generate_signature(body_bytes, secret)
    
    # Send webhook request
    response = await test_client.post(
        "/webhook",
        json=payload,
        headers={"x-hub-signature-256": f"sha256={signature}"}
    )
    
    # Verify response
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"
    
    # Verify message published to RabbitMQ
    published_message = await get_from_rabbitmq("outboundQueue")
    assert published_message["genesysId"] == "test-msg-123"
    assert published_message["payload"]["text"] == "Test message"
```

#### 9.2.2 Media Processing Integration
```python
@pytest.mark.asyncio
async def test_media_download_and_upload(test_client: AsyncClient, mock_genesys, mock_minio):
    """Test media processing flow."""
    
    # Setup mocks
    mock_genesys.register_media(
        media_id="test-media-789",
        content=b"fake-image-data",
        mime_type="image/jpeg"
    )
    
    # Webhook payload with attachment
    payload = {
        "id": "test-msg-456",
        "channel": {
            "from": {"id": "integration-test-001"},
            "to": {"id": "919876543210"},
            "time": "2023-01-01T12:00:00.000Z"
        },
        "type": "Text",
        "text": "Here's an image",
        "direction": "Outbound",
        "content": [
            {
                "contentType": "Attachment",
                "attachment": {
                    "id": "test-media-789",
                    "url": "https://api.genesys.cloud/v2/downloads/token/test-media-789",
                    "mime": "image/jpeg"
                }
            }
        ]
    }
    
    # Send request
    response = await send_authenticated_webhook(test_client, payload)
    
    # Verify response
    assert response.status_code == 200
    
    # Verify media uploaded to MinIO
    assert mock_minio.object_exists("media-outbound", contains="test-media-789")
    
    # Verify RabbitMQ message contains MinIO URL
    published = await get_from_rabbitmq("outboundQueue")
    assert "minio" in published["payload"]["media"]["url"]
```

### 9.3 Load Tests

```python
import asyncio
from locust import HttpUser, task, between

class WebhookLoadTest(HttpUser):
    """Load test for webhook endpoint."""
    
    wait_time = between(0.1, 0.5)
    
    def on_start(self):
        """Setup test data."""
        self.payload = {
            "id": f"load-test-{self.environment.runner.user_count}",
            "channel": {
                "from": {"id": "integration-test-001"},
                "to": {"id": "919876543210"},
                "time": "2023-01-01T12:00:00.000Z"
            },
            "type": "Text",
            "text": "Load test message",
            "direction": "Outbound"
        }
        
        self.secret = "test-secret"
        body_bytes = json.dumps(self.payload).encode()
        self.signature = generate_signature(body_bytes, self.secret)
    
    @task
    def send_webhook(self):
        """Send webhook request."""
        headers = {
            "x-hub-signature-256": f"sha256={self.signature}",
            "Content-Type": "application/json"
        }
        
        with self.client.post(
            "/webhook",
            json=self.payload,
            headers=headers,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Got status code {response.status_code}")
```

---

## 10. Implementation Notes

### 10.1 Technology Stack Recommendations

#### 10.1.1 Framework
**Recommended:** FastAPI (Python)

**Rationale:**
- Async support for I/O-bound operations
- Built-in request validation
- OpenAPI documentation
- High performance

**Alternative:** Express.js (Node.js), Spring Boot (Java)

#### 10.1.2 Dependencies
```python
# requirements.txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
pika==1.3.2  # RabbitMQ client
minio==7.2.0  # MinIO client
httpx==0.25.0  # Async HTTP client
pydantic==2.4.2  # Data validation
python-dotenv==1.0.0  # Environment config
structlog==23.2.0  # Structured logging
prometheus-client==0.19.0  # Metrics
```

### 10.2 Configuration Management

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application configuration."""
    
    # Service
    service_name: str = "genesys-webhook-service"
    environment: str = "production"
    port: int = 8000
    
    # RabbitMQ
    rabbitmq_host: str
    rabbitmq_port: int = 5672
    rabbitmq_username: str
    rabbitmq_password: str
    rabbitmq_vhost: str = "/"
    outbound_queue: str = "outboundQueue"
    status_queue: str = "statusQueue"
    
    # MinIO
    minio_endpoint: str
    minio_access_key: str
    minio_secret_key: str
    minio_bucket: str = "media-outbound"
    minio_secure: bool = True
    
    # Tenant Service
    tenant_service_url: str
    tenant_service_timeout: int = 5
    
    # Auth Service
    auth_service_url: str
    auth_service_timeout: int = 5
    
    # Processing
    max_request_size_mb: int = 10
    max_file_size_mb: int = 20
    media_download_timeout: int = 30
    
    # Security
    echo_detection_prefixes: list[str] = ["mw-", "middleware-", "injected-"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
```

### 10.3 Deployment Considerations

#### 10.3.1 Docker Configuration
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

#### 10.3.2 Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: genesys-webhook-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: genesys-webhook-service
  template:
    metadata:
      labels:
        app: genesys-webhook-service
    spec:
      containers:
      - name: webhook-service
        image: genesys-webhook-service:1.2
        ports:
        - containerPort: 8000
        env:
        - name: RABBITMQ_HOST
          valueFrom:
            configMapKeyRef:
              name: service-config
              key: rabbitmq-host
        - name: RABBITMQ_PASSWORD
          valueFrom:
            secretKeyRef:
              name: service-secrets
              key: rabbitmq-password
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 10
```

### 10.4 Monitoring and Alerting

#### 10.4.1 Critical Alerts
```yaml
# Prometheus alert rules
groups:
  - name: webhook_service_alerts
    interval: 30s
    rules:
      - alert: HighSignatureFailureRate
        expr: rate(signature_failures_total[5m]) > 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High rate of signature validation failures"
          description: "Possible security issue or misconfigured tenant"
      
      - alert: WebhookProcessingTimeout
        expr: histogram_quantile(0.95, webhook_processing_seconds) > 4
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Webhook processing approaching timeout"
          description: "95th percentile processing time > 4 seconds"
      
      - alert: RabbitMQPublishFailures
        expr: rate(rabbitmq_publish_failures_total[5m]) > 1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "RabbitMQ publish failures detected"
          description: "Events may be lost"
      
      - alert: MediaProcessingFailures
        expr: rate(media_processed_total{status="failed"}[10m]) > 5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High media processing failure rate"
          description: "Check MinIO and Genesys connectivity"
```

---

## Appendix A: Event Type Reference

### Genesys Event Types

| Type | Direction | Description | Action |
|------|-----------|-------------|--------|
| Text | Outbound | Agent text message | Process → outboundQueue |
| Text | Inbound | Customer text message | Ignore (handled elsewhere) |
| Structured | Outbound | Rich message (buttons, cards) | Process → outboundQueue |
| Attachment | Outbound | Media from agent | Download → MinIO → outboundQueue |
| Receipt | Outbound | Delivery/read status | Extract → statusQueue |
| Typing | Outbound | Typing indicator | Extract → statusQueue |
| Disconnect | Outbound | Conversation ended | Extract → statusQueue |
| HealthCheck | Outbound | Genesys ping | Return 200 OK immediately |

---

## Appendix B: Troubleshooting Guide

### Common Issues

#### Issue: Signature validation failing
**Symptoms:** 403 errors, high `signature_failures_total` metric

**Causes:**
1. Using parsed JSON instead of raw body
2. Incorrect webhook secret
3. Tenant not configured properly
4. Clock skew between systems

**Resolution:**
```python
# Debug signature generation
logger.debug(
    "signature_validation_debug",
    raw_body_preview=raw_body[:100],
    computed_signature=computed_sig,
    provided_signature=provided_sig,
    tenant_id=tenant_id
)
```

#### Issue: Echo loop detected
**Symptoms:** Messages bouncing between systems

**Resolution:**
- Verify `echo_detection_prefixes` configuration
- Check `channel.messageId` format in injected messages
- Review logs for `echo_filtered=true` entries

#### Issue: Media processing timeout
**Symptoms:** 500 errors, incomplete messages in queue

**Causes:**
1. Large file downloads exceeding timeout
2. MinIO connectivity issues
3. Genesys OAuth token expired

**Resolution:**
- Increase `MEDIA_DOWNLOAD_TIMEOUT`
- Implement async media processing
- Add retry logic for transient failures

---

## Appendix C: API Contract Summary

### POST /webhook

**Request:**
```http
POST /webhook HTTP/1.1
Host: webhook.example.com
Content-Type: application/json
x-hub-signature-256: sha256=abc123...

{Genesys webhook JSON}
```

**Success Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{"status": "accepted"}
```

**Error Responses:**
```http
HTTP/1.1 400 Bad Request
{"error": "Invalid JSON"}

HTTP/1.1 403 Forbidden
{"error": "Invalid signature"}

HTTP/1.1 500 Internal Server Error
{"error": "Processing failed"}
```

---

## Appendix D: Glossary

| Term | Definition |
|------|------------|
| Echo Event | Webhook triggered by middleware's own message injection |
| Integration ID | Genesys identifier for Open Messaging integration |
| Genesys ID | Unique identifier for each webhook event |
| Tenant ID | Internal identifier for customer organization |
| Webhook Secret | HMAC key for signature validation |
| Presigned URL | Time-limited, authenticated URL for media access |
| Loop Prevention | Mechanism to avoid infinite message cycles |
| Stateless Service | Service with no local persistent state |

---

**Document Version:** 1.2 (LLM-Optimized)  
**Last Updated:** 2024  
**Author:** System Architecture Team  
**Maintained By:** Engineering Team
--- END genesys-webhook-service/genesys-webhook-frd.md ---


--- BEGIN inbound-transformer/inbound-transformer-frd.md ---

# Inbound Transformer Service - Comprehensive Requirements Document

**Version:** 1.2 (Enterprise Hardened)  
**Service Name:** `inbound-transformer`  
**Document Purpose:** Code generation, implementation guidance, and debugging reference  
**Parent Document:** System Design Document

---

## Table of Contents

1. [Service Overview](#service-overview)
2. [Architecture Context](#architecture-context)
3. [Core Responsibilities](#core-responsibilities)
4. [Technology Stack & Dependencies](#technology-stack--dependencies)
5. [Data Contracts](#data-contracts)
6. [Functional Requirements](#functional-requirements)
7. [Non-Functional Requirements](#non-functional-requirements)
8. [Error Handling & Resilience](#error-handling--resilience)
9. [Security Requirements](#security-requirements)
10. [Observability & Monitoring](#observability--monitoring)
11. [Testing Requirements](#testing-requirements)
12. [Deployment & Operations](#deployment--operations)
13. [Implementation Guidelines](#implementation-guidelines)
14. [Common Pitfalls & Anti-Patterns](#common-pitfalls--anti-patterns)

---

## Service Overview

### Purpose
The Inbound Transformer Service is a **stateless, deterministic message-processing microservice** that translates enriched WhatsApp payloads into Open Messaging payloads compatible with Genesys Cloud and the WhatsApp Business Platform.

### Key Characteristics
- **Stateless**: No persistent storage, no business state management
- **Deterministic**: Same input always produces same output
- **Single Responsibility**: Transform and dispatch only
- **Horizontally Scalable**: Designed for multi-instance deployment
- **Idempotent**: Safe to retry operations

### What This Service DOES
✅ Consume enriched payloads from RabbitMQ  
✅ Transform WhatsApp format → Genesys Open Messaging format  
✅ Dispatch to Genesys API Service  
✅ Handle retries with exponential backoff  
✅ Route failures to dead-letter queue  
✅ Deduplicate messages and events  
✅ Emit metrics and structured logs  

### What This Service DOES NOT DO
❌ Identity resolution (handled by State Manager)  
❌ Mapping creation (handled by State Manager)  
❌ Business state storage (stateless by design)  
❌ Direct interaction with Genesys Cloud API (uses abstraction layer)  
❌ Direct interaction with WhatsApp API (upstream responsibility)  
❌ Message routing decisions (all messages follow same path)  
❌ Schema validation beyond basic structure (upstream responsibility)  

---

## Architecture Context

### Position in Data Flow

```
WhatsApp Business API
        ↓
[Inbound Webhook Handler]
        ↓
[State Manager Service]  ← Enriches & validates
        ↓
    RabbitMQ Queue: inbound-processed
        ↓
[Inbound Transformer Service]  ← THIS SERVICE
        ↓
[Genesys API Service]  ← Abstraction layer
        ↓
Genesys Cloud Platform
```

### Upstream Dependencies
- **State Manager Service**: Produces enriched, validated payloads
- **RabbitMQ**: Message broker providing `inbound-processed` queue

### Downstream Dependencies
- **Genesys API Service**: Internal REST service abstracting Genesys Cloud API
- **Redis** (optional): Idempotency cache
- **Prometheus**: Metrics collection
- **Logging Infrastructure**: JSON log aggregation

### Service Boundaries
- **Input Boundary**: RabbitMQ consumer
- **Output Boundary**: HTTP client to Genesys API Service
- **No Side Channels**: No database, no file system, no external APIs

---

## Core Responsibilities

### 1. Message Consumption (REQ-IN-07)

**Trigger**: Message arrives in `inbound-processed` queue

**Steps**:
1. Deserialize JSON payload
2. Validate required fields
3. Check idempotency (prevent duplicates)
4. Transform payload
5. Dispatch to Genesys API Service
6. ACK/NACK based on result

**Validation Rules**:
- `tenantId` must be present (UUID format)
- `waId` must be present (E.164 phone format expected)
- `type` must be one of: `["message", "event"]`
- JSON must be well-formed

**Idempotency Keys**:
- **For Messages**: Use `internalId` field directly
- **For Events**: Composite key = `SHA256(wamid + status + timestamp)`

### 2. Message Transformation (REQ-IN-05)

**Input**: WhatsApp-enriched format from State Manager  
**Output**: Genesys Open Messaging format

**Transformation Types**:
- Text messages → Genesys Text message
- Media messages → Genesys Media message
- Text + Media → Genesys Text with attachmenta
- Status events → Genesys Receipt events

### 3. Dispatch & Retry (REQ-IN-08)

**Dispatch Targets**:
- Messages: `POST /genesys/messages/inbound`
- Events: `POST /genesys/events/inbound`

**Retry Behavior**:
- 2xx: Success, ACK message
- 4xx: Client error, ACK (log and move on)
- 5xx: Server error, NACK (retry with backoff)
- Timeout: NACK (treat as temporary failure)

**Backoff Strategy**:
- Algorithm: Exponential with jitter
- Base delay: 1 second
- Max attempts: 5
- Max delay: 32 seconds
- Formula: `min(base * 2^attempt + random(0, 1000ms), 32000ms)`

### 4. Reliability & Observability

**Reliability**:
- Idempotent processing (safe to retry)
- Dead-letter queue after max retries
- No silent message drops
- Controlled failure modes

**Observability**:
- Structured JSON logging
- Prometheus metrics
- Correlation ID propagation
- Error tracking with context

---

## Technology Stack & Dependencies

### Required Components

| Component | Purpose | Version/Type | Configuration |
|-----------|---------|--------------|---------------|
| **RabbitMQ** | Message broker | 3.11+ | Queue: `inbound-processed`, Exchange: `inbound`, DLQ: `inbound-transformer-dlq` |
| **Genesys API Service** | REST destination | Internal | Endpoints: `/genesys/messages/inbound`, `/genesys/events/inbound` |
| **Redis** | Idempotency cache (optional) | 6.0+ | TTL: 24 hours, Namespace: `inbound-transformer:dedup:` |
| **Prometheus** | Metrics | 2.x | Scrape endpoint: `/metrics` |
| **Logging System** | Log aggregation | - | Format: JSON, Level: INFO minimum |

### Language & Runtime Recommendations
- **Node.js** (16+): Good async I/O, JSON native
- **Go**: High performance, good concurrency
- **Python** (3.9+): Rapid development, good libraries
- **Java/Kotlin** (11+): Enterprise-grade, Spring Boot ecosystem

### Key Libraries Needed
- **AMQP Client**: RabbitMQ connection
- **HTTP Client**: Genesys API calls (with timeout, retry)
- **JSON Parser**: Payload processing
- **Logging**: Structured JSON output
- **Metrics**: Prometheus client
- **UUID Generation**: Idempotency keys
- **Date/Time**: ISO 8601 formatting
- **Hashing**: SHA256 for composite keys

---

## Data Contracts

### 5.1 Input Schema - Type A: User Message

**Source**: State Manager via RabbitMQ `inbound-processed` queue

```json
{
  "type": "message",
  "internalId": "uuid-1234-5678-9abc-def0",
  "tenantId": "uuid-tenant-1111-2222-3333",
  "waId": "919876543210",
  "conversationId": "genesys-conv-uuid-999",
  "wamid": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
  "contactName": "John Doe",
  "timestamp": 1700000000,
  "payload": {
    "body": "Hello World",
    "media": {
      "url": "https://minio.internal/bucket/file.jpg",
      "mime_type": "image/jpeg",
      "caption": "Check this out"
    }
  }
}
```

**Field Specifications**:

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `type` | string | Yes | Must be `"message"` | Discriminator field |
| `internalId` | string | Yes | UUID v4 format | Unique message identifier, used as idempotency key |
| `tenantId` | string | Yes | UUID v4 format | Organization identifier |
| `waId` | string | Yes | E.164 format | WhatsApp ID (phone number) |
| `conversationId` | string | Yes | Non-empty string | Genesys conversation ID from mapping |
| `wamid` | string | Yes | Starts with `wamid.` | WhatsApp message ID |
| `contactName` | string | No | Max 256 chars | Display name for user |
| `timestamp` | integer | Yes | Unix epoch (seconds) | Message creation time |
| `payload.body` | string | No | Max 4096 chars | Message text content |
| `payload.media` | object | No | - | Media attachment (optional) |
| `payload.media.url` | string | Conditional | HTTPS URL | Media file URL (required if media present) |
| `payload.media.mime_type` | string | Conditional | MIME format | Content type (required if media present) |
| `payload.media.caption` | string | No | Max 1024 chars | Media caption/description |

**Validation Rules**:
1. At least one of `payload.body` or `payload.media` must be present
2. If `payload.media` exists, both `url` and `mime_type` are required
3. `timestamp` must not be more than 5 minutes in the future
4. `waId` should be numeric (phone number)
5. All URLs must use HTTPS scheme

### 5.2 Input Schema - Type B: Status Event

**Source**: State Manager via RabbitMQ `inbound-processed` queue

```json
{
  "type": "event",
  "tenantId": "uuid-tenant-1111-2222-3333",
  "waId": "919876543210",
  "wamid": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
  "status": "read",
  "timestamp": 1700000005,
  "reason": "Message failed due to network error"
}
```

**Field Specifications**:

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `type` | string | Yes | Must be `"event"` | Discriminator field |
| `tenantId` | string | Yes | UUID v4 format | Organization identifier |
| `waId` | string | Yes | E.164 format | WhatsApp ID (phone number) |
| `wamid` | string | Yes | Starts with `wamid.` | WhatsApp message ID being acknowledged |
| `status` | string | Yes | One of: `sent`, `delivered`, `read`, `failed` | Delivery status |
| `timestamp` | integer | Yes | Unix epoch (seconds) | Status change time |
| `reason` | string | No | Max 512 chars | Failure reason (only for `failed` status) |

**Idempotency Key Generation**:
```
key = SHA256(wamid + "|" + status + "|" + timestamp)
```

### 5.3 Output Schema - Genesys Inbound Message

**Destination**: Genesys API Service `POST /genesys/messages/inbound`

**Text Message Example**:
```json
{
  "id": "uuid-1234-5678-9abc-def0",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "messageId": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
    "to": {
      "id": "integration-id-from-config"
    },
    "from": {
      "nickname": "John Doe",
      "id": "919876543210",
      "idType": "Phone",
      "firstName": "John"
    },
    "time": "2023-11-15T03:33:20.000Z"
  },
  "type": "Text",
  "text": "Hello World",
  "direction": "Inbound"
}
```

**Media Message Example**:
```json
{
  "id": "uuid-1234-5678-9abc-def0",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "messageId": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
    "to": {
      "id": "integration-id-from-config"
    },
    "from": {
      "nickname": "John Doe",
      "id": "919876543210",
      "idType": "Phone",
      "firstName": "John"
    },
    "time": "2023-11-15T03:33:20.000Z"
  },
  "type": "Text",
  "text": "Check this out",
  "content": [
    {
      "contentType": "Attachment",
      "attachment": {
        "url": "https://minio.internal/bucket/file.jpg",
        "mime": "image/jpeg"
      }
    }
  ],
  "direction": "Inbound"
}
```

**Field Specifications**:

| Field | Type | Required | Source/Logic | Description |
|-------|------|----------|--------------|-------------|
| `id` | string | Yes | From `internalId` | Message identifier |
| `channel.platform` | string | Yes | Constant: `"Open"` | Platform type |
| `channel.type` | string | Yes | Constant: `"Private"` | Channel type |
| `channel.messageId` | string | Yes | From `wamid` | External message ID |
| `channel.to.id` | string | Yes | From config/env | Integration ID |
| `channel.from.id` | string | Yes | From `waId` | User identifier |
| `channel.from.idType` | string | Yes | Constant: `"Phone"` | ID type |
| `channel.from.nickname` | string | No | From `contactName` | Display name |
| `channel.from.firstName` | string | No | Derived from `contactName` | First word of name |
| `channel.time` | string | Yes | From `timestamp` (converted) | ISO 8601 UTC |
| `type` | string | Yes | `"Text"` or `"Media"` | Message type |
| `text` | string | Conditional | From `payload.body` or caption | Message text |
| `content` | array | No | From `payload.media` | Attachments |
| `direction` | string | Yes | Constant: `"Inbound"` | Message direction |

**Type Determination Logic**:
```
IF payload.body exists AND payload.media exists:
  type = "Text"
  text = payload.body
  content = [attachment from media]
  
ELSE IF payload.body exists:
  type = "Text"
  text = payload.body
  
ELSE IF payload.media exists:
  type = "Text"
  text = payload.media.caption OR "[Attachment]"
  content = [attachment from media]
```

**FirstName Extraction Logic**:
```
IF contactName exists:
  firstName = contactName.split()[0]  // First word
ELSE:
  firstName = null  // Omit field
```

### 5.4 Output Schema - Genesys Receipt Event

**Destination**: Genesys API Service `POST /genesys/events/inbound`

```json
{
  "id": "uuid-status-7890-abcd-ef12",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "messageId": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
    "to": {
      "id": "integration-id-from-config"
    },
    "from": {
      "id": "919876543210",
      "idType": "Phone"
    },
    "time": "2023-11-15T03:33:25.000Z"
  },
  "type": "Receipt",
  "status": "Read",
  "direction": "Outbound",
  "reason": "Network timeout"
}
```

**Field Specifications**:

| Field | Type | Required | Source/Logic | Description |
|-------|------|----------|--------------|-------------|
| `id` | string | Yes | Generate UUID v4 | Event identifier |
| `channel.platform` | string | Yes | Constant: `"Open"` | Platform type |
| `channel.type` | string | Yes | Constant: `"Private"` | Channel type |
| `channel.messageId` | string | Yes | From `wamid` | Message being acknowledged |
| `channel.to.id` | string | Yes | From config/env | Integration ID |
| `channel.from.id` | string | Yes | From `waId` | User identifier |
| `channel.from.idType` | string | Yes | Constant: `"Phone"` | ID type |
| `channel.time` | string | Yes | From `timestamp` (converted) | ISO 8601 UTC |
| `type` | string | Yes | Constant: `"Receipt"` | Event type |
| `status` | string | Yes | Mapped from `status` field | Receipt status |
| `direction` | string | Yes | Constant: `"Outbound"` | Always outbound for receipts |
| `reason` | string | No | From `reason` field | Failure reason (optional) |

**Status Mapping Table**:

| WhatsApp Status | Genesys Status | Process? | Notes |
|----------------|----------------|----------|-------|
| `sent` | `Published` | Optional | Configurable to ignore |
| `delivered` | `Delivered` | Yes | Message reached device |
| `read` | `Read` | Yes | User opened message |
| `failed` | `Failed` | Yes | Delivery failed, include reason |

**Configuration Option**:
```
IGNORE_SENT_STATUS=true  // Skip processing "sent" events
```

### 5.5 HTTP Headers for Dispatch

**Request Headers to Genesys API Service**:

```
POST /genesys/messages/inbound
Authorization: Bearer <internal-service-token>
Content-Type: application/json
X-Tenant-ID: uuid-tenant-1111-2222-3333
X-Correlation-ID: uuid-1234-5678-9abc-def0
X-Message-Source: inbound-transformer
```

| Header | Required | Source | Description |
|--------|----------|--------|-------------|
| `Authorization` | Yes | Config/env | Internal service authentication token |
| `Content-Type` | Yes | Constant | Always `application/json` |
| `X-Tenant-ID` | Yes | From `tenantId` | Organization identifier for routing |
| `X-Correlation-ID` | Yes | From `internalId` or generated | Request tracing |
| `X-Message-Source` | Yes | Constant | Service identifier |

---

## Functional Requirements

### 6.1 Message Consumption Flow (REQ-IN-07)

**Requirement**: Consume and validate messages from RabbitMQ

**Implementation Steps**:

1. **Connect to RabbitMQ**
   ```
   - Connect to queue: inbound-processed
   - Set prefetch count: 10 (limit in-flight messages)
   - Enable manual acknowledgments
   ```

2. **Receive Message**
   ```
   - Receive raw message bytes
   - Parse as UTF-8 string
   - Deserialize JSON
   ```

3. **Validate Structure**
   ```
   - Check JSON is valid
   - Verify required fields present
   - Validate field types
   - Check field constraints
   ```

4. **Idempotency Check**
   ```
   - Extract/generate idempotency key
   - Check cache (Redis or in-memory)
   - If duplicate: ACK and return
   - If new: Add to cache with 24h TTL
   ```

5. **Process Message**
   ```
   - Transform payload
   - Dispatch to Genesys API
   - Handle response
   ```

6. **Acknowledgment**
   ```
   - On success: ACK
   - On retriable failure: NACK (requeue)
   - On permanent failure: ACK + DLQ
   ```

**Error Scenarios**:

| Error Type | Action | Rationale |
|------------|--------|-----------|
| Invalid JSON | ACK + log error | Cannot process, don't retry |
| Missing required field | ACK + log error | Invalid input, upstream issue |
| Duplicate message | ACK silently | Already processed |
| Transformation error | ACK + log error | Logic error, needs code fix |
| Dispatch 4xx error | ACK + log error | Client error, won't succeed on retry |
| Dispatch 5xx error | NACK | Temporary failure, retry |
| Dispatch timeout | NACK | Network issue, retry |
| Max retries exceeded | ACK + route to DLQ | Persistent failure, needs investigation |

**Idempotency Cache Interface**:
```
Key Format (Messages): "msg:{internalId}"
Key Format (Events): "evt:{sha256(wamid|status|timestamp)}"
Value: "1" (simple flag)
TTL: 86400 seconds (24 hours)

Operations:
- SET key IF NOT EXISTS with TTL
- Return: true if new, false if exists
```

**Validation Pseudo-code**:
```python
def validate_message(payload):
    if not is_valid_json(payload):
        raise InvalidJSONError()
    
    if "type" not in payload:
        raise MissingFieldError("type")
    
    if payload["type"] not in ["message", "event"]:
        raise InvalidFieldError("type", payload["type"])
    
    if "tenantId" not in payload:
        raise MissingFieldError("tenantId")
    
    if not is_uuid(payload["tenantId"]):
        raise InvalidFieldError("tenantId", "must be UUID")
    
    if "waId" not in payload:
        raise MissingFieldError("waId")
    
    if payload["type"] == "message":
        validate_message_specific(payload)
    else:
        validate_event_specific(payload)

def validate_message_specific(payload):
    required = ["internalId", "conversationId", "wamid", "timestamp"]
    for field in required:
        if field not in payload:
            raise MissingFieldError(field)
    
    if "payload" not in payload:
        raise MissingFieldError("payload")
    
    has_body = "body" in payload.get("payload", {})
    has_media = "media" in payload.get("payload", {})
    
    if not has_body and not has_media:
        raise InvalidPayloadError("Must have body or media")
    
    if has_media:
        media = payload["payload"]["media"]
        if "url" not in media or "mime_type" not in media:
            raise InvalidPayloadError("Media must have url and mime_type")

def validate_event_specific(payload):
    required = ["wamid", "status", "timestamp"]
    for field in required:
        if field not in payload:
            raise MissingFieldError(field)
    
    valid_statuses = ["sent", "delivered", "read", "failed"]
    if payload["status"] not in valid_statuses:
        raise InvalidFieldError("status", payload["status"])
```

### 6.2 Message Transformation Logic (REQ-IN-05)

**Requirement**: Transform WhatsApp payloads to Genesys Open Messaging format

#### 6.2.1 Header/Channel Mapping

**Transformation Rules**:

| Input Field | Output Field | Transformation |
|-------------|--------------|----------------|
| `internalId` | `id` | Direct copy |
| `wamid` | `channel.messageId` | Direct copy |
| `waId` | `channel.from.id` | Direct copy |
| `waId` | `channel.from.idType` | Constant: `"Phone"` |
| `contactName` | `channel.from.nickname` | Direct copy (if present) |
| `contactName` | `channel.from.firstName` | Extract first word (if present) |
| `timestamp` | `channel.time` | Convert Unix → ISO 8601 UTC |
| `tenantId` | Header: `X-Tenant-ID` | Direct copy |
| N/A | `channel.platform` | Constant: `"Open"` |
| N/A | `channel.type` | Constant: `"Private"` |
| Config | `channel.to.id` | From environment/config |

**Timestamp Conversion**:
```python
def unix_to_iso8601(unix_timestamp):
    """
    Convert Unix epoch (seconds) to ISO 8601 UTC string
    
    Input: 1700000000
    Output: "2023-11-15T03:33:20.000Z"
    """
    dt = datetime.fromtimestamp(unix_timestamp, tz=timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    
    # Important: 
    # - Always use UTC timezone
    # - Include milliseconds (3 decimal places)
    # - End with 'Z' suffix
```

**Timestamp Validation**:
```python
def validate_timestamp(timestamp):
    """
    Reject timestamps too far in the future
    Prevents clock skew issues
    """
    current_time = time.time()
    max_future_skew = 300  # 5 minutes
    
    if timestamp > current_time + max_future_skew:
        raise InvalidTimestampError(
            f"Timestamp {timestamp} is {timestamp - current_time} seconds in future"
        )
```

**Name Parsing**:
```python
def parse_first_name(contact_name):
    """
    Extract first name from contact name
    
    Examples:
    "John Doe" -> "John"
    "Mary Jane Watson" -> "Mary"
    "Alice" -> "Alice"
    "" -> None
    None -> None
    """
    if not contact_name:
        return None
    
    parts = contact_name.strip().split()
    return parts[0] if parts else None
```

#### 6.2.2 Message Body Mapping

**Decision Tree**:
```
IF payload contains "body" AND payload contains "media":
    type = "Text"
    text = body
    content = [create_attachment(media)]
    
ELSE IF payload contains "body":
    type = "Text"
    text = body
    content = [] (omit)
    
ELSE IF payload contains "media":
    type = "Text"
    text = media.caption IF exists ELSE "[Attachment]"
    content = [create_attachment(media)]
```

**Text Message Transformation**:
```python
def transform_text_message(payload):
    """Text-only message"""
    return {
        "type": "Text",
        "text": payload["body"],
        "direction": "Inbound"
    }
```

**Media Message Transformation**:
```python
def transform_media_message(payload):
    """Media with optional caption"""
    media = payload["media"]
    
    return {
        "type": "Text",
        "text": media.get("caption", "[Attachment]"),
        "content": [{
            "contentType": "Attachment",
            "attachment": {
                "url": media["url"],
                "mime": media["mime_type"]
            }
        }],
        "direction": "Inbound"
    }
```

**Combined Message Transformation**:
```python
def transform_combined_message(payload):
    """Text body with media attachment"""
    media = payload["media"]
    
    return {
        "type": "Text",
        "text": payload["body"],
        "content": [{
            "contentType": "Attachment",
            "attachment": {
                "url": media["url"],
                "mime": media["mime_type"]
            }
        }],
        "direction": "Inbound"
    }
```

#### 6.2.3 Media Type Mapping

**MIME Type to Genesys Mapping**:

| MIME Type Pattern | Genesys Type | Examples |
|------------------|--------------|----------|
| `image/*` | `Image` | image/jpeg, image/png, image/gif, image/webp |
| `video/*` | `Video` | video/mp4, video/quicktime, video/3gpp |
| `audio/*` | `Audio` | audio/mpeg, audio/ogg, audio/aac |
| `application/pdf` | `File` | PDF documents |
| `application/*` | `File` | application/zip, application/msword |
| `text/*` | `File` | text/plain, text/csv |

**Implementation**:
```python
def map_mime_to_genesys_type(mime_type):
    """
    Map MIME type to Genesys media type
    
    Args:
        mime_type: MIME type string (e.g., "image/jpeg")
        
    Returns:
        Genesys type: "Image", "Video", "Audio", or "File"
    """
    mime_lower = mime_type.lower()
    
    if mime_lower.startswith("image/"):
        return "Image"
    elif mime_lower.startswith("video/"):
        return "Video"
    elif mime_lower.startswith("audio/"):
        return "Audio"
    else:
        return "File"
```

**Media URL Validation**:
```python
def validate_media_url(url):
    """
    Validate media URL for security
    
    Requirements:
    1. Must use HTTPS
    2. Must not resolve to private IP ranges
    3. Must be well-formed URL
    """
    from urllib.parse import urlparse
    import ipaddress
    
    parsed = urlparse(url)
    
    # Check protocol
    if parsed.scheme != "https":
        raise InvalidMediaURLError("URL must use HTTPS")
    
    # Check hostname exists
    if not parsed.hostname:
        raise InvalidMediaURLError("URL must have valid hostname")
    
    # Check for private IP ranges
    try:
        ip = ipaddress.ip_address(parsed.hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            raise InvalidMediaURLError("URL resolves to private IP")
    except ValueError:
        # Not an IP address, it's a hostname - OK
        pass
    
    # Additional checks for common internal hostnames
    internal_keywords = ["localhost", "internal", "local", "127.0.0.1", "0.0.0.0"]
    hostname_lower = parsed.hostname.lower()
    for keyword in internal_keywords:
        if keyword in hostname_lower:
            raise InvalidMediaURLError(f"URL contains internal keyword: {keyword}")
    
    return True
```

### 6.3 Status Event Transformation (REQ-STATE-05)

**Requirement**: Transform WhatsApp status events to Genesys receipt events

**Transformation Logic**:
```python
def transform_status_event(payload, config):
    """
    Transform WhatsApp status to Genesys receipt
    
    Args:
        payload: Input event payload
        config: Service configuration
        
    Returns:
        Genesys receipt event or None (if ignored)
    """
    status = payload["status"]
    
    # Check if status should be ignored
    if status == "sent" and config.get("IGNORE_SENT_STATUS", True):
        return None  # Skip processing
    
    # Map status
    genesys_status = map_status(status)
    
    # Build receipt event
    receipt = {
        "id": generate_uuid(),  # Generate new UUID for event
        "channel": {
            "platform": "Open",
            "type": "Private",
            "messageId": payload["wamid"],
            "to": {
                "id": config["INTEGRATION_ID"]
            },
            "from": {
                "id": payload["waId"],
                "idType": "Phone"
            },
            "time": unix_to_iso8601(payload["timestamp"])
        },
        "type": "Receipt",
        "status": genesys_status,
        "direction": "Outbound"  # Always Outbound for receipts
    }
    
    # Add reason for failed status
    if status == "failed" and "reason" in payload:
        receipt["reason"] = payload["reason"]
    
    return receipt

def map_status(whatsapp_status):
    """Map WhatsApp status to Genesys status"""
    mapping = {
        "sent": "Published",
        "delivered": "Delivered",
        "read": "Read",
        "failed": "Failed"
    }
    return mapping.get(whatsapp_status, "Failed")
```

**Configuration**:
```bash
# Environment variable to control "sent" status processing
IGNORE_SENT_STATUS=true   # Default: ignore "sent" events
IGNORE_SENT_STATUS=false  # Process all status events
```

**Status Processing Matrix**:

| WhatsApp Status | Genesys Status | Default Action | Configuration |
|----------------|----------------|----------------|---------------|
| `sent` | `Published` | **IGNORE** | `IGNORE_SENT_STATUS=true` |
| `delivered` | `Delivered` | Process | N/A |
| `read` | `Read` | Process | N/A |
| `failed` | `Failed` | Process + include reason | N/A |

**Rationale for Ignoring "sent"**:
- Creates excessive event volume
- Minimal business value (intermediate state)
- Genesys primarily cares about delivered/read
- Can be enabled for debugging/audit purposes

### 6.4 Dispatch to Genesys API (REQ-IN-08)

**Requirement**: Send transformed payloads to Genesys API Service with retry logic

#### 6.4.1 Endpoint Configuration

**Message Endpoint**:
```
POST /genesys/messages/inbound
Host: genesys-api-service.internal:8080
```

**Event Endpoint**:
```
POST /genesys/events/inbound
Host: genesys-api-service.internal:8080
```

**Base URL Configuration**:
```bash
GENESYS_API_BASE_URL=http://genesys-api-service.internal:8080
# or
GENESYS_API_BASE_URL=https://genesys-api.example.com
```

#### 6.4.2 Request Construction

```python
def dispatch_message(message, config):
    """
    Dispatch message to Genesys API Service
    
    Args:
        message: Transformed Genesys message payload
        config: Service configuration
        
    Returns:
        HTTP response
    """
    url = f"{config['GENESYS_API_BASE_URL']}/genesys/messages/inbound"
    
    headers = {
        "Authorization": f"Bearer {config['SERVICE_TOKEN']}",
        "Content-Type": "application/json",
        "X-Tenant-ID": message["tenantId"],  # From original payload
        "X-Correlation-ID": message["id"],
        "X-Message-Source": "inbound-transformer"
    }
    
    timeout = config.get("HTTP_TIMEOUT", 10)  # 10 seconds default
    
    response = http_client.post(
        url,
        json=message,
        headers=headers,
        timeout=timeout
    )
    
    return response

def dispatch_event(event, config):
    """
    Dispatch event to Genesys API Service
    
    Args:
        event: Transformed Genesys receipt event
        config: Service configuration
        
    Returns:
        HTTP response
    """
    url = f"{config['GENESYS_API_BASE_URL']}/genesys/events/inbound"
    
    headers = {
        "Authorization": f"Bearer {config['SERVICE_TOKEN']}",
        "Content-Type": "application/json",
        "X-Tenant-ID": event["tenantId"],  # From original payload
        "X-Correlation-ID": event["id"],
        "X-Message-Source": "inbound-transformer"
    }
    
    timeout = config.get("HTTP_TIMEOUT", 10)
    
    response = http_client.post(
        url,
        json=event,
        headers=headers,
        timeout=timeout
    )
    
    return response
```

#### 6.4.3 Response Handling

**HTTP Status Code Handling Matrix**:

| Status Code | Category | Action | Reason |
|-------------|----------|--------|--------|
| 200-299 | Success | ACK message | Request succeeded |
| 400 | Bad Request | ACK + log error | Invalid payload, won't fix with retry |
| 401 | Unauthorized | NACK + alert | Auth issue, needs investigation |
| 403 | Forbidden | ACK + log error | Permission issue, won't fix with retry |
| 404 | Not Found | ACK + log error | Endpoint/resource not found |
| 408 | Timeout | NACK | Server timeout, retry |
| 429 | Rate Limit | NACK | Throttled, retry with backoff |
| 500-599 | Server Error | NACK | Temporary failure, retry |
| Timeout | Network | NACK | Connection timeout, retry |
| Connection Error | Network | NACK | Connection failed, retry |

**Implementation**:
```python
def handle_response(response, original_message):
    """
    Handle HTTP response and determine action
    
    Returns:
        action: "ACK", "NACK", or "DLQ"
        retry: boolean
    """
    status = response.status_code
    
    if 200 <= status < 300:
        log_success(original_message, response)
        return "ACK", False
    
    elif 400 <= status < 500:
        # Client errors - don't retry
        if status == 401:
            # Auth error - alert but don't retry
            log_auth_error(original_message, response)
            alert("Authentication failure in Genesys dispatch")
            return "NACK", True  # Retry in case token refresh resolves it
        else:
            # Other 4xx - permanent failure
            log_client_error(original_message, response)
            return "ACK", False
    
    elif 500 <= status < 600:
        # Server errors - retry
        log_server_error(original_message, response)
        return "NACK", True
    
    else:
        # Unexpected status
        log_unexpected_response(original_message, response)
        return "NACK", True

def handle_exception(exception, original_message):
    """Handle network exceptions"""
    if isinstance(exception, TimeoutError):
        log_timeout(original_message, exception)
        return "NACK", True
    
    elif isinstance(exception, ConnectionError):
        log_connection_error(original_message, exception)
        return "NACK", True
    
    else:
        log_unexpected_error(original_message, exception)
        return "NACK", True
```

#### 6.4.4 Retry Strategy

**Exponential Backoff with Jitter**:
```python
import random
import time

def calculate_backoff(attempt):
    """
    Calculate backoff delay for retry attempt
    
    Args:
        attempt: Retry attempt number (1-indexed)
        
    Returns:
        Delay in seconds
    """
    base_delay = 1.0  # 1 second
    max_delay = 32.0  # 32 seconds
    
    # Exponential: 1, 2, 4, 8, 16, 32
    delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
    
    # Add jitter: ±0-1000ms
    jitter = random.uniform(0, 1.0)
    
    return delay + jitter

# Retry schedule:
# Attempt 1: 0 seconds (immediate)
# Attempt 2: 1-2 seconds
# Attempt 3: 2-3 seconds
# Attempt 4: 4-5 seconds
# Attempt 5: 8-9 seconds
# After 5: Route to DLQ
```

**Retry Loop**:
```python
def process_with_retry(message, config):
    """
    Process message with retry logic
    
    Args:
        message: RabbitMQ message
        config: Service configuration
        
    Returns:
        success: boolean
    """
    max_attempts = config.get("MAX_RETRY_ATTEMPTS", 5)
    
    for attempt in range(1, max_attempts + 1):
        try:
            # Transform payload
            transformed = transform_payload(message.body, config)
            
            if transformed is None:
                # Ignored (e.g., "sent" status)
                return True
            
            # Dispatch
            response = dispatch(transformed, config)
            
            # Handle response
            action, should_retry = handle_response(response, message)
            
            if action == "ACK":
                return True
            
            if not should_retry:
                # Permanent failure
                route_to_dlq(message, "Permanent failure")
                return False
            
            # Retry
            if attempt < max_attempts:
                delay = calculate_backoff(attempt)
                log_retry(message, attempt, delay)
                time.sleep(delay)
            
        except Exception as e:
            action, should_retry = handle_exception(e, message)
            
            if not should_retry:
                route_to_dlq(message, f"Exception: {e}")
                return False
            
            if attempt < max_attempts:
                delay = calculate_backoff(attempt)
                log_retry(message, attempt, delay)
                time.sleep(delay)
    
    # Max retries exceeded
    route_to_dlq(message, "Max retries exceeded")
    return False
```

**RabbitMQ Integration**:
```python
def acknowledge_message(message, action):
    """
    Acknowledge or reject message
    
    Args:
        message: RabbitMQ message
        action: "ACK" or "NACK"
    """
    if action == "ACK":
        message.ack()  # Remove from queue
    else:
        message.nack(requeue=True)  # Return to queue for retry
```

### 6.5 Idempotency Implementation (REQ-IN-06)

**Requirement**: Ensure duplicate messages/events are not processed multiple times

#### 6.5.1 Key Generation

**For Messages**:
```python
def get_message_idempotency_key(payload):
    """
    Generate idempotency key for messages
    
    Args:
        payload: Input message payload
        
    Returns:
        Redis key string
    """
    internal_id = payload["internalId"]
    return f"inbound-transformer:dedup:msg:{internal_id}"
```

**For Events**:
```python
import hashlib

def get_event_idempotency_key(payload):
    """
    Generate idempotency key for events
    
    Uses composite key to handle same message with different statuses
    
    Args:
        payload: Input event payload
        
    Returns:
        Redis key string
    """
    wamid = payload["wamid"]
    status = payload["status"]
    timestamp = payload["timestamp"]
    
    # Create composite key
    composite = f"{wamid}|{status}|{timestamp}"
    
    # Hash for fixed-length key
    hash_value = hashlib.sha256(composite.encode()).hexdigest()
    
    return f"inbound-transformer:dedup:evt:{hash_value}"
```

#### 6.5.2 Cache Interface

**Redis Implementation**:
```python
import redis

class RedisIdempotencyCache:
    def __init__(self, redis_url, ttl=86400):
        """
        Initialize Redis cache
        
        Args:
            redis_url: Redis connection string
            ttl: Time to live in seconds (default 24 hours)
        """
        self.client = redis.from_url(redis_url)
        self.ttl = ttl
    
    def is_duplicate(self, key):
        """
        Check if key exists (message already processed)
        
        Args:
            key: Idempotency key
            
        Returns:
            True if duplicate, False if new
        """
        # SET if not exists, with TTL
        result = self.client.set(key, "1", ex=self.ttl, nx=True)
        
        # nx=True returns None if key already existed
        return result is None
    
    def mark_processed(self, key):
        """
        Mark message as processed (for manual control)
        
        Args:
            key: Idempotency key
        """
        self.client.setex(key, self.ttl, "1")
```

**In-Memory LRU Implementation** (for testing or single-instance):
```python
from collections import OrderedDict
import time

class LRUIdempotencyCache:
    def __init__(self, max_size=10000, ttl=86400):
        """
        Initialize in-memory LRU cache
        
        Args:
            max_size: Maximum number of keys to store
            ttl: Time to live in seconds
        """
        self.cache = OrderedDict()
        self.max_size = max_size
        self.ttl = ttl
    
    def is_duplicate(self, key):
        """
        Check if key exists
        
        Args:
            key: Idempotency key
            
        Returns:
            True if duplicate, False if new
        """
        # Clean expired entries
        self._clean_expired()
        
        # Check if key exists
        if key in self.cache:
            # Move to end (mark as recently used)
            self.cache.move_to_end(key)
            return True
        
        # Add new key
        expiry = time.time() + self.ttl
        self.cache[key] = expiry
        
        # Evict oldest if over size limit
        if len(self.cache) > self.max_size:
            self.cache.popitem(last=False)
        
        return False
    
    def _clean_expired(self):
        """Remove expired entries"""
        current_time = time.time()
        expired_keys = [
            k for k, expiry in self.cache.items()
            if expiry < current_time
        ]
        for k in expired_keys:
            del self.cache[k]
```

#### 6.5.3 Integration with Processing Flow

```python
def process_message(message, cache, config):
    """
    Process message with idempotency check
    
    Args:
        message: RabbitMQ message
        cache: Idempotency cache instance
        config: Service configuration
        
    Returns:
        success: boolean
    """
    try:
        # Parse payload
        payload = json.loads(message.body)
        
        # Validate
        validate_payload(payload)
        
        # Generate idempotency key
        if payload["type"] == "message":
            key = get_message_idempotency_key(payload)
        else:
            key = get_event_idempotency_key(payload)
        
        # Check for duplicate
        if cache.is_duplicate(key):
            log_duplicate(payload, key)
            metrics.increment("messages_duplicate_total")
            return True  # ACK silently
        
        # Transform and dispatch
        transformed = transform_payload(payload, config)
        
        if transformed is None:
            # Ignored (e.g., "sent" status)
            return True
        
        response = dispatch(transformed, config)
        
        # Handle response
        action, should_retry = handle_response(response, message)
        
        if action == "ACK":
            metrics.increment("messages_processed_total")
            return True
        else:
            # Will retry - don't mark as processed yet
            return False
        
    except Exception as e:
        log_error(message, e)
        metrics.increment("transformation_failures_total")
        # ACK to avoid infinite retries on transformation errors
        return True
```

### 6.6 Dead Letter Queue Handling

**Requirement**: Route persistently failed messages to DLQ for investigation

#### 6.6.1 RabbitMQ DLQ Configuration

**Exchange and Queue Setup**:
```
Exchange: inbound-transformer-dlq-exchange
Type: fanout

Queue: inbound-transformer-dlq
Durable: true
```

**Message Properties for DLQ**:
```python
def route_to_dlq(original_message, failure_reason):
    """
    Route message to dead letter queue
    
    Args:
        original_message: Original RabbitMQ message
        failure_reason: Human-readable failure reason
    """
    dlq_message = {
        "original_payload": original_message.body,
        "failure_reason": failure_reason,
        "failure_timestamp": int(time.time()),
        "retry_count": original_message.delivery_info.get("x-delivery-count", 0),
        "original_queue": "inbound-processed",
        "service": "inbound-transformer"
    }
    
    rabbitmq_channel.basic_publish(
        exchange="inbound-transformer-dlq-exchange",
        routing_key="",
        body=json.dumps(dlq_message),
        properties=pika.BasicProperties(
            delivery_mode=2,  # Persistent
            content_type="application/json"
        )
    )
    
    # Acknowledge original message
    original_message.ack()
    
    # Alert
    metrics.increment("messages_dlq_total")
    log_dlq(original_message, failure_reason)
```

#### 6.6.2 DLQ Monitoring

**Alert Conditions**:
```
Alert: "Inbound Transformer DLQ Activity"
Condition: messages_dlq_total > 0 in last 5 minutes
Severity: Warning

Alert: "Inbound Transformer High DLQ Rate"
Condition: messages_dlq_total > 10 in last 5 minutes
Severity: Critical
```

**DLQ Processing**:
```
DLQ messages should be:
1. Logged with full context
2. Stored for investigation
3. Reviewed regularly
4. Optionally replayed after fixes
```

---

## Non-Functional Requirements

### 7.1 Performance Requirements

**Throughput Targets**:
- **Minimum**: 50 messages/second per instance
- **Target**: 300 messages/second per instance
- **Peak**: 500 messages/second per instance (burst)

**Latency Targets**:
- **Transformation Logic**: < 5ms (p99)
- **End-to-End Processing**: < 100ms (p99, excluding Genesys API latency)
- **Idempotency Check**: < 2ms (p99)

**Resource Limits**:
```
CPU: 0.5-2.0 cores per instance
Memory: 256MB-1GB per instance
Network: 10Mbps per instance
```

**Scaling Strategy**:
- Horizontal scaling (add more instances)
- No vertical scaling needed
- Stateless design enables easy scaling
- Load balancing via RabbitMQ consumer count

### 7.2 Availability Requirements

**Uptime Target**: 99.9% (three nines)

**High Availability Design**:
- Multiple service instances (min 2)
- No single point of failure
- Graceful degradation
- Circuit breaker for downstream services

**Failure Modes**:
```
RabbitMQ unavailable: Service waits and retries connection
Genesys API unavailable: Messages retry with backoff, eventually DLQ
Redis unavailable: Fall back to in-memory cache (warning logged)
```

### 7.3 Reliability Requirements

**Message Delivery Guarantees**:
- **At-least-once**: Messages may be reprocessed on failure
- **Idempotent**: Reprocessing is safe
- **Ordered**: Not guaranteed (stateless design)

**Data Consistency**:
- Idempotency prevents duplicates
- State Manager ensures upstream consistency
- Genesys API Service handles downstream deduplication

**Failure Recovery**:
```
Service crash: Messages remain in RabbitMQ, reprocessed on restart
Network partition: Messages retry until success or DLQ
Downstream failure: Exponential backoff prevents overload
```

### 7.4 Statelessness

**No Persistent Storage**:
- No database connections
- No file system writes (except logs)
- No shared memory between instances

**Cache Usage**:
- Redis for idempotency (external, shared)
- In-memory LRU as fallback
- Cache misses are safe (reprocess once)

**Configuration**:
- All config from environment variables
- No config files required
- Secrets via environment or secrets manager

---

## Error Handling & Resilience

### 8.1 Error Categories

**Transient Errors** (Retry):
- Network timeouts
- 5xx HTTP responses
- Connection failures
- Rate limiting (429)
- Temporary auth failures

**Permanent Errors** (Don't Retry):
- Invalid JSON
- Missing required fields
- 4xx HTTP responses (except 429)
- Transformation logic errors
- Invalid data types

**Undefined Errors** (Retry Cautiously):
- Unexpected exceptions
- Unknown HTTP status codes
- Parsing errors

### 8.2 Circuit Breaker Pattern

**Implementation**:
```python
class CircuitBreaker:
    """
    Circuit breaker for Genesys API calls
    
    States:
    - CLOSED: Normal operation
    - OPEN: Block requests, fail fast
    - HALF_OPEN: Allow test request
    """
    
    def __init__(self, failure_threshold=5, timeout=60):
        """
        Args:
            failure_threshold: Failures before opening circuit
            timeout: Seconds before attempting recovery
        """
        self.state = "CLOSED"
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.last_failure_time = None
    
    def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        
        if self.state == "OPEN":
            # Check if timeout expired
            if time.time() - self.last_failure_time > self.timeout:
                self.state = "HALF_OPEN"
                log_info("Circuit breaker entering HALF_OPEN state")
            else:
                raise CircuitBreakerOpenError("Circuit breaker is OPEN")
        
        try:
            result = func(*args, **kwargs)
            
            # Success - reset
            if self.state == "HALF_OPEN":
                self.state = "CLOSED"
                self.failure_count = 0
                log_info("Circuit breaker CLOSED (recovered)")
            
            return result
            
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()
            
            if self.failure_count >= self.failure_threshold:
                self.state = "OPEN"
                log_error(f"Circuit breaker OPEN after {self.failure_count} failures")
            
            raise e

# Usage
circuit_breaker = CircuitBreaker(failure_threshold=5, timeout=60)

try:
    response = circuit_breaker.call(dispatch_to_genesys, message, config)
except CircuitBreakerOpenError:
    # Fail fast, NACK message for later retry
    return "NACK", True
```

### 8.3 Graceful Degradation

**Degradation Scenarios**:

1. **Redis Unavailable**:
   ```python
   try:
       is_dup = redis_cache.is_duplicate(key)
   except RedisConnectionError:
       log_warning("Redis unavailable, using in-memory cache")
       is_dup = memory_cache.is_duplicate(key)
       metrics.increment("redis_fallback_total")
   ```

2. **High Latency**:
   ```python
   if response_time > threshold:
       log_warning(f"High latency detected: {response_time}ms")
       metrics.increment("high_latency_total")
       # Continue processing, but alert
   ```

3. **Rate Limiting**:
   ```python
   if response.status_code == 429:
       retry_after = response.headers.get("Retry-After", 60)
       log_info(f"Rate limited, backing off for {retry_after}s")
       time.sleep(retry_after)
       # Retry once, then NACK for later
   ```

### 8.4 Timeout Configuration

**HTTP Client Timeouts**:
```python
HTTP_CONNECT_TIMEOUT = 5  # seconds
HTTP_READ_TIMEOUT = 10     # seconds
HTTP_TOTAL_TIMEOUT = 15    # seconds

http_client = HttpClient(
    connect_timeout=HTTP_CONNECT_TIMEOUT,
    read_timeout=HTTP_READ_TIMEOUT,
    total_timeout=HTTP_TOTAL_TIMEOUT
)
```

**RabbitMQ Timeouts**:
```python
RABBITMQ_CONNECTION_TIMEOUT = 10  # seconds
RABBITMQ_HEARTBEAT = 30           # seconds
```

---

## Security Requirements

### 9.1 Authentication & Authorization

**Service Token**:
```bash
# Environment variable
SERVICE_TOKEN=<jwt-token-or-api-key>

# Used in Authorization header
Authorization: Bearer ${SERVICE_TOKEN}
```

**Token Management**:
- Rotate tokens regularly (90 days)
- Never log token values
- Use secrets manager for storage
- Validate token on startup

### 9.2 Input Validation

**Required Validations**:

1. **JSON Structure**: Well-formed JSON
2. **Required Fields**: All mandatory fields present
3. **Field Types**: Correct data types
4. **Field Lengths**: Within limits
5. **URL Safety**: HTTPS only, no private IPs
6. **Phone Format**: Valid E.164 format
7. **UUID Format**: Valid UUID v4
8. **Timestamp Range**: Not too far in future

**Security Boundaries**:
```python
MAX_BODY_LENGTH = 4096     # characters
MAX_CAPTION_LENGTH = 1024  # characters
MAX_NAME_LENGTH = 256      # characters
MAX_REASON_LENGTH = 512    # characters
MAX_PAYLOAD_SIZE = 2 * 1024 * 1024  # 2MB
```

### 9.3 URL Validation

**Security Checks**:
```python
def validate_url_security(url):
    """
    Comprehensive URL security validation
    
    Prevents:
    - Non-HTTPS URLs
    - Private IP ranges
    - Localhost access
    - Internal hostnames
    - SSRF attacks
    """
    parsed = urlparse(url)
    
    # 1. Protocol check
    if parsed.scheme != "https":
        raise SecurityError("URL must use HTTPS protocol")
    
    # 2. Hostname required
    if not parsed.hostname:
        raise SecurityError("URL must have valid hostname")
    
    # 3. Check for IP addresses
    try:
        ip = ipaddress.ip_address(parsed.hostname)
        
        # Block private ranges
        if ip.is_private:
            raise SecurityError("Private IP ranges not allowed")
        
        # Block loopback
        if ip.is_loopback:
            raise SecurityError("Loopback addresses not allowed")
        
        # Block link-local
        if ip.is_link_local:
            raise SecurityError("Link-local addresses not allowed")
        
        # Block multicast
        if ip.is_multicast:
            raise SecurityError("Multicast addresses not allowed")
        
    except ValueError:
        # Not an IP address, continue with hostname checks
        pass
    
    # 4. Block internal keywords
    hostname_lower = parsed.hostname.lower()
    blocked_keywords = [
        "localhost", "local", "internal", "corp",
        "127.0.0.1", "0.0.0.0", "::1"
    ]
    
    for keyword in blocked_keywords:
        if keyword in hostname_lower:
            raise SecurityError(f"Blocked hostname keyword: {keyword}")
    
    # 5. Block metadata endpoints
    if hostname_lower.startswith("169.254."):
        raise SecurityError("AWS metadata endpoint blocked")
    
    return True
```

### 9.4 Secret Management

**Never Log Secrets**:
```python
def sanitize_log_payload(payload):
    """
    Remove sensitive fields from logs
    
    Fields to redact:
    - Authorization headers
    - Service tokens
    - API keys
    - Possibly phone numbers (PII)
    """
    sanitized = payload.copy()
    
    # Redact headers
    if "headers" in sanitized:
        if "Authorization" in sanitized["headers"]:
            sanitized["headers"]["Authorization"] = "[REDACTED]"
    
    # Optionally redact phone numbers
    if "waId" in sanitized:
        sanitized["waId"] = sanitized["waId"][:3] + "****" + sanitized["waId"][-2:]
    
    return sanitized
```

**Environment Variables**:
```bash
# Required secrets
SERVICE_TOKEN=<secret>
REDIS_PASSWORD=<secret>

# Optional secrets
GENESYS_API_KEY=<secret>
```

---

## Observability & Monitoring

### 10.1 Structured Logging

**Log Format**:
```json
{
  "timestamp": "2023-11-15T03:33:20.123Z",
  "level": "INFO",
  "service": "inbound-transformer",
  "message": "Message processed successfully",
  "tenantId": "uuid-tenant-1111",
  "correlationId": "uuid-1234-5678",
  "messageType": "message",
  "wamid": "wamid.HBg...",
  "processingTimeMs": 45,
  "genesysStatus": 200
}
```

**Log Levels**:
- **DEBUG**: Detailed transformation steps (disabled in production)
- **INFO**: Successful processing, normal operations
- **WARN**: Degraded mode, fallbacks, high latency
- **ERROR**: Processing failures, exceptions
- **CRITICAL**: Service-level failures, DLQ routing

**Key Log Events**:

1. **Message Received**:
   ```json
   {
     "level": "INFO",
     "message": "Message received from queue",
     "messageType": "message",
     "tenantId": "uuid-tenant-1111",
     "correlationId": "uuid-1234"
   }
   ```

2. **Duplicate Detected**:
   ```json
   {
     "level": "INFO",
     "message": "Duplicate message detected",
     "correlationId": "uuid-1234",
     "idempotencyKey": "inbound-transformer:dedup:msg:uuid-1234"
   }
   ```

3. **Transformation Complete**:
   ```json
   {
     "level": "DEBUG",
     "message": "Payload transformed",
     "correlationId": "uuid-1234",
     "inputType": "message",
     "outputType": "Text",
     "hasMedia": true
   }
   ```

4. **Dispatch Success**:
   ```json
   {
     "level": "INFO",
     "message": "Message dispatched successfully",
     "correlationId": "uuid-1234",
     "endpoint": "/genesys/messages/inbound",
     "statusCode": 200,
     "latencyMs": 45
   }
   ```

5. **Dispatch Failure**:
   ```json
   {
     "level": "ERROR",
     "message": "Failed to dispatch message",
     "correlationId": "uuid-1234",
     "endpoint": "/genesys/messages/inbound",
     "statusCode": 500,
     "error": "Internal Server Error",
     "attempt": 3,
     "willRetry": true
   }
   ```

6. **DLQ Routing**:
   ```json
   {
     "level": "ERROR",
     "message": "Message routed to DLQ",
     "correlationId": "uuid-1234",
     "reason": "Max retries exceeded",
     "retryCount": 5,
     "originalPayload": "..."
   }
   ```

### 10.2 Metrics

**Prometheus Metrics**:

```python
# Counter metrics
messages_received_total = Counter(
    "messages_received_total",
    "Total messages received from queue",
    ["tenant_id", "message_type"]
)

messages_processed_total = Counter(
    "messages_processed_total",
    "Total messages successfully processed",
    ["tenant_id", "message_type"]
)

messages_duplicate_total = Counter(
    "messages_duplicate_total",
    "Total duplicate messages detected",
    ["tenant_id", "message_type"]
)

transformation_failures_total = Counter(
    "transformation_failures_total",
    "Total transformation failures",
    ["tenant_id", "error_type"]
)

genesys_dispatch_failures_total = Counter(
    "genesys_dispatch_failures_total",
    "Total Genesys API dispatch failures",
    ["tenant_id", "status_code"]
)

messages_dlq_total = Counter(
    "messages_dlq_total",
    "Total messages routed to DLQ",
    ["tenant_id", "failure_reason"]
)

redis_fallback_total = Counter(
    "redis_fallback_total",
    "Total Redis fallback to in-memory cache"
)

# Histogram metrics
processing_latency_seconds = Histogram(
    "processing_latency_seconds",
    "End-to-end processing latency",
    ["tenant_id", "message_type"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0]
)

transformation_duration_seconds = Histogram(
    "transformation_duration_seconds",
    "Transformation logic duration",
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1]
)

genesys_dispatch_duration_seconds = Histogram(
    "genesys_dispatch_duration_seconds",
    "Genesys API dispatch duration",
    ["status_code"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0]
)

idempotency_check_duration_seconds = Histogram(
    "idempotency_check_duration_seconds",
    "Idempotency cache check duration",
    buckets=[0.001, 0.002, 0.005, 0.01, 0.05]
)

# Gauge metrics
rabbitmq_queue_depth = Gauge(
    "rabbitmq_queue_depth",
    "Current message count in queue"
)

circuit_breaker_state = Gauge(
    "circuit_breaker_state",
    "Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)"
)
```

**Metrics Usage**:
```python
def process_message_with_metrics(message, config):
    """Process message with metrics collection"""
    
    start_time = time.time()
    tenant_id = message.get("tenantId", "unknown")
    message_type = message.get("type", "unknown")
    
    # Increment received counter
    messages_received_total.labels(
        tenant_id=tenant_id,
        message_type=message_type
    ).inc()
    
    try:
        # Check idempotency
        idempotency_start = time.time()
        is_duplicate = check_idempotency(message)
        idempotency_check_duration_seconds.observe(
            time.time() - idempotency_start
        )
        
        if is_duplicate:
            messages_duplicate_total.labels(
                tenant_id=tenant_id,
                message_type=message_type
            ).inc()
            return
        
        # Transform
        transform_start = time.time()
        transformed = transform_payload(message, config)
        transformation_duration_seconds.observe(
            time.time() - transform_start
        )
        
        # Dispatch
        dispatch_start = time.time()
        response = dispatch_to_genesys(transformed, config)
        genesys_dispatch_duration_seconds.labels(
            status_code=response.status_code
        ).observe(time.time() - dispatch_start)
        
        if 200 <= response.status_code < 300:
            messages_processed_total.labels(
                tenant_id=tenant_id,
                message_type=message_type
            ).inc()
        else:
            genesys_dispatch_failures_total.labels(
                tenant_id=tenant_id,
                status_code=response.status_code
            ).inc()
        
    except Exception as e:
        transformation_failures_total.labels(
            tenant_id=tenant_id,
            error_type=type(e).__name__
        ).inc()
        raise
    
    finally:
        # Record total latency
        processing_latency_seconds.labels(
            tenant_id=tenant_id,
            message_type=message_type
        ).observe(time.time() - start_time)
```

### 10.3 Health Checks

**Liveness Probe**:
```python
@app.route("/health/live")
def liveness():
    """
    Liveness check - is the service running?
    
    Returns 200 if service is alive
    """
    return {"status": "alive"}, 200
```

**Readiness Probe**:
```python
@app.route("/health/ready")
def readiness():
    """
    Readiness check - is the service ready to process messages?
    
    Checks:
    - RabbitMQ connection
    - Genesys API reachability
    - Redis connection (if configured)
    
    Returns 200 if ready, 503 if not
    """
    checks = {}
    
    # Check RabbitMQ
    try:
        rabbitmq_channel.queue_declare(
            queue="inbound-processed",
            passive=True
        )
        checks["rabbitmq"] = "OK"
    except Exception as e:
        checks["rabbitmq"] = f"FAILED: {e}"
        return {"status": "not ready", "checks": checks}, 503
    
    # Check Genesys API
    try:
        response = requests.get(
            f"{config['GENESYS_API_BASE_URL']}/health",
            timeout=2
        )
        if response.status_code == 200:
            checks["genesys_api"] = "OK"
        else:
            checks["genesys_api"] = f"FAILED: {response.status_code}"
            return {"status": "not ready", "checks": checks}, 503
    except Exception as e:
        checks["genesys_api"] = f"FAILED: {e}"
        return {"status": "not ready", "checks": checks}, 503
    
    # Check Redis (optional)
    if config.get("REDIS_URL"):
        try:
            redis_client.ping()
            checks["redis"] = "OK"
        except Exception as e:
            checks["redis"] = f"DEGRADED: {e}"
            # Don't fail readiness - Redis is optional
    
    return {"status": "ready", "checks": checks}, 200
```

### 10.4 Distributed Tracing

**Correlation ID Propagation**:
```python
def propagate_correlation_id(original_message):
    """
    Propagate correlation ID through system
    
    Flow:
    1. Extract from input message (internalId)
    2. Include in all logs
    3. Pass to Genesys API (X-Correlation-ID header)
    4. Include in metrics labels
    """
    correlation_id = original_message.get("internalId") or str(uuid.uuid4())
    
    # Set in thread-local context
    context.correlation_id = correlation_id
    
    return correlation_id

def log_with_correlation(level, message, **kwargs):
    """Log with correlation ID"""
    correlation_id = getattr(context, "correlation_id", None)
    
    log_data = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "level": level,
        "service": "inbound-transformer",
        "message": message,
        "correlationId": correlation_id,
        **kwargs
    }
    
    print(json.dumps(log_data))
```

---

## Testing Requirements

### 11.1 Unit Tests

**Test Coverage Goals**: >80% code coverage

**Key Test Scenarios**:

1. **Transformation Tests**:
   ```python
   def test_transform_text_message():
       input_payload = {
           "type": "message",
           "internalId": "uuid-1234",
           "tenantId": "uuid-5678",
           "waId": "919876543210",
           "conversationId": "conv-999",
           "wamid": "wamid.HBg...",
           "contactName": "John Doe",
           "timestamp": 1700000000,
           "payload": {
               "body": "Hello World"
           }
       }
       
       result = transform_message(input_payload, config)
       
       assert result["type"] == "Text"
       assert result["text"] == "Hello World"
       assert result["channel"]["from"]["id"] == "919876543210"
       assert result["channel"]["from"]["nickname"] == "John Doe"
       assert result["channel"]["from"]["firstName"] == "John"
   
   def test_transform_media_message():
       # Test media-only message
       # Test text + media
       # Test caption fallback
       pass
   
   def test_transform_status_event():
       # Test each status type
       # Test ignored "sent" status
       # Test failed with reason
       pass
   ```

2. **Validation Tests**:
   ```python
   def test_validate_missing_required_field():
       invalid_payload = {"type": "message"}
       
       with pytest.raises(MissingFieldError):
           validate_payload(invalid_payload)
   
   def test_validate_invalid_timestamp():
       # Test future timestamp
       # Test negative timestamp
       pass
   
   def test_validate_media_url():
       # Test HTTPS requirement
       # Test private IP rejection
       # Test localhost rejection
       pass
   ```

3. **Idempotency Tests**:
   ```python
   def test_idempotency_key_generation():
       message = {"internalId": "uuid-1234", "type": "message"}
       key = get_message_idempotency_key(message)
       
       assert key == "inbound-transformer:dedup:msg:uuid-1234"
   
   def test_duplicate_detection():
       cache = LRUIdempotencyCache()
       key = "test-key"
       
       assert not cache.is_duplicate(key)  # First time
       assert cache.is_duplicate(key)      # Second time (duplicate)
   ```

4. **Retry Logic Tests**:
   ```python
   def test_exponential_backoff():
       assert calculate_backoff(1) >= 1.0
       assert calculate_backoff(2) >= 2.0
       assert calculate_backoff(5) >= 16.0
   
   def test_retry_on_5xx():
       # Mock 500 response
       # Verify NACK
       # Verify retry
       pass
   
   def test_no_retry_on_4xx():
       # Mock 400 response
       # Verify ACK
       # Verify no retry
       pass
   ```

### 11.2 Integration Tests

**Test Scenarios**:

1. **End-to-End Flow**:
   ```python
   def test_e2e_message_processing():
       # 1. Publish message to RabbitMQ
       # 2. Service consumes and processes
       # 3. Verify call to Genesys API
       # 4. Verify message acknowledged
       pass
   ```

2. **Failure Recovery**:
   ```python
   def test_retry_after_genesys_failure():
       # 1. Mock Genesys API to return 500
       # 2. Publish message
       # 3. Verify retries with backoff
       # 4. Mock API to return 200
       # 5. Verify eventual success
       pass
   
   def test_dlq_after_max_retries():
       # 1. Mock Genesys API to always return 500
       # 2. Publish message
       # 3. Verify max retries
       # 4. Verify DLQ routing
       pass
   ```

3. **Idempotency**:
   ```python
   def test_duplicate_message_handling():
       # 1. Publish message twice
       # 2. Verify processed only once
       # 3. Verify second one ACKed without processing
       pass
   ```

### 11.3 Performance Tests

**Load Testing**:
```python
def test_throughput():
    """
    Test: Service can handle 300 msg/sec
    
    Setup:
    - Start service with 2 instances
    - Publish 30,000 messages to queue
    - Measure processing time
    
    Assert:
    - All messages processed within 100 seconds
    - p99 latency < 100ms
    - No message loss
    """
    pass

def test_latency_under_load():
    """
    Test: Latency remains acceptable under load
    
    Setup:
    - Sustained load of 200 msg/sec
    - Run for 10 minutes
    
    Assert:
    - p50 latency < 50ms
    - p99 latency < 100ms
    - No DLQ messages
    """
    pass
```

### 11.4 Chaos Testing

**Failure Injection**:
```python
def test_rabbitmq_connection_loss():
    """
    Test: Service handles RabbitMQ reconnection
    
    1. Start service
    2. Kill RabbitMQ connection
    3. Wait 10 seconds
    4. Restore connection
    5. Verify service recovers
    """
    pass

def test_genesys_api_downtime():
    """
    Test: Service handles downstream outage
    
    1. Publish messages
    2. Simulate Genesys API down (502)
    3. Verify retries
    4. Restore API
    5. Verify messages processed
    """
    pass
```

---

## Deployment & Operations

### 12.1 Environment Variables

**Required Configuration**:
```bash
# Service Identity
SERVICE_NAME=inbound-transformer
SERVICE_VERSION=1.2.0

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@rabbitmq.internal:5672/vhost
RABBITMQ_QUEUE=inbound-processed
RABBITMQ_PREFETCH_COUNT=10

# Genesys API
GENESYS_API_BASE_URL=http://genesys-api-service.internal:8080
GENESYS_INTEGRATION_ID=integration-uuid-from-genesys
SERVICE_TOKEN=jwt-or-api-key

# Idempotency Cache
REDIS_URL=redis://redis.internal:6379/0
REDIS_PASSWORD=secret
REDIS_CACHE_TTL=86400

# Retry Configuration
MAX_RETRY_ATTEMPTS=5
BASE_RETRY_DELAY=1
MAX_RETRY_DELAY=32

# Feature Flags
IGNORE_SENT_STATUS=true

# Timeouts
HTTP_CONNECT_TIMEOUT=5
HTTP_READ_TIMEOUT=10
HTTP_TOTAL_TIMEOUT=15

# Observability
LOG_LEVEL=INFO
METRICS_PORT=9090
```

**Optional Configuration**:
```bash
# Performance Tuning
WORKER_CONCURRENCY=10
MAX_MESSAGE_SIZE=2097152  # 2MB

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60

# Testing
DRY_RUN=false  # Don't actually dispatch to Genesys
```

### 12.2 Container Configuration

**Dockerfile Example**:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY src ./src

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node healthcheck.js

# Expose metrics port
EXPOSE 9090

CMD ["node", "src/index.js"]
```

**Kubernetes Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: inbound-transformer
spec:
  replicas: 2  # Minimum for HA
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: inbound-transformer
  template:
    metadata:
      labels:
        app: inbound-transformer
        version: "1.2"
    spec:
      containers:
      - name: inbound-transformer
        image: inbound-transformer:1.2.0
        resources:
          requests:
            memory: "256Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "2000m"
        env:
        - name: SERVICE_NAME
          value: "inbound-transformer"
        - name: RABBITMQ_URL
          valueFrom:
            secretKeyRef:
              name: rabbitmq-credentials
              key: url
        - name: SERVICE_TOKEN
          valueFrom:
            secretKeyRef:
              name: service-tokens
              key: genesys-api-token
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: redis-config
              key: url
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
        ports:
        - containerPort: 9090
          name: metrics
```

### 12.3 Horizontal Scaling

**Scaling Strategy**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: inbound-transformer-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: inbound-transformer
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: rabbitmq_queue_depth
      target:
        type: AverageValue
        averageValue: "100"
```

### 12.4 Monitoring Alerts

**Alert Definitions**:

1. **High Error Rate**:
   ```yaml
   alert: InboundTransformerHighErrorRate
   expr: rate(transformation_failures_total[5m]) > 0.1
   severity: warning
   description: High error rate in message transformation
   ```

2. **Genesys API Failures**:
   ```yaml
   alert: InboundTransformerGenesysAPIFailures
   expr: rate(genesys_dispatch_failures_total[5m]) > 0.05
   severity: critical
   description: High failure rate dispatching to Genesys API
   ```

3. **DLQ Activity**:
   ```yaml
   alert: InboundTransformerDLQActivity
   expr: increase(messages_dlq_total[5m]) > 0
   severity: warning
   description: Messages being routed to dead letter queue
   ```

4. **High Latency**:
   ```yaml
   alert: InboundTransformerHighLatency
   expr: histogram_quantile(0.99, processing_latency_seconds) > 0.1
   severity: warning
   description: p99 latency exceeds 100ms
   ```

5. **Service Down**:
   ```yaml
   alert: InboundTransformerDown
   expr: up{job="inbound-transformer"} == 0
   severity: critical
   description: Inbound Transformer service is down
   ```

### 12.5 Runbook

**Common Issues**:

1. **Service Won't Start**:
   ```
   Symptom: Container crashes on startup
   
   Check:
   - Environment variables configured?
   - RabbitMQ accessible?
   - Redis accessible (if configured)?
   - Service token valid?
   
   Logs:
   kubectl logs deployment/inbound-transformer
   ```

2. **Messages Not Processing**:
   ```
   Symptom: Queue depth increasing
   
   Check:
   - Service instances running?
   - Genesys API reachable?
   - Circuit breaker open?
   - Rate limiting?
   
   Debug:
   kubectl get pods -l app=inbound-transformer
   kubectl exec -it <pod> -- curl localhost:8080/health/ready
   ```

3. **High DLQ Rate**:
   ```
   Symptom: Many messages in DLQ
   
   Investigate:
   - Check DLQ messages for patterns
   - Look for validation errors
   - Check Genesys API status
   - Review failure reasons in logs
   
   Query DLQ:
   rabbitmqadmin get queue=inbound-transformer-dlq count=10
   ```

4. **Performance Degradation**:
   ```
   Symptom: High latency, slow processing
   
   Check:
   - CPU/memory usage
   - RabbitMQ connection count
   - Redis latency
   - Genesys API response times
   
   Scale:
   kubectl scale deployment inbound-transformer --replicas=5
   ```

---

## Implementation Guidelines

### 13.1 Project Structure

**Recommended Layout**:
```
inbound-transformer/
├── src/
│   ├── index.js                 # Entry point
│   ├── config.js                # Configuration loading
│   ├── rabbitmq/
│   │   ├── consumer.js          # RabbitMQ consumer
│   │   └── connection.js        # Connection management
│   ├── transform/
│   │   ├── message.js           # Message transformation
│   │   ├── event.js             # Event transformation
│   │   └── validation.js        # Input validation
│   ├── dispatch/
│   │   ├── client.js            # HTTP client
│   │   ├── retry.js             # Retry logic
│   │   └── circuit-breaker.js   # Circuit breaker
│   ├── cache/
│   │   ├── redis.js             # Redis cache
│   │   └── lru.js               # In-memory cache
│   ├── observability/
│   │   ├── logger.js            # Structured logging
│   │   ├── metrics.js           # Prometheus metrics
│   │   └── health.js            # Health checks
│   └── utils/
│       ├── timestamp.js         # Time utilities
│       ├── security.js          # URL validation
│       └── hash.js              # Hashing functions
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/
│   └── requirements.md          # This document
├── Dockerfile
├── docker-compose.yml           # Local development
├── k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── hpa.yaml
└── package.json
```

### 13.2 Code Style Guidelines

**Key Principles**:

1. **Simplicity**: Prefer simple, readable code over clever solutions
2. **Statelessness**: No global mutable state
3. **Pure Functions**: Transformation logic should be pure functions
4. **Error Handling**: Explicit error handling, no silent failures
5. **Testing**: Write tests first for transformation logic

**Example Patterns**:

```python
# Good: Pure transformation function
def transform_message(input_payload, config):
    """Transform WhatsApp message to Genesys format"""
    return {
        "id": input_payload["internalId"],
        "type": "Text",
        "text": input_payload["payload"]["body"],
        # ...
    }

# Bad: Stateful transformation
class MessageTransformer:
    def __init__(self):
        self.counter = 0
    
    def transform(self, input_payload):
        self.counter += 1  # Side effect!
        return {...}
```

```python
# Good: Explicit error handling
def dispatch_message(message, config):
    try:
        response = http_client.post(url, json=message)
        if not response.ok:
            raise DispatchError(f"HTTP {response.status_code}")
        return response
    except TimeoutError as e:
        raise RetryableError("Timeout") from e

# Bad: Silent failures
def dispatch_message(message, config):
    try:
        response = http_client.post(url, json=message)
        return response
    except:
        pass  # What happened?
```

### 13.3 Dependencies

**Recommended Libraries**:

**Node.js**:
```json
{
  "dependencies": {
    "amqplib": "^0.10.0",
    "axios": "^1.4.0",
    "ioredis": "^5.3.0",
    "prom-client": "^14.2.0",
    "winston": "^3.9.0"
  }
}
```

**Python**:
```toml
[dependencies]
pika = "^1.3.0"
requests = "^2.31.0"
redis = "^4.5.0"
prometheus-client = "^0.17.0"
```

**Go**:
```go
require (
    github.com/streadway/amqp v1.1.0
    github.com/go-redis/redis/v8 v8.11.5
    github.com/prometheus/client_golang v1.16.0
)
```

### 13.4 Development Workflow

**Local Development**:
```bash
# Start dependencies
docker-compose up -d rabbitmq redis

# Run service
npm start  # or: python main.py, go run main.go

# Run tests
npm test

# Check code quality
npm run lint
npm run type-check

# Local load test
npm run load-test
```

**Docker Compose for Local Dev**:
```yaml
version: '3.8'
services:
  rabbitmq:
    image: rabbitmq:3.11-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: dev
      RABBITMQ_DEFAULT_PASS: dev
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  inbound-transformer:
    build: .
    environment:
      RABBITMQ_URL: amqp://dev:dev@rabbitmq:5672/
      REDIS_URL: redis://redis:6379/0
      GENESYS_API_BASE_URL: http://mock-genesys:8080
      LOG_LEVEL: DEBUG
    depends_on:
      - rabbitmq
      - redis
```

---

## Common Pitfalls & Anti-Patterns

### 14.1 Pitfalls to Avoid

**1. Storing State**:
```python
# ❌ BAD: Storing state
class Transformer:
    def __init__(self):
        self.processed_ids = set()  # State!
    
    def process(self, message):
        if message["id"] in self.processed_ids:
            return
        self.processed_ids.add(message["id"])
        # ...

# ✅ GOOD: Stateless with external cache
def process(message, cache):
    key = get_idempotency_key(message)
    if cache.is_duplicate(key):
        return
    # ...
```

**2. Silent Failures**:
```python
# ❌ BAD: Swallowing exceptions
try:
    dispatch_to_genesys(message)
except:
    pass  # Message lost!

# ✅ GOOD: Explicit handling
try:
    dispatch_to_genesys(message)
except RetryableError as e:
    log_error("Dispatch failed, will retry", error=e)
    raise
except PermanentError as e:
    log_error("Dispatch failed permanently", error=e)
    route_to_dlq(message, str(e))
```

**3. Missing Idempotency**:
```python
# ❌ BAD: No deduplication
def process(message):
    transformed = transform(message)
    dispatch(transformed)
    ack(message)

# ✅ GOOD: Idempotent processing
def process(message):
    if is_duplicate(message):
        ack(message)
        return
    
    transformed = transform(message)
    dispatch(transformed)
    ack(message)
```

**4. Hardcoded Values**:
```python
# ❌ BAD: Hardcoded configuration
GENESYS_URL = "http://10.0.1.5:8080"
INTEGRATION_ID = "integration-123"

# ✅ GOOD: Environment-based config
config = {
    "GENESYS_API_BASE_URL": os.getenv("GENESYS_API_BASE_URL"),
    "INTEGRATION_ID": os.getenv("GENESYS_INTEGRATION_ID")
}
```

**5. Unbounded Retries**:
```python
# ❌ BAD: Infinite retries
while True:
    try:
        dispatch(message)
        break
    except:
        time.sleep(1)
        # Retry forever!

# ✅ GOOD: Limited retries with backoff
for attempt in range(MAX_ATTEMPTS):
    try:
        dispatch(message)
        return
    except:
        if attempt < MAX_ATTEMPTS - 1:
            time.sleep(backoff(attempt))
        else:
            route_to_dlq(message)
```

**6. Logging Secrets**:
```python
# ❌ BAD: Logging sensitive data
log.info(f"Dispatching with token: {config['SERVICE_TOKEN']}")
log.debug(f"User phone: {message['waId']}")

# ✅ GOOD: Sanitized logging
log.info("Dispatching to Genesys API")
log.debug(f"User: {mask_phone(message['waId'])}")
```

**7. Blocking Operations**:
```python
# ❌ BAD: Blocking the consumer
def process(message):
    result = blocking_http_call()  # Blocks other messages
    time.sleep(10)  # Blocks other messages
    return result

# ✅ GOOD: Async or concurrent processing
async def process(message):
    result = await async_http_call()
    return result
```

**8. Missing Monitoring**:
```python
# ❌ BAD: No observability
def process(message):
    transformed = transform(message)
    dispatch(transformed)

# ✅ GOOD: Metrics and logging
def process(message):
    start = time.time()
    
    try:
        transformed = transform(message)
        dispatch(transformed)
        metrics.increment("messages_processed")
        log.info("Message processed", correlation_id=message["id"])
    except Exception as e:
        metrics.increment("processing_errors")
        log.error("Processing failed", error=e)
        raise
    finally:
        metrics.observe("processing_latency", time.time() - start)
```

### 14.2 Architecture Anti-Patterns

**1. Coupling to Upstream**:
```python
# ❌ BAD: Tight coupling
def process(message):
    # Assuming upstream structure
    user_name = message["user"]["profile"]["name"]["first"]

# ✅ GOOD: Defensive programming
def process(message):
    contact_name = message.get("contactName")
    first_name = extract_first_name(contact_name) if contact_name else None
```

**2. Business Logic in Transformer**:
```python
# ❌ BAD: Adding business rules
def transform(message):
    # Don't add logic like:
    if message["priority"] == "high":
        # Route differently
        pass
    
    # Or:
    if is_business_hours():
        # Do something different
        pass

# ✅ GOOD: Pure transformation
def transform(message):
    # Just transform structure
    return {
        "id": message["internalId"],
        "text": message["payload"]["body"]
    }
```

**3. Synchronous Chaining**:
```python
# ❌ BAD: Chaining multiple sync calls
def process(message):
    user = fetch_user_profile(message["waId"])
    preferences = fetch_preferences(user["id"])
    history = fetch_history(user["id"])
    # Long synchronous chain

# ✅ GOOD: Simple transformation
def process(message):
    # Use data already in message
    transformed = transform(message)
    dispatch(transformed)
```

---

## Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| **State Manager** | Upstream service that enriches WhatsApp payloads with conversation context |
| **Genesys API Service** | Internal abstraction layer over Genesys Cloud API |
| **Open Messaging** | Genesys messaging protocol specification |
| **WAMID** | WhatsApp Message ID - unique identifier from WhatsApp |
| **waId** | WhatsApp ID - typically the user's phone number in E.164 format |
| **Idempotency** | Property that ensures repeated operations have same effect as single operation |
| **Dead Letter Queue** | Queue for messages that cannot be processed after max retries |
| **Circuit Breaker** | Pattern to prevent cascading failures by stopping requests to failing service |
| **Exponential Backoff** | Retry strategy where delay increases exponentially with each attempt |

### B. Related Documents

- System Design Document
- Genesys Open Messaging Specification
- WhatsApp Business API Documentation
- State Manager Service Documentation
- Genesys API Service Documentation

### C. Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2023-10-01 | Initial version |
| 1.1 | 2023-11-01 | Added circuit breaker pattern |
| 1.2 | 2023-12-01 | Enhanced security requirements, added status event transformation |

### D. Quick Reference

**Key Endpoints**:
```
POST /genesys/messages/inbound  - Send inbound message
POST /genesys/events/inbound    - Send receipt event
GET  /health/live               - Liveness check
GET  /health/ready              - Readiness check
GET  /metrics                   - Prometheus metrics
```

**Environment Variables** (minimum):
```bash
RABBITMQ_URL=amqp://...
REDIS_URL=redis://...
GENESYS_API_BASE_URL=http://...
GENESYS_INTEGRATION_ID=uuid
SERVICE_TOKEN=secret
```

**Key Metrics**:
```
messages_processed_total        - Success count
messages_dlq_total             - Failure count
processing_latency_seconds     - Performance
genesys_dispatch_failures_total - Downstream health
```

---

## Summary

This document provides comprehensive requirements for implementing the Inbound Transformer Service. Key principles:

1. **Stateless Design**: No persistent storage, horizontally scalable
2. **Idempotent Processing**: Safe to retry, deduplication built-in
3. **Deterministic Transformation**: Pure functions, no business logic
4. **Resilient Dispatch**: Retries, circuit breakers, DLQ handling
5. **Observable**: Metrics, logs, traces for debugging
6. **Secure**: Input validation, URL safety, no secret logging

The service must be **predictable and boring** - no surprises, no magic. It transforms messages reliably, handles failures gracefully, and provides visibility into its operations.

For implementation, follow the patterns in this document closely. The architecture has been battle-tested and accounts for real-world failure modes. Deviating from these patterns will likely result in production issues.
--- END inbound-transformer/inbound-transformer-frd.md ---


--- BEGIN outbound-transformer/outbound-tranformer-frd.md ---

# Outbound Transformer Service - Functional Requirements Document

**Version:** 1.2 (Enterprise Hardened - LLM Optimized)  
**Service Name:** `outbound-transformer`  
**Purpose:** Message transformation pipeline between Genesys Cloud and WhatsApp Business Platform  
**Architecture Pattern:** Stateless, event-driven transformation service

---

## Table of Contents
1. [Service Overview](#1-service-overview)
2. [Architecture Context](#2-architecture-context)
3. [Data Contracts](#3-data-contracts)
4. [Functional Requirements](#4-functional-requirements)
5. [Validation Rules](#5-validation-rules)
6. [Error Handling](#6-error-handling)
7. [Performance Requirements](#7-performance-requirements)
8. [Observability](#8-observability)
9. [Implementation Guidelines](#9-implementation-guidelines)

---

## 1. Service Overview

### 1.1 Primary Purpose
The **Outbound Transformer Service** is a dedicated transformation layer that converts enriched outbound messages from Genesys Cloud into WhatsApp Business Platform compatible payloads.

### 1.2 Service Boundaries

**What This Service DOES:**
- Consumes enriched messages from RabbitMQ queue `outbound-processed`
- Transforms Genesys Open Messaging JSON → WhatsApp Graph API JSON
- Validates media URLs, MIME types, and WhatsApp constraints
- Enforces idempotency to prevent duplicate sends
- Routes transformed messages to `outbound-ready` queue or directly to WhatsApp API Service
- Handles Dead Letter Queue (DLQ) routing for failed transformations

**What This Service DOES NOT DO:**
- ❌ Store conversation state or history
- ❌ Perform identity resolution or customer lookup
- ❌ Make direct calls to Meta Graph API (unless in pipeline mode)
- ❌ Implement business logic or routing decisions
- ❌ Manage WhatsApp Business Account configuration
- ❌ Handle inbound messages (separate service)

### 1.3 Processing Mode
**Architecture:** Stateless, deterministic transformer  
**Concurrency:** Multi-threaded message processing  
**Deployment:** Horizontally scalable (multiple instances)

---

## 2. Architecture Context

### 2.1 System Dependencies

| Component | Type | Purpose | Connection Details |
|-----------|------|---------|-------------------|
| **RabbitMQ** | Message Broker | Source of outbound messages | Queue: `outbound-processed`<br>Exchange: `outbound.exchange` |
| **WhatsApp API Service** | Downstream Service | Destination for transformed messages | Queue: `outbound-ready` (recommended)<br>OR REST: `POST /whatsapp/send` |
| **Object Storage** | Storage Backend | Media file hosting | MinIO (internal) or S3<br>Must generate public signed URLs |
| **Redis** | Cache | Idempotency deduplication | Key pattern: `idempotency:outbound:{internalId}`<br>TTL: 24 hours |
| **Prometheus** | Metrics | Performance monitoring | Metrics endpoint: `/metrics` |
| **Structured Logger** | Logging | Audit trail and debugging | JSON format with correlation IDs |

### 2.2 Message Flow Diagram

```
┌─────────────────┐
│ State Manager   │
│ (Upstream)      │
└────────┬────────┘
         │
         │ Enriched Message
         ▼
┌─────────────────────────────────┐
│ RabbitMQ: outbound-processed    │
└────────┬────────────────────────┘
         │
         │ Consume
         ▼
┌─────────────────────────────────┐
│ Outbound Transformer Service    │
│                                 │
│ 1. Validate Schema              │
│ 2. Check Idempotency (Redis)    │
│ 3. Transform to WhatsApp Format │
│ 4. Validate Media URLs          │
│ 5. Enforce WhatsApp Rules       │
└────────┬────────────────────────┘
         │
         │ Success
         ▼
┌─────────────────────────────────┐
│ RabbitMQ: outbound-ready        │
│ OR                              │
│ WhatsApp API Service (REST)     │
└─────────────────────────────────┘

         │ Failure (after retries)
         ▼
┌─────────────────────────────────┐
│ RabbitMQ: outbound-transformer-dlq │
└─────────────────────────────────┘
```

---

## 3. Data Contracts

### 3.1 Input Schema (From State Manager)

**Source Queue:** `outbound-processed`  
**Message Format:** JSON  
**Content-Type:** `application/json`

**Full Input Schema:**
```json
{
  "internalId": "uuid-msg-123",           // Required: Unique message identifier (UUID v4)
  "tenantId": "uuid-5678",                // Required: Tenant/Organization identifier
  "conversationId": "genesys-conv-uuid",  // Required: Genesys conversation ID
  "genesysId": "genesys-msg-uuid",        // Required: Genesys message ID (for correlation)
  "waId": "919876543210",                 // Required: WhatsApp ID (E.164 format, no +)
  "phoneNumberId": "100000001",           // Required: WhatsApp Business Phone Number ID
  "timestamp": 1700000000,                // Required: Unix epoch seconds
  "type": "message",                      // Required: Always "message" for outbound
  "payload": {                            // Required: Message content
    "text": "Hello Customer",             // Optional: Text content (max 4096 chars)
    "media": {                            // Optional: Media attachment
      "url": "https://minio.internal/media-outbound/file.jpg",  // Required if media present
      "mime_type": "image/jpeg",          // Required if media present
      "filename": "support-guide.jpg"     // Optional but recommended for documents
    }
  }
}
```

**Field Validation Rules:**

| Field | Type | Required | Constraints | Validation |
|-------|------|----------|-------------|------------|
| `internalId` | String (UUID) | Yes | UUID v4 format | Regex: `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` |
| `tenantId` | String (UUID) | Yes | UUID v4 format | Same as internalId |
| `conversationId` | String | Yes | Non-empty | Length: 1-255 chars |
| `genesysId` | String | Yes | Non-empty | Length: 1-255 chars |
| `waId` | String | Yes | E.164 format, no + prefix | Regex: `^[1-9][0-9]{6,14}$` |
| `phoneNumberId` | String | Yes | Numeric string | Regex: `^[0-9]+$` |
| `timestamp` | Integer | Yes | Unix epoch seconds | Range: 1000000000 - 9999999999 |
| `type` | String | Yes | Must be "message" | Enum: ["message"] |
| `payload` | Object | Yes | Must contain text OR media | Not empty |
| `payload.text` | String | No | If present, 1-4096 chars | Trimmed, non-empty |
| `payload.media` | Object | No | If present, requires url + mime_type | See media validation |

### 3.2 Output Schema (To WhatsApp API Service)

**Destination Queue:** `outbound-ready` (recommended)  
**Alternative:** REST API `POST /whatsapp/send`  
**Message Format:** JSON  
**Content-Type:** `application/json`

**Full Output Schema:**
```json
{
  "metadata": {
    "tenantId": "uuid-5678",              // Tenant identifier for routing
    "phoneNumberId": "100000001",         // WhatsApp Business Phone Number ID
    "internalId": "uuid-msg-123",         // Original message ID for tracking
    "correlationId": "genesys-msg-uuid"   // Genesys message ID for correlation
  },
  "wabaPayload": {
    "messaging_product": "whatsapp",      // Always "whatsapp"
    "recipient_type": "individual",       // Always "individual"
    "to": "919876543210",                 // Recipient WhatsApp ID
    "type": "text|image|video|document|audio",  // Message type
    
    // For text messages:
    "text": {
      "body": "Hello Customer"
    },
    
    // For image messages:
    "image": {
      "link": "https://public-url/file.jpg",
      "caption": "Hello Customer"         // Optional, max 1024 chars
    },
    
    // For video messages:
    "video": {
      "link": "https://public-url/file.mp4",
      "caption": "Hello Customer"         // Optional, max 1024 chars
    },
    
    // For document messages:
    "document": {
      "link": "https://public-url/file.pdf",
      "filename": "support-guide.pdf",    // Strongly recommended
      "caption": "Hello Customer"         // Optional, max 1024 chars
    },
    
    // For audio messages:
    "audio": {
      "link": "https://public-url/file.aac"
      // No caption support for audio
    }
  }
}
```

**Output Message Headers (RabbitMQ):**
```
X-Tenant-ID: uuid-5678
X-Correlation-ID: genesys-msg-uuid
X-Message-Type: outbound
X-Timestamp: 1700000000
Content-Type: application/json
```

### 3.3 MIME Type to WhatsApp Type Mapping

**Supported Media Types:**

| MIME Type | WhatsApp Type | Max File Size | Notes |
|-----------|---------------|---------------|-------|
| `image/jpeg` | `image` | 5 MB | Recommended format |
| `image/png` | `image` | 5 MB | Supported |
| `video/mp4` | `video` | 16 MB | H.264 codec recommended |
| `video/3gpp` | `video` | 16 MB | Supported |
| `application/pdf` | `document` | 100 MB | Most common document type |
| `application/vnd.ms-powerpoint` | `document` | 100 MB | PPT files |
| `application/msword` | `document` | 100 MB | DOC files |
| `application/vnd.ms-excel` | `document` | 100 MB | XLS files |
| `application/vnd.openxmlformats-officedocument.*` | `document` | 100 MB | Office Open XML (DOCX, XLSX, PPTX) |
| `text/plain` | `document` | 100 MB | Text files |
| `audio/aac` | `audio` | 16 MB | Recommended audio format |
| `audio/mp4` | `audio` | 16 MB | M4A files |
| `audio/mpeg` | `audio` | 16 MB | MP3 files |
| `audio/amr` | `audio` | 16 MB | AMR files |
| `audio/ogg` | `audio` | 16 MB | OGG files (Opus codec) |

**Unsupported MIME Types - Fallback Behavior:**

Configuration option: `UNSUPPORTED_MIME_BEHAVIOR`

| Behavior | Description | Implementation |
|----------|-------------|----------------|
| `reject` | Reject message, send to DLQ | Log error, NACK message, route to DLQ |
| `convert_to_document` | Treat as generic document | Map to `document` type, use original filename |
| `text_fallback` | Send text only, drop media | Send text message, log warning about dropped media |

---

## 4. Functional Requirements

### 4.1 Message Consumption (REQ-OUT-01)

**Requirement ID:** REQ-OUT-01  
**Priority:** Critical  
**Description:** Consume messages from RabbitMQ queue with proper acknowledgment

**Processing Steps:**

1. **Connect to RabbitMQ**
   - Queue: `outbound-processed`
   - Prefetch count: 10 (configurable)
   - Auto-ack: Disabled (manual ACK required)

2. **Deserialize Message**
   ```python
   # Pseudo-code
   try:
       message = json.loads(body)
   except json.JSONDecodeError as e:
       log_error("Invalid JSON", error=e, raw_body=body)
       channel.basic_ack(delivery_tag)  # ACK to remove from queue
       return
   ```

3. **Validate Required Fields**
   - Check presence: `tenantId`, `waId`, `phoneNumberId`, `internalId`, `conversationId`, `genesysId`, `timestamp`, `type`, `payload`
   - If any required field missing:
     - Log error with field name
     - ACK message (invalid, cannot retry)
     - Increment metric: `outbound_invalid_messages_total`

4. **Idempotency Check**
   ```python
   # Pseudo-code
   cache_key = f"idempotency:outbound:{message['internalId']}"
   if redis.exists(cache_key):
       log_info("Duplicate message detected", internal_id=message['internalId'])
       channel.basic_ack(delivery_tag)  # ACK silently
       increment_metric("outbound_duplicate_messages_total")
       return
   
   # Set idempotency marker
   redis.setex(cache_key, ttl=86400, value="processed")  # 24 hour TTL
   ```

**Failure Scenarios:**

| Scenario | Action | ACK/NACK | Metrics |
|----------|--------|----------|---------|
| Invalid JSON | Log error | ACK | `outbound_invalid_messages_total` |
| Missing required field | Log error | ACK | `outbound_invalid_messages_total` |
| Duplicate `internalId` | Log info | ACK | `outbound_duplicate_messages_total` |
| Redis connection error | Retry (process anyway if cache unavailable) | See retry policy | `outbound_cache_errors_total` |

---

### 4.2 Text Message Transformation (REQ-OUT-02)

**Requirement ID:** REQ-OUT-02  
**Priority:** Critical  
**Description:** Transform text-only messages to WhatsApp format

**Condition:**
- `payload.text` is present AND non-empty after trimming
- `payload.media` is null or undefined

**Transformation Logic:**

```python
# Pseudo-code
def transform_text_message(input_message):
    text = input_message['payload']['text'].strip()
    
    # Validate text length
    if len(text) == 0:
        raise ValidationError("Text is empty after trimming")
    
    if len(text) > 4096:
        raise ValidationError(f"Text exceeds max length: {len(text)} > 4096")
    
    # Build output
    output = {
        "metadata": {
            "tenantId": input_message['tenantId'],
            "phoneNumberId": input_message['phoneNumberId'],
            "internalId": input_message['internalId'],
            "correlationId": input_message['genesysId']
        },
        "wabaPayload": {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": input_message['waId'],
            "type": "text",
            "text": {
                "body": text
            }
        }
    }
    
    return output
```

**Validation Rules:**

| Rule | Validation | Error Handling |
|------|------------|----------------|
| Text not empty | `len(text.strip()) > 0` | Reject, log, ACK |
| Max length | `len(text) <= 4096` | Reject, log, ACK |
| Unicode support | Allow all valid UTF-8 | Log warning if contains unsupported chars |
| Whitespace normalization | Trim leading/trailing | Applied automatically |

**Examples:**

**Input:**
```json
{
  "internalId": "msg-001",
  "tenantId": "tenant-123",
  "waId": "919876543210",
  "phoneNumberId": "100000001",
  "payload": {
    "text": "  Hello Customer  "
  }
}
```

**Output:**
```json
{
  "metadata": {...},
  "wabaPayload": {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "919876543210",
    "type": "text",
    "text": {
      "body": "Hello Customer"
    }
  }
}
```

---

### 4.3 Media Message Transformation (REQ-OUT-03)

**Requirement ID:** REQ-OUT-03  
**Priority:** Critical  
**Description:** Transform media messages to WhatsApp format with proper URL handling

**Conditions:**
- `payload.media` is present
- `payload.media.url` is present and valid
- `payload.media.mime_type` is present

**Step 1: Determine WhatsApp Message Type**

```python
# Pseudo-code
def get_whatsapp_type(mime_type):
    MIME_TYPE_MAP = {
        'image/jpeg': 'image',
        'image/png': 'image',
        'video/mp4': 'video',
        'video/3gpp': 'video',
        'application/pdf': 'document',
        'audio/aac': 'audio',
        'audio/mp4': 'audio',
        'audio/mpeg': 'audio',
        'audio/amr': 'audio',
        'audio/ogg': 'audio',
        # Add all supported types from table above
    }
    
    whatsapp_type = MIME_TYPE_MAP.get(mime_type.lower())
    
    if whatsapp_type is None:
        # Handle unsupported MIME type based on config
        return handle_unsupported_mime(mime_type)
    
    return whatsapp_type
```

**Step 2: Validate and Transform Media URL**

```python
# Pseudo-code
def validate_and_transform_url(url, tenant_id, internal_id):
    # Parse URL
    parsed = urlparse(url)
    
    # Rule 1: Must be HTTPS
    if parsed.scheme != 'https':
        raise ValidationError(f"URL must be HTTPS: {url}")
    
    # Rule 2: Must not be private IP
    ip = socket.gethostbyname(parsed.hostname)
    if is_private_ip(ip):
        raise ValidationError(f"URL resolves to private IP: {ip}")
    
    # Rule 3: Check if internal storage URL
    if is_internal_storage_url(url):
        # Generate public signed URL
        public_url = generate_signed_url(
            url=url,
            tenant_id=tenant_id,
            expiration_seconds=600,  # 10 minutes
            internal_id=internal_id
        )
        return public_url
    
    # Rule 4: Validate URL is reachable (optional HEAD request)
    if config.VALIDATE_URL_ACCESSIBILITY:
        validate_url_accessible(url)
    
    return url

def is_internal_storage_url(url):
    internal_domains = [
        'minio.internal',
        'localhost',
        '127.0.0.1',
        config.INTERNAL_STORAGE_DOMAIN
    ]
    parsed = urlparse(url)
    return any(domain in parsed.hostname for domain in internal_domains)

def generate_signed_url(url, tenant_id, expiration_seconds, internal_id):
    # Implementation depends on storage backend
    # For MinIO/S3:
    # 1. Parse internal URL to get bucket + object key
    # 2. Generate presigned URL with expiration
    # 3. Ensure URL is publicly accessible
    # 4. Log URL generation for audit
    
    signed_url = storage_client.presigned_get_object(
        bucket_name=extract_bucket(url),
        object_name=extract_object_key(url),
        expires=timedelta(seconds=expiration_seconds)
    )
    
    log_info("Generated signed URL", 
             internal_id=internal_id,
             original_url=url,
             signed_url=signed_url,
             expiration=expiration_seconds)
    
    return signed_url
```

**Step 3: Handle Caption Logic**

```python
# Pseudo-code
def get_caption(text, whatsapp_type):
    # Audio does not support captions
    if whatsapp_type == 'audio':
        if text:
            log_warning("Caption not supported for audio, will be sent as separate message")
            return None
        return None
    
    # Other types support captions
    if text:
        caption = text.strip()
        if len(caption) > 1024:
            log_warning(f"Caption exceeds 1024 chars, truncating: {len(caption)}")
            caption = caption[:1024]
        return caption
    
    return None
```

**Step 4: Build Media Payload**

```python
# Pseudo-code
def transform_media_message(input_message):
    media = input_message['payload']['media']
    text = input_message['payload'].get('text', '').strip()
    
    # Determine WhatsApp type
    whatsapp_type = get_whatsapp_type(media['mime_type'])
    
    # Validate and transform URL
    public_url = validate_and_transform_url(
        url=media['url'],
        tenant_id=input_message['tenantId'],
        internal_id=input_message['internalId']
    )
    
    # Get caption
    caption = get_caption(text, whatsapp_type)
    
    # Build media object
    media_object = {
        "link": public_url
    }
    
    # Add caption if supported and present
    if caption and whatsapp_type in ['image', 'video', 'document']:
        media_object['caption'] = caption
    
    # Add filename for documents
    if whatsapp_type == 'document':
        filename = media.get('filename') or extract_filename_from_url(public_url)
        if filename:
            media_object['filename'] = filename
    
    # Build output
    output = {
        "metadata": {
            "tenantId": input_message['tenantId'],
            "phoneNumberId": input_message['phoneNumberId'],
            "internalId": input_message['internalId'],
            "correlationId": input_message['genesysId']
        },
        "wabaPayload": {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": input_message['waId'],
            "type": whatsapp_type,
            whatsapp_type: media_object
        }
    }
    
    return output, send_separate_text_for_audio(text, whatsapp_type)

def send_separate_text_for_audio(text, whatsapp_type):
    # If audio + text, return text message to send separately
    if whatsapp_type == 'audio' and text:
        return True
    return False
```

**Audio + Text Special Handling:**

Configuration: `AUDIO_TEXT_BEHAVIOR`

| Behavior | Description | Implementation |
|----------|-------------|----------------|
| `separate_message` | Send audio, then separate text message | Create two output messages |
| `discard_text` | Send audio only, ignore text | Log warning, send audio only |
| `text_only` | Send text only, ignore audio | Log warning, send text only |

**Example Transformation (Image with Caption):**

**Input:**
```json
{
  "internalId": "msg-002",
  "tenantId": "tenant-123",
  "waId": "919876543210",
  "phoneNumberId": "100000001",
  "payload": {
    "text": "Check out this guide",
    "media": {
      "url": "https://minio.internal/bucket/guide.jpg",
      "mime_type": "image/jpeg",
      "filename": "user-guide.jpg"
    }
  }
}
```

**Output:**
```json
{
  "metadata": {
    "tenantId": "tenant-123",
    "phoneNumberId": "100000001",
    "internalId": "msg-002",
    "correlationId": "genesys-msg-uuid"
  },
  "wabaPayload": {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "919876543210",
    "type": "image",
    "image": {
      "link": "https://public-storage.example.com/bucket/guide.jpg?signature=...",
      "caption": "Check out this guide"
    }
  }
}
```

---

### 4.4 Dispatch to WhatsApp API Service (REQ-OUT-04)

**Requirement ID:** REQ-OUT-04  
**Priority:** Critical  
**Description:** Forward transformed messages to WhatsApp API Service

**Mode 1: Publish to Queue (Recommended)**

**Configuration:**
- Queue: `outbound-ready`
- Exchange: `outbound.exchange` (topic exchange)
- Routing Key: `outbound.ready.{tenantId}`
- Delivery Mode: Persistent (2)

**Implementation:**
```python
# Pseudo-code
def dispatch_via_queue(transformed_message):
    headers = {
        'X-Tenant-ID': transformed_message['metadata']['tenantId'],
        'X-Correlation-ID': transformed_message['metadata']['correlationId'],
        'X-Message-Type': 'outbound',
        'X-Timestamp': str(int(time.time())),
        'Content-Type': 'application/json'
    }
    
    routing_key = f"outbound.ready.{transformed_message['metadata']['tenantId']}"
    
    channel.basic_publish(
        exchange='outbound.exchange',
        routing_key=routing_key,
        body=json.dumps(transformed_message),
        properties=pika.BasicProperties(
            delivery_mode=2,  # Persistent
            headers=headers,
            content_type='application/json'
        )
    )
    
    log_info("Message dispatched to queue",
             internal_id=transformed_message['metadata']['internalId'],
             queue='outbound-ready')
    
    increment_metric("outbound_messages_dispatched_total",
                     labels={'tenant_id': transformed_message['metadata']['tenantId']})
```

**Mode 2: Direct HTTP Call (Pipeline Mode - Optional)**

**Configuration:**
- Endpoint: `POST {WHATSAPP_API_BASE_URL}/whatsapp/send`
- Timeout: 5 seconds
- Retry: 3 attempts with exponential backoff

**Implementation:**
```python
# Pseudo-code
def dispatch_via_http(transformed_message):
    url = f"{config.WHATSAPP_API_BASE_URL}/whatsapp/send"
    headers = {
        'Content-Type': 'application/json',
        'X-Tenant-ID': transformed_message['metadata']['tenantId'],
        'X-Correlation-ID': transformed_message['metadata']['correlationId']
    }
    
    for attempt in range(1, 4):  # 3 attempts
        try:
            response = requests.post(
                url=url,
                json=transformed_message,
                headers=headers,
                timeout=5
            )
            
            if 200 <= response.status_code < 300:
                log_info("Message dispatched via HTTP",
                         internal_id=transformed_message['metadata']['internalId'],
                         status_code=response.status_code)
                return 'ack'  # Success
            
            elif 400 <= response.status_code < 500:
                log_error("Client error from WhatsApp API",
                          status_code=response.status_code,
                          response_body=response.text)
                return 'ack'  # Don't retry client errors
            
            elif 500 <= response.status_code < 600:
                log_warning(f"Server error on attempt {attempt}",
                            status_code=response.status_code)
                if attempt < 3:
                    time.sleep(2 ** attempt)  # Exponential backoff
                    continue
                return 'nack'  # Retry via queue redelivery
            
        except requests.Timeout:
            log_warning(f"Timeout on attempt {attempt}")
            if attempt < 3:
                time.sleep(2 ** attempt)
                continue
            return 'nack'
        
        except Exception as e:
            log_error(f"Unexpected error on attempt {attempt}", error=e)
            return 'nack'
    
    return 'nack'
```

**HTTP Response Handling:**

| Status Code | Retry | ACK/NACK | Reason |
|-------------|-------|----------|--------|
| 200-299 | No | ACK | Success |
| 400 | No | ACK | Bad request (client error, won't succeed on retry) |
| 401 | No | ACK | Unauthorized (config issue, not message issue) |
| 429 | Yes | NACK | Rate limited (will succeed later) |
| 500-599 | Yes | NACK | Server error (transient) |
| Timeout | Yes | NACK | Network issue (transient) |

---

### 4.5 Idempotency Enforcement (REQ-OUT-05)

**Requirement ID:** REQ-OUT-05  
**Priority:** Critical  
**Description:** Prevent duplicate message delivery to WhatsApp

**Idempotency Key:** `internalId` field from input message

**Storage:** Redis cache with TTL

**Implementation:**

```python
# Pseudo-code
def check_idempotency(internal_id):
    cache_key = f"idempotency:outbound:{internal_id}"
    
    try:
        if redis.exists(cache_key):
            # Message already processed
            log_info("Duplicate message detected", internal_id=internal_id)
            increment_metric("outbound_duplicate_messages_total")
            return True  # Is duplicate
        
        # Not a duplicate, mark as processing
        # Use SETNX to handle race conditions
        success = redis.setnx(cache_key, json.dumps({
            'processed_at': time.time(),
            'status': 'processing'
        }))
        
        if not success:
            # Another instance processed this between check and set
            log_info("Concurrent duplicate detected", internal_id=internal_id)
            return True
        
        # Set TTL
        redis.expire(cache_key, 86400)  # 24 hours
        
        return False  # Not a duplicate
    
    except redis.ConnectionError as e:
        # Cache unavailable - log and continue processing
        # Accept risk of duplicate for availability
        log_error("Redis connection error during idempotency check",
                  error=e,
                  internal_id=internal_id)
        increment_metric("outbound_cache_errors_total")
        return False  # Process anyway

def mark_completed(internal_id):
    cache_key = f"idempotency:outbound:{internal_id}"
    try:
        redis.setex(
            cache_key,
            86400,  # 24 hours
            json.dumps({
                'processed_at': time.time(),
                'status': 'completed'
            })
        )
    except Exception as e:
        log_error("Failed to mark message as completed", error=e)
```

**Idempotency Window:** 24 hours  
**Rationale:** WhatsApp has 24-hour session window; duplicates beyond this are unlikely

**Edge Cases:**

| Scenario | Handling |
|----------|----------|
| Redis unavailable | Log error, process message (favor availability) |
| Race condition | SETNX handles atomically |
| TTL expires during processing | Next check will create new entry (safe) |
| Same message after 24h | Processed as new (acceptable) |

---

### 4.6 Dead Letter Queue Handling (REQ-OUT-06)

**Requirement ID:** REQ-OUT-06  
**Priority:** High  
**Description:** Route persistently failed messages to DLQ for manual investigation

**DLQ Configuration:**
- Queue: `outbound-transformer-dlq`
- Max Retries: 3 attempts
- Retry Delay: Exponential backoff (2s, 4s, 8s)

**Triggers for DLQ:**
- Transformation errors after max retries
- Downstream service unavailable after max retries
- Unrecoverable validation errors (after logging)

**DLQ Message Format:**
```json
{
  "original_message": { /* full input message */ },
  "error_details": {
    "error_type": "TransformationError",
    "error_message": "Unsupported MIME type: application/x-unknown",
    "stack_trace": "...",
    "retry_count": 3,
    "first_attempt_timestamp": 1700000000,
    "last_attempt_timestamp": 1700000024
  },
  "metadata": {
    "tenant_id": "uuid-5678",
    "internal_id": "uuid-msg-123",
    "dlq_timestamp": 1700000030,
    "service": "outbound-transformer",
    "service_version": "1.2.0"
  }
}
```

**Implementation:**
```python
# Pseudo-code
def route_to_dlq(original_message, error, retry_count):
    dlq_message = {
        "original_message": original_message,
        "error_details": {
            "error_type": type(error).__name__,
            "error_message": str(error),
            "stack_trace": traceback.format_exc(),
            "retry_count": retry_count,
            "first_attempt_timestamp": get_first_attempt_time(original_message),
            "last_attempt_timestamp": int(time.time())
        },
        "metadata": {
            "tenant_id": original_message.get('tenantId'),
            "internal_id": original_message.get('internalId'),
            "dlq_timestamp": int(time.time()),
            "service": "outbound-transformer",
            "service_version": config.SERVICE_VERSION
        }
    }
    
    channel.basic_publish(
        exchange='',
        routing_key='outbound-transformer-dlq',
        body=json.dumps(dlq_message),
        properties=pika.BasicProperties(
            delivery_mode=2,
            content_type='application/json'
        )
    )
    
    log_error("Message routed to DLQ",
              internal_id=original_message.get('internalId'),
              error_type=type(error).__name__,
              retry_count=retry_count)
    
    increment_metric("outbound_dlq_messages_total",
                     labels={'error_type': type(error).__name__})
    
    # Emit alert for DLQ routing
    if config.ALERT_ON_DLQ:
        emit_alert("message_to_dlq", severity="warning", message=dlq_message)
```

**No Silent Drops Policy:**
- Every message must be either successfully processed OR routed to DLQ
- Logging alone is insufficient
- DLQ ensures audit trail and recovery capability

---

## 5. Validation Rules

### 5.1 Input Validation Checklist

**Schema Validation:**
```python
# Pseudo-code
def validate_input_message(message):
    errors = []
    
    # Required fields
    required_fields = ['internalId', 'tenantId', 'conversationId', 
                       'genesysId', 'waId', 'phoneNumberId', 
                       'timestamp', 'type', 'payload']
    
    for field in required_fields:
        if field not in message:
            errors.append(f"Missing required field: {field}")
    
    # UUID validation
    if 'internalId' in message and not is_valid_uuid(message['internalId']):
        errors.append(f"Invalid UUID format for internalId: {message['internalId']}")
    
    if 'tenantId' in message and not is_valid_uuid(message['tenantId']):
        errors.append(f"Invalid UUID format for tenantId: {message['tenantId']}")
    
    # WhatsApp ID validation (E.164 without +)
    if 'waId' in message:
        if not re.match(r'^[1-9][0-9]{6,14}$', message['waId']):
            errors.append(f"Invalid WhatsApp ID format: {message['waId']}")
    
    # Phone Number ID validation
    if 'phoneNumberId' in message:
        if not re.match(r'^[0-9]+$', message['phoneNumberId']):
            errors.append(f"Invalid Phone Number ID format: {message['phoneNumberId']}")
    
    # Timestamp validation
    if 'timestamp' in message:
        if not isinstance(message['timestamp'], int):
            errors.append("Timestamp must be integer")
        elif not (1000000000 <= message['timestamp'] <= 9999999999):
            errors.append(f"Timestamp out of valid range: {message['timestamp']}")
    
    # Type validation
    if 'type' in message and message['type'] != 'message':
        errors.append(f"Invalid type: {message['type']}, must be 'message'")
    
    # Payload validation
    if 'payload' in message:
        payload = message['payload']
        has_text = 'text' in payload and payload['text']
        has_media = 'media' in payload and payload['media']
        
        if not has_text and not has_media:
            errors.append("Payload must contain either text or media")
        
        # Text validation
        if has_text:
            text = str(payload['text']).strip()
            if len(text) == 0:
                errors.append("Text is empty after trimming")
            elif len(text) > 4096:
                errors.append(f"Text exceeds max length: {len(text)} > 4096")
        
        # Media validation
        if has_media:
            media = payload['media']
            if 'url' not in media:
                errors.append("Media object missing required field: url")
            if 'mime_type' not in media:
                errors.append("Media object missing required field: mime_type")
    
    if errors:
        raise ValidationError(errors)
    
    return True
```

### 5.2 URL Validation Rules

```python
# Pseudo-code
def validate_url(url):
    # Parse URL
    try:
        parsed = urlparse(url)
    except Exception:
        raise ValidationError(f"Invalid URL format: {url}")
    
    # Must have scheme
    if not parsed.scheme:
        raise ValidationError(f"URL missing scheme: {url}")
    
    # Must be HTTPS
    if parsed.scheme != 'https':
        raise ValidationError(f"URL must use HTTPS: {url}")
    
    # Must have hostname
    if not parsed.hostname:
        raise ValidationError(f"URL missing hostname: {url}")
    
    # Check for private IP
    try:
        ip = socket.gethostbyname(parsed.hostname)
        if is_private_ip(ip):
            raise ValidationError(f"URL resolves to private IP: {ip}")
    except socket.gaierror:
        raise ValidationError(f"Cannot resolve hostname: {parsed.hostname}")
    
    # Must not be localhost
    if parsed.hostname in ['localhost', '127.0.0.1', '0.0.0.0']:
        raise ValidationError(f"URL cannot be localhost: {url}")
    
    return True

def is_private_ip(ip_str):
    ip = ipaddress.ip_address(ip_str)
    return ip.is_private or ip.is_loopback or ip.is_link_local
```

### 5.3 WhatsApp Business Platform Constraints

**Message Constraints:**

| Constraint | Value | Enforcement |
|------------|-------|-------------|
| Text max length | 4096 characters | Hard limit, reject if exceeded |
| Caption max length | 1024 characters | Hard limit, truncate or reject |
| Media URL max length | 2048 characters | Hard limit, reject if exceeded |
| Filename max length | 240 characters | Recommended, log warning if exceeded |

**24-Hour Session Window Validation (Optional):**

```python
# Pseudo-code
def validate_session_window(wa_id, tenant_id):
    # Check if there's an active 24-hour session
    # This requires state from conversation history (external service)
    
    if config.ENFORCE_SESSION_WINDOW:
        last_inbound_time = get_last_inbound_message_time(wa_id, tenant_id)
        
        if last_inbound_time is None:
            # No previous inbound message = no session
            log_warning("No active session window",
                        wa_id=wa_id,
                        recommendation="Use message template")
            return False
        
        time_since_last_inbound = time.time() - last_inbound_time
        
        if time_since_last_inbound > 86400:  # 24 hours
            log_warning("Session window expired",
                        wa_id=wa_id,
                        hours_since_inbound=time_since_last_inbound / 3600)
            return False
        
        return True
    
    return True  # Don't enforce if disabled
```

**Note:** Session window validation requires external state and may be handled by upstream services.

---

## 6. Error Handling

### 6.1 Error Classification

**Error Categories:**

| Category | Retry | ACK/NACK | DLQ | Examples |
|----------|-------|----------|-----|----------|
| **Client Error** | No | ACK | Yes | Invalid JSON, missing fields, bad UUID |
| **Validation Error** | No | ACK | Yes | Unsupported MIME, text too long, invalid URL |
| **Transient Error** | Yes | NACK | After max retries | Redis unavailable, HTTP 5xx, timeout |
| **Configuration Error** | No | ACK | Yes | Missing storage credentials, invalid config |

### 6.2 Retry Strategy

**Retry Policy:**
- Max retries: 3
- Backoff: Exponential (2s, 4s, 8s)
- Jitter: ±20% to prevent thundering herd

```python
# Pseudo-code
def retry_with_backoff(func, max_retries=3):
    for attempt in range(1, max_retries + 1):
        try:
            return func()
        except RetryableError as e:
            if attempt == max_retries:
                raise
            
            base_delay = 2 ** attempt  # 2, 4, 8 seconds
            jitter = random.uniform(-0.2, 0.2) * base_delay
            delay = base_delay + jitter
            
            log_warning(f"Retrying after {delay:.2f}s",
                        attempt=attempt,
                        max_retries=max_retries,
                        error=str(e))
            
            time.sleep(delay)
```

### 6.3 Error Response Format

**Structured Error Logging:**
```json
{
  "timestamp": "2024-02-12T10:30:45.123Z",
  "level": "ERROR",
  "service": "outbound-transformer",
  "version": "1.2.0",
  "error_type": "ValidationError",
  "error_message": "Unsupported MIME type: application/x-unknown",
  "context": {
    "internal_id": "uuid-msg-123",
    "tenant_id": "uuid-5678",
    "wa_id": "919876543210",
    "mime_type": "application/x-unknown",
    "stage": "media_transformation"
  },
  "stack_trace": "..."
}
```

---

## 7. Performance Requirements

### 7.1 Throughput Targets

| Metric | Minimum | Target | Notes |
|--------|---------|--------|-------|
| Messages/second (per instance) | 50 | 300 | Text messages |
| Messages/second (media) | 20 | 100 | Includes URL validation |
| Concurrent connections | 10 | 50 | RabbitMQ prefetch |

**Scaling Strategy:**
- Horizontal: Deploy multiple instances
- Vertical: Increase worker threads per instance
- Queue-based: Natural load distribution

### 7.2 Latency Targets

| Operation | Target | Maximum |
|-----------|--------|---------|
| Message consumption | < 1ms | 5ms |
| Schema validation | < 1ms | 3ms |
| Text transformation | < 1ms | 5ms |
| Media transformation | < 10ms | 50ms |
| URL validation | < 5ms | 20ms |
| Signed URL generation | < 10ms | 30ms |
| Queue publish | < 5ms | 20ms |
| **Total (text)** | **< 10ms** | **50ms** |
| **Total (media)** | **< 30ms** | **100ms** |

**Latency excludes:**
- Network latency to downstream services
- WhatsApp API processing time
- Queue delivery time

### 7.3 Resource Limits

**Memory:**
- Per instance: 512 MB - 2 GB
- Message buffer: Max 100 messages in memory
- Cache: 50 MB for idempotency keys

**CPU:**
- Per instance: 1-4 cores
- Target utilization: < 70%

**Network:**
- Bandwidth: 10 Mbps minimum
- Connections: Max 100 concurrent

---

## 8. Observability

### 8.1 Metrics (Prometheus Format)

**Message Processing Metrics:**
```
# Counter: Total messages processed
outbound_messages_processed_total{tenant_id="", type="text|image|video|document|audio", status="success|failure"}

# Counter: Invalid messages
outbound_invalid_messages_total{reason="invalid_json|missing_field|validation_error"}

# Counter: Duplicate messages
outbound_duplicate_messages_total{tenant_id=""}

# Counter: Media messages processed
outbound_media_processed_total{tenant_id="", media_type="image|video|document|audio"}

# Counter: Transformation failures
outbound_transformation_failures_total{tenant_id="", error_type=""}

# Counter: Dispatch failures
outbound_dispatch_failures_total{tenant_id="", error_type=""}

# Counter: DLQ messages
outbound_dlq_messages_total{tenant_id="", error_type=""}

# Counter: Cache errors
outbound_cache_errors_total{operation="get|set|delete"}

# Histogram: Transformation latency
outbound_transformation_latency_seconds{type="text|media"}

# Histogram: End-to-end latency
outbound_e2e_latency_seconds{type="text|media"}

# Gauge: Current queue depth
outbound_queue_depth{queue="outbound-processed|outbound-ready|outbound-transformer-dlq"}
```

### 8.2 Structured Logging

**Log Levels:**
- DEBUG: Detailed transformation steps
- INFO: Successful processing, dispatch
- WARN: Retries, degraded operation
- ERROR: Failed transformations, unrecoverable errors

**Required Fields in All Logs:**
```json
{
  "timestamp": "ISO-8601",
  "level": "INFO|WARN|ERROR",
  "service": "outbound-transformer",
  "version": "1.2.0",
  "tenant_id": "",
  "internal_id": "",
  "wa_id": "",
  "correlation_id": "",
  "message": "",
  "context": {}
}
```

### 8.3 Health Check Endpoint

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy|degraded|unhealthy",
  "version": "1.2.0",
  "checks": {
    "rabbitmq": {
      "status": "healthy",
      "latency_ms": 5
    },
    "redis": {
      "status": "healthy",
      "latency_ms": 2
    },
    "storage": {
      "status": "healthy",
      "latency_ms": 10
    }
  },
  "metrics": {
    "messages_processed_last_minute": 150,
    "avg_latency_ms": 25,
    "error_rate_percent": 0.5
  }
}
```

---

## 9. Implementation Guidelines

### 9.1 Code Structure Recommendations

```
outbound-transformer/
├── src/
│   ├── main.py                 # Application entry point
│   ├── config.py               # Configuration management
│   ├── models/
│   │   ├── input_message.py    # Input schema models
│   │   └── output_message.py   # Output schema models
│   ├── services/
│   │   ├── consumer.py         # RabbitMQ consumer
│   │   ├── transformer.py      # Core transformation logic
│   │   ├── validator.py        # Validation logic
│   │   ├── media_handler.py    # Media URL handling
│   │   ├── dispatcher.py       # Message dispatch
│   │   └── idempotency.py      # Idempotency cache
│   ├── utils/
│   │   ├── logger.py           # Structured logging
│   │   ├── metrics.py          # Prometheus metrics
│   │   └── url_utils.py        # URL parsing/validation
│   └── tests/
│       ├── unit/
│       └── integration/
├── config/
│   ├── config.yaml             # Configuration file
│   └── mime_types.yaml         # MIME type mappings
├── docker/
│   └── Dockerfile
├── kubernetes/
│   ├── deployment.yaml
│   └── service.yaml
└── README.md
```

### 9.2 Configuration Management

**Environment Variables:**
```bash
# RabbitMQ
RABBITMQ_HOST=rabbitmq.default.svc.cluster.local
RABBITMQ_PORT=5672
RABBITMQ_USER=transformer
RABBITMQ_PASSWORD=***
RABBITMQ_VHOST=/
RABBITMQ_PREFETCH_COUNT=10

# Queues
QUEUE_INPUT=outbound-processed
QUEUE_OUTPUT=outbound-ready
QUEUE_DLQ=outbound-transformer-dlq

# Redis
REDIS_HOST=redis.default.svc.cluster.local
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=***
IDEMPOTENCY_TTL_SECONDS=86400

# Storage
STORAGE_TYPE=minio  # or s3
STORAGE_ENDPOINT=https://minio.example.com
STORAGE_ACCESS_KEY=***
STORAGE_SECRET_KEY=***
SIGNED_URL_EXPIRATION_SECONDS=600

# WhatsApp API (for pipeline mode)
WHATSAPP_API_BASE_URL=http://whatsapp-api-service:8080
PIPELINE_MODE_ENABLED=false

# Behavior Configuration
UNSUPPORTED_MIME_BEHAVIOR=reject  # reject|convert_to_document|text_fallback
AUDIO_TEXT_BEHAVIOR=separate_message  # separate_message|discard_text|text_only
VALIDATE_URL_ACCESSIBILITY=false
ENFORCE_SESSION_WINDOW=false

# Performance
MAX_RETRIES=3
WORKER_THREADS=10
MAX_MESSAGE_BUFFER_SIZE=100

# Observability
LOG_LEVEL=INFO
METRICS_PORT=9090
HEALTH_CHECK_PORT=8080

# Alerts
ALERT_ON_DLQ=true
```

### 9.3 Testing Strategy

**Unit Tests:**
- Input validation logic
- Transformation logic (text, media)
- MIME type mapping
- URL validation and transformation
- Idempotency checking
- Error handling

**Integration Tests:**
- RabbitMQ message flow
- Redis cache operations
- Storage signed URL generation
- End-to-end transformation pipeline

**Test Cases to Cover:**
```python
# Pseudo test cases
def test_text_message_transformation():
    """Test basic text message transformation"""
    
def test_image_with_caption():
    """Test image message with caption"""
    
def test_document_without_filename():
    """Test document with auto-generated filename"""
    
def test_audio_with_text_separate_message():
    """Test audio + text creates two messages"""
    
def test_unsupported_mime_type_rejection():
    """Test unsupported MIME type is rejected"""
    
def test_internal_url_signed_url_generation():
    """Test internal URL converts to signed URL"""
    
def test_private_ip_rejection():
    """Test URLs resolving to private IPs are rejected"""
    
def test_idempotency_duplicate_detection():
    """Test duplicate messages are ACKed without processing"""
    
def test_max_retries_route_to_dlq():
    """Test failures route to DLQ after max retries"""
    
def test_text_exceeds_max_length():
    """Test text over 4096 chars is rejected"""
    
def test_empty_text_and_no_media_rejection():
    """Test messages with neither text nor media are rejected"""
```

### 9.4 Deployment Checklist

**Pre-Deployment:**
- [ ] Configuration files reviewed and validated
- [ ] RabbitMQ queues created
- [ ] Redis cache accessible
- [ ] Storage credentials configured
- [ ] Metrics endpoint accessible
- [ ] Health check endpoint responding
- [ ] Unit tests passing (100% coverage for core logic)
- [ ] Integration tests passing

**Post-Deployment:**
- [ ] Monitor metrics dashboard
- [ ] Check DLQ for unexpected messages
- [ ] Verify latency targets met
- [ ] Confirm no memory leaks (monitor over 24h)
- [ ] Test graceful shutdown
- [ ] Validate idempotency across restarts

### 9.5 Operational Runbook

**Common Issues:**

| Issue | Diagnosis | Resolution |
|-------|-----------|------------|
| High DLQ rate | Check DLQ messages for patterns | Fix upstream data issues or adjust validation |
| Redis connection errors | Check Redis health | Restart Redis, check network |
| Slow transformation | Check signed URL generation time | Optimize storage client, increase timeout |
| Queue backlog | Check consumer lag | Scale up instances |
| Memory growth | Check for leaks | Review message buffering, restart service |

**Monitoring Dashboards:**
- Message throughput (msg/sec)
- Latency percentiles (p50, p95, p99)
- Error rates by type
- DLQ depth
- Cache hit rate
- Queue depth

---

## 10. Security Considerations

### 10.1 Secrets Management
- Store credentials in secrets manager (Kubernetes Secrets, AWS Secrets Manager)
- Rotate credentials regularly
- Never log credentials or tokens

### 10.2 URL Validation
- Prevent SSRF attacks via private IP blocking
- Validate URL schemes (HTTPS only)
- Consider URL allow-listing for extra security

### 10.3 Data Privacy
- Log minimal PII (hash `waId` in logs if required)
- Respect GDPR/data retention policies
- Secure signed URLs with short expiration

---

## Appendix A: Complete MIME Type Support Matrix

| MIME Type | WhatsApp Type | Max Size | File Extensions | Notes |
|-----------|---------------|----------|----------------|-------|
| `image/jpeg` | image | 5 MB | .jpg, .jpeg | Recommended |
| `image/png` | image | 5 MB | .png | Recommended |
| `image/webp` | image | 5 MB | .webp | Supported |
| `video/mp4` | video | 16 MB | .mp4 | H.264 codec |
| `video/3gpp` | video | 16 MB | .3gp | Basic support |
| `application/pdf` | document | 100 MB | .pdf | Most common |
| `application/vnd.ms-powerpoint` | document | 100 MB | .ppt | Office 97-2003 |
| `application/vnd.openxmlformats-officedocument.presentationml.presentation` | document | 100 MB | .pptx | Office 2007+ |
| `application/msword` | document | 100 MB | .doc | Office 97-2003 |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | document | 100 MB | .docx | Office 2007+ |
| `application/vnd.ms-excel` | document | 100 MB | .xls | Office 97-2003 |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | document | 100 MB | .xlsx | Office 2007+ |
| `text/plain` | document | 100 MB | .txt | Plain text |
| `text/csv` | document | 100 MB | .csv | CSV files |
| `audio/aac` | audio | 16 MB | .aac | Recommended |
| `audio/mp4` | audio | 16 MB | .m4a | M4A format |
| `audio/mpeg` | audio | 16 MB | .mp3 | MP3 format |
| `audio/amr` | audio | 16 MB | .amr | AMR format |
| `audio/ogg` | audio | 16 MB | .ogg | Opus codec |

---

## Appendix B: Error Code Reference

| Error Code | Description | Category | User Action |
|------------|-------------|----------|-------------|
| `E001` | Invalid JSON format | Client | Fix message format |
| `E002` | Missing required field | Client | Add required field |
| `E003` | Invalid UUID format | Client | Use valid UUID v4 |
| `E004` | Invalid WhatsApp ID format | Client | Use E.164 format |
| `E005` | Text exceeds max length | Validation | Shorten text to 4096 chars |
| `E006` | Empty message (no text or media) | Validation | Add content |
| `E007` | Unsupported MIME type | Validation | Use supported media type |
| `E008` | Invalid media URL | Validation | Provide valid HTTPS URL |
| `E009` | Private IP in URL | Validation | Use public URL |
| `E010` | Redis connection failure | Transient | Retry |
| `E011` | Storage service unavailable | Transient | Retry |
| `E012` | Downstream service timeout | Transient | Retry |
| `E013` | Unknown transformation error | Internal | Contact support |

---

This document provides comprehensive specifications for implementing the Outbound Transformer Service with all necessary details for code generation, debugging, and operational management.
--- END outbound-transformer/outbound-tranformer-frd.md ---


--- BEGIN state-manager/state-manager-frd.md ---

# State Manager Service - Technical Specification (MVP)

## Document Purpose
This document defines the State Manager Service, a critical component in the XYPR middleware that acts as the **single source of truth** for conversation state and message lifecycle tracking in WhatsApp-to-Genesys integrations.

---

## System Context

### What This Service Does
The State Manager maintains bidirectional mappings between:
- **WhatsApp users** (identified by `wa_id`) 
- **Genesys conversations** (identified by `conversation_id`)

### Why This Service Exists
**Problem**: When a WhatsApp user sends a message, we need to:
1. Determine if they have an active conversation in Genesys
2. Route subsequent messages to the same conversation
3. Prevent creating duplicate conversations
4. Track every message through its entire lifecycle

**Solution**: This service provides atomic, transactional mapping operations with built-in concurrency controls.

### Architecture Pattern
- **Compute**: Stateless workers (horizontally scalable)
- **State**: Persistent (PostgreSQL) + Cached (Redis)
- **Communication**: Event-driven via RabbitMQ queues
- **Multi-tenancy**: Physical database isolation (separate PostgreSQL database per tenant)

### MVP Scope
- **Single Tenant**: The MVP deployment serves one tenant only
- **Physical Isolation**: Each tenant gets dedicated database infrastructure
- **No tenant_id columns**: Tenant context is determined by database connection, not data columns

---

## Core Data Model

### Entity: Conversation Mapping

**Purpose**: Links one WhatsApp user to one active Genesys conversation.

**Lifecycle**:
```
1. Created: When first inbound message arrives from a wa_id
2. Correlated: When Genesys returns conversationId after conversation creation
3. Active: While messages are being exchanged
4. Expired: After 24 hours of inactivity
```

**Schema**: `conversation_mappings` table

| Column | Type | Purpose | Constraints |
|--------|------|---------|-------------|
| `id` | UUID | Primary key | NOT NULL, PK |
| `wa_id` | VARCHAR | WhatsApp user identifier (phone number format) | NOT NULL, INDEXED |
| `conversation_id` | VARCHAR | Genesys conversation UUID | NULL initially, INDEXED |
| `communication_id` | VARCHAR | Genesys communication session ID | NULLABLE |
| `last_message_id` | VARCHAR | Most recent WhatsApp message ID (wamid) | NULLABLE, INDEXED |
| `contact_name` | VARCHAR | WhatsApp user's display name | NULLABLE |
| `status` | VARCHAR | Enum: 'active', 'closed', 'expired' | NOT NULL |
| `last_activity_at` | TIMESTAMP | Last message timestamp (for TTL) | NOT NULL, INDEXED |
| `created_at` | TIMESTAMP | Record creation time | NOT NULL |
| `updated_at` | TIMESTAMP | Last modification time | NOT NULL |

**Critical Business Rule - Enforced by Database Constraint**:
```sql
UNIQUE (wa_id) WHERE status = 'active'
```
**Meaning**: A WhatsApp user can have only ONE active conversation at any time.

**DDL**:
```sql
CREATE TABLE conversation_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_id VARCHAR(50) NOT NULL,
    conversation_id VARCHAR(100),
    communication_id VARCHAR(100),
    last_message_id VARCHAR(255),
    contact_name VARCHAR(255),
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'closed', 'expired')),
    last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_unique_active_mapping 
ON conversation_mappings (wa_id) 
WHERE status = 'active';

CREATE INDEX idx_wa_id ON conversation_mappings (wa_id);
CREATE INDEX idx_conversation_id ON conversation_mappings (conversation_id);
CREATE INDEX idx_last_message_id ON conversation_mappings (last_message_id);
CREATE INDEX idx_last_activity ON conversation_mappings (last_activity_at);
CREATE INDEX idx_status ON conversation_mappings (status);
```

---

### Entity: Message Tracking

**Purpose**: Audit trail for every message flowing through the system.

**Schema**: `message_tracking` table

| Column | Type | Purpose | Constraints |
|--------|------|---------|-------------|
| `id` | UUID | Primary key | NOT NULL, PK |
| `mapping_id` | UUID | Link to conversation mapping | NOT NULL, FK |
| `wamid` | VARCHAR | WhatsApp message ID (globally unique) | NOT NULL, UNIQUE, INDEXED |
| `genesys_id` | VARCHAR | Genesys message identifier | NULLABLE, INDEXED |
| `direction` | VARCHAR | 'INBOUND' or 'OUTBOUND' | NOT NULL |
| `status` | VARCHAR | Current delivery state (see state machine) | NOT NULL |
| `media_url` | TEXT | MinIO/S3 URL if message contains media | NULLABLE |
| `created_at` | TIMESTAMP | First insertion time | NOT NULL |
| `updated_at` | TIMESTAMP | Last status update time | NOT NULL |

**Idempotency Key**: `wamid` (WhatsApp message ID)
- Prevents duplicate message logging
- Multiple webhook deliveries of same message → single tracking record

**DDL**:
```sql
CREATE TABLE message_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapping_id UUID NOT NULL REFERENCES conversation_mappings(id) ON DELETE CASCADE,
    wamid VARCHAR(255) NOT NULL UNIQUE,
    genesys_id VARCHAR(100),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    status VARCHAR(20) NOT NULL,
    media_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_wamid ON message_tracking (wamid);
CREATE INDEX idx_mapping_id ON message_tracking (mapping_id);
CREATE INDEX idx_genesys_id ON message_tracking (genesys_id);
CREATE INDEX idx_direction ON message_tracking (direction);
CREATE INDEX idx_status ON message_tracking (status);
CREATE INDEX idx_created_at ON message_tracking (created_at);
```

---

## Message Status State Machine

### Purpose
Ensures message status progresses logically and prevents invalid state transitions.

### Outbound Messages (Middleware → WhatsApp)
```
queued → sent → delivered → read
   ↓
failed (terminal state, can occur from any prior state)
```

### Inbound Messages (WhatsApp → Middleware)
```
received → processed
    ↓
  failed (terminal state)
```

### Rules
1. **Forward-only**: Cannot regress to a previous state
2. **Validation**: Reject updates that violate the state sequence
3. **Idempotent**: Duplicate status updates with same value are ignored (log but don't error)
4. **Timestamp check**: Ignore updates older than current `updated_at`

**Example Valid Sequence**:
```
queued → sent → delivered → read ✅
```

**Example Invalid Sequences**:
```
delivered → sent ❌ (regression)
queued → read ❌ (skipped states)
```

**State Transition Map** (for validation logic):
```python
STATE_TRANSITIONS = {
    'queued': ['sent', 'failed'],
    'sent': ['delivered', 'failed'],
    'delivered': ['read', 'failed'],
    'read': [],  # terminal state
    'failed': [],  # terminal state
    'received': ['processed', 'failed'],
    'processed': []  # terminal state
}

def is_valid_transition(current_status: str, new_status: str) -> bool:
    """Check if status transition is allowed"""
    if current_status == new_status:
        return True  # Idempotent update
    return new_status in STATE_TRANSITIONS.get(current_status, [])
```

---

## Caching Strategy (Redis)

### Why Redis?
- **Performance**: Sub-10ms lookups vs 20-50ms database queries
- **High throughput**: Handles 1000s of concurrent message resolutions
- **Graceful degradation**: Service continues if Redis fails (DB fallback)

### Cache Keys

#### 1. WhatsApp → Genesys Lookup
**Key**: `mapping:wa:{wa_id}`  
**Value** (JSON):
```json
{
  "conversation_id": "abc-123",
  "internal_mapping_id": "uuid-456",
  "last_activity_at": "2025-01-15T10:30:00Z"
}
```
**TTL**: 24 hours (refreshed on each message)

#### 2. Genesys → WhatsApp Lookup
**Key**: `mapping:conv:{conversation_id}`  
**Value** (JSON):
```json
{
  "wa_id": "919876543210",
  "internal_mapping_id": "uuid-456"
}
```
**TTL**: 24 hours (refreshed on each message)

### Cache Invalidation Strategy
- **TTL-based**: Auto-expire after 24 hours of inactivity
- **Explicit deletion**: When mapping status changes to 'expired' or 'closed'
- **Write-through**: Update Redis immediately when database is updated

### Cache Operation Patterns

**Pattern 1: Read-Through**
```python
def get_mapping_by_wa_id(wa_id: str) -> Optional[dict]:
    # Try cache first
    cache_key = f"mapping:wa:{wa_id}"
    cached = redis.get(cache_key)
    
    if cached:
        return json.loads(cached)
    
    # Cache miss - query database
    mapping = db.query(
        "SELECT * FROM conversation_mappings WHERE wa_id = $1 AND status = 'active'",
        wa_id
    )
    
    if mapping:
        # Populate cache
        redis.setex(cache_key, 86400, json.dumps(mapping))
    
    return mapping
```

**Pattern 2: Write-Through**
```python
def update_conversation_id(mapping_id: str, conversation_id: str, wa_id: str):
    # Update database
    db.execute(
        "UPDATE conversation_mappings SET conversation_id = $1 WHERE id = $2",
        conversation_id, mapping_id
    )
    
    # Update cache immediately
    mapping = db.query("SELECT * FROM conversation_mappings WHERE id = $1", mapping_id)
    redis.setex(f"mapping:wa:{wa_id}", 86400, json.dumps(mapping))
    redis.setex(f"mapping:conv:{conversation_id}", 86400, json.dumps(mapping))
```

---

## Core Operations

### Operation 1: Inbound Message - Identity Resolution

**Trigger**: Message arrives from WhatsApp via RabbitMQ `inboundQueue`

**Input Payload**:
```json
{
  "wa_id": "919876543210",
  "wamid": "wamid.HBgNMTIzNDU2Nzg5MBUCABIYFjNFQjBDRkQ1RkE5M0U3QTcyNzY5",
  "message_text": "Hello, I need help",
  "contact_name": "John Doe",
  "timestamp": "2025-01-15T10:30:00Z",
  "media_url": "https://minio.internal/media/abc123.jpg"
}
```

**Processing Steps**:

1. **Validation**
   - Verify `wa_id` is valid phone number format (E.164)
   - If `media_url` present, validate it's from allowed domains (MinIO only)

2. **Distributed Lock Acquisition**
   - Acquire Redis lock: `lock:mapping:{wa_id}`
   - TTL: 5 seconds (prevents deadlock)
   - Retry: 3 attempts with 100ms delay
   - **Purpose**: Prevents race condition when multiple messages arrive simultaneously from same user

3. **Mapping Lookup** (Cache-first pattern)
   ```python
   # Check cache
   cache_key = f"mapping:wa:{wa_id}"
   cached_mapping = redis.get(cache_key)
   
   if cached_mapping:
       mapping = json.loads(cached_mapping)
   else:
       # Database fallback
       mapping = db.query("""
           SELECT * FROM conversation_mappings 
           WHERE wa_id = $1 AND status = 'active'
       """, wa_id)
       
       if mapping:
           # Populate cache
           redis.setex(cache_key, 86400, json.dumps(mapping))
   ```

4. **Mapping Creation** (if not found)
   ```sql
   INSERT INTO conversation_mappings (
     id, wa_id, last_message_id, contact_name, 
     status, last_activity_at, created_at, updated_at
   ) VALUES (
     gen_random_uuid(), $1, $2, $3,
     'active', NOW(), NOW(), NOW()
   )
   ON CONFLICT (wa_id) WHERE status = 'active'
   DO NOTHING
   RETURNING id, conversation_id;
   ```
   **Parameters**:
   - `$1` = wa_id
   - `$2` = wamid
   - `$3` = contact_name
   
   **Note**: `conversation_id` is NULL at this point (will be set later by Operation 5)

5. **Message Tracking** (Idempotent insert)
   ```sql
   INSERT INTO message_tracking (
     id, mapping_id, wamid, direction, status, media_url, created_at, updated_at
   ) VALUES (
     gen_random_uuid(), $1, $2, 'INBOUND', 'received', $3, NOW(), NOW()
   )
   ON CONFLICT (wamid) DO NOTHING
   RETURNING id;
   ```
   **Parameters**:
   - `$1` = mapping_id
   - `$2` = wamid
   - `$3` = media_url (or NULL)

6. **Update Activity Timestamp**
   ```sql
   UPDATE conversation_mappings 
   SET last_activity_at = NOW(), 
       last_message_id = $1,
       updated_at = NOW()
   WHERE id = $2;
   ```

7. **Cache Population**
   ```python
   cache_data = {
       "conversation_id": mapping.conversation_id,
       "internal_mapping_id": mapping.id,
       "last_activity_at": mapping.last_activity_at.isoformat()
   }
   redis.setex(f"mapping:wa:{wa_id}", 86400, json.dumps(cache_data))
   ```

8. **Lock Release**
   ```python
   redis.delete(f"lock:mapping:{wa_id}")
   ```

9. **Forward to Next Queue**
   - Publish enriched message to `inbound-processed` queue

**Output Payload** (enriched):
```json
{
  "wa_id": "919876543210",
  "wamid": "wamid.HBgNMTIzNDU2Nzg5MBUCABIYFjNFQjBDRkQ1RkE5M0U3QTcyNzY5",
  "message_text": "Hello, I need help",
  "contact_name": "John Doe",
  "timestamp": "2025-01-15T10:30:00Z",
  "media_url": "https://minio.internal/media/abc123.jpg",
  "mapping_id": "uuid-456",
  "conversation_id": "abc-123",
  "is_new_conversation": true
}
```

**Idempotency Guarantee**:
- If `wamid` already exists in `message_tracking`, the ON CONFLICT clause prevents duplicate insertion
- Log a warning but continue processing (don't fail the message)

**Error Handling**:
```python
try:
    # Process message
    pass
except LockAcquisitionFailed:
    # Could not acquire lock after 3 retries
    # Send to DLQ with reason: "lock_timeout"
    logger.error(f"Failed to acquire lock for wa_id={wa_id}")
    send_to_dlq(message, reason="lock_timeout")
except DatabaseError as e:
    # Database unavailable
    # Reject message back to queue for retry
    logger.error(f"Database error: {e}")
    raise  # RabbitMQ will requeue
```

---

### Operation 2: Outbound Message - Identity Resolution

**Trigger**: Message needs to be sent from Genesys to WhatsApp via RabbitMQ `outboundQueue`

**Input Payload**:
```json
{
  "conversation_id": "abc-123",
  "genesys_message_id": "msg-xyz",
  "message_text": "Thank you for contacting us",
  "media_url": null
}
```

**Processing Steps**:

1. **Validation**
   - Verify `conversation_id` is not null/empty
   - Verify `conversation_id` is valid UUID format

2. **Mapping Lookup** (Cache-first)
   ```python
   # Check cache
   cache_key = f"mapping:conv:{conversation_id}"
   cached_mapping = redis.get(cache_key)
   
   if cached_mapping:
       mapping = json.loads(cached_mapping)
   else:
       # Database fallback
       mapping = db.query("""
           SELECT * FROM conversation_mappings
           WHERE conversation_id = $1 AND status = 'active'
       """, conversation_id)
       
       if mapping:
           # Populate cache
           redis.setex(cache_key, 86400, json.dumps(mapping))
   ```

3. **Error Handling - Mapping Not Found**
   ```python
   if not mapping:
       logger.error(f"No active mapping found for conversation_id={conversation_id}")
       send_to_dlq(message, reason="mapping_not_found")
       return
   ```

4. **Status Validation**
   ```python
   if mapping['status'] != 'active':
       logger.warning(f"Mapping status is {mapping['status']}, not active")
       send_to_dlq(message, reason=f"mapping_status_{mapping['status']}")
       return
   ```

5. **Message Tracking**
   ```sql
   INSERT INTO message_tracking (
     id, mapping_id, genesys_id, direction, status, media_url, created_at, updated_at
   ) VALUES (
     gen_random_uuid(), $1, $2, 'OUTBOUND', 'queued', $3, NOW(), NOW()
   )
   RETURNING id;
   ```

6. **Update Activity Timestamp**
   ```sql
   UPDATE conversation_mappings
   SET last_activity_at = NOW(),
       updated_at = NOW()
   WHERE id = $1;
   ```

7. **Refresh Cache TTL**
   ```python
   # Extend TTL on both cache keys
   redis.expire(f"mapping:wa:{mapping['wa_id']}", 86400)
   redis.expire(f"mapping:conv:{conversation_id}", 86400)
   ```

8. **Forward to WhatsApp Queue**
   - Publish to `outbound-processed` queue with `wa_id` attached

**Output Payload** (enriched):
```json
{
  "conversation_id": "abc-123",
  "genesys_message_id": "msg-xyz",
  "message_text": "Thank you for contacting us",
  "media_url": null,
  "wa_id": "919876543210",
  "mapping_id": "uuid-456"
}
```

---

### Operation 3: Message Status Update (from WhatsApp)

**Trigger**: WhatsApp webhook delivers status update via RabbitMQ `statusQueue`

**Input Payload**:
```json
{
  "wamid": "wamid.HBgNMTIzNDU2Nzg5MBUCABIYFjNFQjBDRkQ1RkE5M0U3QTcyNzY5",
  "status": "delivered",
  "timestamp": "2025-01-15T10:31:00Z"
}
```

**Processing Steps**:

1. **Locate Message**
   ```sql
   SELECT id, status, updated_at, direction, mapping_id
   FROM message_tracking
   WHERE wamid = $1;
   ```

2. **Handle Unknown Message**
   ```python
   if not message:
       logger.warning(f"Status update for unknown wamid={wamid}, ignoring")
       return  # Not an error - might be from before system deployment
   ```

3. **Validate State Transition**
   ```python
   if not is_valid_transition(message['status'], new_status):
       logger.warning(
           f"Invalid state transition for wamid={wamid}: "
           f"{message['status']} -> {new_status}"
       )
       return  # Don't update, don't error
   ```

4. **Timestamp Check (prevent stale updates)**
   ```python
   event_timestamp = datetime.fromisoformat(event['timestamp'])
   if event_timestamp <= message['updated_at']:
       logger.info(f"Ignoring stale status update for wamid={wamid}")
       return
   ```

5. **Update Status (Atomic)**
   ```sql
   UPDATE message_tracking
   SET status = $1, 
       updated_at = $2
   WHERE id = $3 
     AND status = $4  -- Optimistic locking
   RETURNING id;
   ```
   **Parameters**:
   - `$1` = new_status
   - `$2` = event_timestamp
   - `$3` = message_id
   - `$4` = current_status

6. **Check Update Result**
   ```python
   if rows_affected == 0:
       # Status changed between SELECT and UPDATE (race condition)
       logger.info(f"Message status already updated for wamid={wamid}")
   ```

7. **Optional: Publish State Change Event**
   ```python
   if rows_affected > 0:
       publish_event("state.message.updated", {
           "wamid": wamid,
           "old_status": current_status,
           "new_status": new_status,
           "timestamp": event_timestamp
       })
   ```

**Error Cases**:
- Unknown wamid → Log warning, continue (not an error)
- Invalid state transition → Log warning, skip update
- Stale event → Log info, skip update
- Database error → Raise exception (RabbitMQ will requeue)

---

### Operation 4: Message Status Update (from Genesys)

**Trigger**: Genesys webhook or polling detects message status change

**Input Payload**:
```json
{
  "genesys_message_id": "msg-xyz",
  "conversation_id": "abc-123",
  "status": "processed",
  "timestamp": "2025-01-15T10:31:30Z"
}
```

**Processing Steps**: (Similar to Operation 3, but query by `genesys_id`)

```sql
SELECT id, status, updated_at, direction, mapping_id
FROM message_tracking
WHERE genesys_id = $1;
```

**Note**: Genesys status updates apply to INBOUND messages only (`direction = 'INBOUND'`)

---

### Operation 5: Conversation ID Correlation

**Trigger**: Genesys API successfully creates a conversation and returns the `conversation_id`

**Context**: When an inbound message arrives, we create a mapping with `conversation_id = NULL`. After Genesys creates the conversation, we need to update our mapping with the actual conversation ID.

**Input Payload**:
```json
{
  "conversation_id": "abc-123",
  "communication_id": "comm-456",
  "whatsapp_message_id": "wamid.HBgNMTIzNDU2Nzg5MBUCABIYFjNFQjBDRkQ1RkE5M0U3QTcyNzY5"
}
```

**Processing Steps**:

1. **Update Mapping (Idempotent)**
   ```sql
   UPDATE conversation_mappings
   SET 
     conversation_id = $1,
     communication_id = $2,
     updated_at = NOW()
   WHERE 
     last_message_id = $3
     AND conversation_id IS NULL
   RETURNING id, wa_id;
   ```
   **Parameters**:
   - `$1` = conversation_id
   - `$2` = communication_id
   - `$3` = whatsapp_message_id

2. **Check Update Result**
   ```python
   if rows_affected == 0:
       # conversation_id already set (duplicate webhook)
       logger.info(
           f"Conversation ID already set for wamid={whatsapp_message_id}, "
           f"ignoring duplicate correlation"
       )
       return
   ```

3. **Cache Population (Both Keys)**
   ```python
   mapping = fetch_mapping_by_id(mapping_id)
   
   # WhatsApp → Genesys lookup
   cache_data_wa = {
       "conversation_id": conversation_id,
       "internal_mapping_id": mapping_id,
       "last_activity_at": mapping['last_activity_at'].isoformat()
   }
   redis.setex(f"mapping:wa:{wa_id}", 86400, json.dumps(cache_data_wa))
   
   # Genesys → WhatsApp lookup
   cache_data_conv = {
       "wa_id": wa_id,
       "internal_mapping_id": mapping_id
   }
   redis.setex(f"mapping:conv:{conversation_id}", 86400, json.dumps(cache_data_conv))
   ```

4. **Optional: Publish Correlation Event**
   ```python
   publish_event("state.conversation.correlated", {
       "wa_id": wa_id,
       "conversation_id": conversation_id,
       "communication_id": communication_id
   })
   ```

**Why This Matters**: This operation "closes the loop" between WhatsApp and Genesys, enabling bidirectional message routing.

**Idempotency**: The `WHERE conversation_id IS NULL` clause ensures duplicate correlation attempts are safely ignored.

---

## Conversation Lifecycle Management

### Auto-Expiry Policy

**Rule**: Conversations expire after 24 hours of inactivity

**Background Job**: `ConversationExpiryJob`

**Frequency**: Runs every 5 minutes

**Detection Query**:
```sql
SELECT id, wa_id, conversation_id
FROM conversation_mappings
WHERE status = 'active'
  AND last_activity_at < NOW() - INTERVAL '24 hours'
LIMIT 1000;  -- Process in batches
```

**Expiry Process**:
```sql
UPDATE conversation_mappings
SET status = 'expired', 
    updated_at = NOW()
WHERE id = ANY($1::uuid[]);
```

**Cache Cleanup**:
```python
for mapping in expired_mappings:
    redis.delete(f"mapping:wa:{mapping['wa_id']}")
    if mapping['conversation_id']:
        redis.delete(f"mapping:conv:{mapping['conversation_id']}")
```

**Logging**:
```python
logger.info(
    f"Expired {len(expired_mappings)} conversations",
    extra={
        "expired_count": len(expired_mappings),
        "oldest_activity": min(m['last_activity_at'] for m in expired_mappings)
    }
)
```

**Behavior After Expiry**:
- Next inbound message from same `wa_id` creates a NEW conversation
- This prevents stale conversations from accumulating
- Historical data remains in database for audit purposes

**Monitoring**:
- Metric: `conversations_expired_total` (counter)
- Metric: `conversations_expired_last_run` (gauge)
- Alert: If no expirations happen for 24 hours (job might be stuck)

---

## API Endpoints

### 1. GET /mapping/wa/:waId

**Purpose**: Retrieve conversation mapping by WhatsApp user ID

**Example Request**:
```
GET /mapping/wa/919876543210
```

**Response** (200 OK):
```json
{
  "conversationId": "abc-123",
  "waId": "919876543210",
  "isNew": false,
  "internalId": "uuid-456",
  "status": "active",
  "lastActivityAt": "2025-01-15T10:30:00Z",
  "communicationId": "comm-456"
}
```

**Response** (404 Not Found):
```json
{
  "error": "No active mapping found",
  "waId": "919876543210"
}
```

**Implementation**:
```python
@app.get("/mapping/wa/{wa_id}")
def get_mapping_by_wa_id(wa_id: str):
    # Try cache first
    cached = redis.get(f"mapping:wa:{wa_id}")
    if cached:
        data = json.loads(cached)
        mapping = db.query("SELECT * FROM conversation_mappings WHERE id = $1", 
                          data['internal_mapping_id'])
    else:
        # Database fallback
        mapping = db.query(
            "SELECT * FROM conversation_mappings WHERE wa_id = $1 AND status = 'active'",
            wa_id
        )
    
    if not mapping:
        return JSONResponse(status_code=404, content={"error": "No active mapping found"})
    
    return {
        "conversationId": mapping['conversation_id'],
        "waId": mapping['wa_id'],
        "isNew": mapping['conversation_id'] is None,
        "internalId": mapping['id'],
        "status": mapping['status'],
        "lastActivityAt": mapping['last_activity_at'].isoformat(),
        "communicationId": mapping['communication_id']
    }
```

---

### 2. GET /mapping/conv/:conversationId

**Purpose**: Retrieve WhatsApp user ID by Genesys conversation ID

**Example Request**:
```
GET /mapping/conv/abc-123
```

**Response** (200 OK):
```json
{
  "waId": "919876543210",
  "internalId": "uuid-456",
  "status": "active",
  "communicationId": "comm-456",
  "lastActivityAt": "2025-01-15T10:30:00Z"
}
```

**Response** (404 Not Found):
```json
{
  "error": "No mapping found for conversation",
  "conversationId": "abc-123"
}
```

**Implementation**:
```python
@app.get("/mapping/conv/{conversation_id}")
def get_mapping_by_conversation_id(conversation_id: str):
    # Try cache first
    cached = redis.get(f"mapping:conv:{conversation_id}")
    if cached:
        data = json.loads(cached)
        mapping = db.query("SELECT * FROM conversation_mappings WHERE id = $1", 
                          data['internal_mapping_id'])
    else:
        # Database fallback
        mapping = db.query(
            "SELECT * FROM conversation_mappings WHERE conversation_id = $1 AND status = 'active'",
            conversation_id
        )
    
    if not mapping:
        return JSONResponse(status_code=404, content={"error": "No mapping found"})
    
    return {
        "waId": mapping['wa_id'],
        "internalId": mapping['id'],
        "status": mapping['status'],
        "communicationId": mapping['communication_id'],
        "lastActivityAt": mapping['last_activity_at'].isoformat()
    }
```

---

### 3. POST /messages

**Purpose**: Manual message tracking (fallback/testing endpoint)

**Request Body**:
```json
{
  "mappingId": "uuid-456",
  "wamid": "wamid.xxx",
  "genesysId": "msg-xyz",
  "direction": "INBOUND",
  "status": "received",
  "mediaUrl": null
}
```

**Response** (201 Created):
```json
{
  "id": "msg-tracking-uuid",
  "created": true
}
```

**Response** (409 Conflict) - Duplicate wamid:
```json
{
  "error": "Message already tracked",
  "wamid": "wamid.xxx",
  "existingId": "existing-uuid"
}
```

---

### 4. PATCH /messages/:wamid

**Purpose**: Update message status with validation

**Request Body**:
```json
{
  "status": "delivered",
  "timestamp": "2025-01-15T10:31:00Z"
}
```

**Response** (200 OK):
```json
{
  "updated": true,
  "previousStatus": "sent",
  "newStatus": "delivered",
  "messageId": "msg-tracking-uuid"
}
```

**Response** (400 Bad Request) - Invalid transition:
```json
{
  "error": "Invalid state transition",
  "currentStatus": "delivered",
  "attemptedStatus": "sent",
  "validNextStates": ["read", "failed"]
}
```

**Response** (404 Not Found):
```json
{
  "error": "Message not found",
  "wamid": "wamid.xxx"
}
```

---

### 5. GET /health

**Purpose**: Health check endpoint for load balancer

**Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "checks": {
    "database": {
      "status": "ok",
      "latency_ms": 3
    },
    "redis": {
      "status": "ok",
      "latency_ms": 1
    },
    "rabbitmq": {
      "status": "ok",
      "queue_depth": 45
    }
  },
  "uptime_seconds": 86400
}
```

**Response** (503 Service Unavailable) - Database down:
```json
{
  "status": "unhealthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "checks": {
    "database": {
      "status": "error",
      "error": "Connection refused"
    },
    "redis": {
      "status": "ok"
    },
    "rabbitmq": {
      "status": "ok"
    }
  }
}
```

---

## Non-Functional Requirements

### Performance Targets

| Operation | Target Latency | Measurement Point |
|-----------|---------------|-------------------|
| Redis cache hit | < 10ms | P95 |
| Database query (single mapping) | < 50ms | P95 |
| End-to-end inbound processing | < 100ms | P95, includes lock + DB + cache |
| Lock acquisition | < 5ms | P99 |
| Status update | < 30ms | P95 |

**Throughput Target**: 
- **Per instance**: 1,000 messages/second
- **MVP deployment**: 5,000 messages/second (5 instances)

**Benchmarking**:
- Test with realistic message distribution (70% inbound, 30% outbound)
- Simulate burst traffic (3x normal load for 5 minutes)

---

### Concurrency Controls

**Problem**: Multiple workers might process messages from the same WhatsApp user simultaneously

**Solutions**:

#### 1. Redis Distributed Locks

**Lock Key Format**: `lock:mapping:{wa_id}`

**Implementation**:
```python
def acquire_lock(wa_id: str, ttl_seconds: int = 5) -> bool:
    """
    Acquire distributed lock using Redis SET NX
    Returns True if lock acquired, False otherwise
    """
    lock_key = f"lock:mapping:{wa_id}"
    acquired = redis.set(lock_key, "1", nx=True, ex=ttl_seconds)
    return acquired

def release_lock(wa_id: str):
    """Release lock immediately"""
    redis.delete(f"lock:mapping:{wa_id}")

def with_lock_retry(wa_id: str, max_retries: int = 3):
    """Retry lock acquisition with exponential backoff"""
    for attempt in range(max_retries):
        if acquire_lock(wa_id):
            return True
        time.sleep(0.1 * (2 ** attempt))  # 100ms, 200ms, 400ms
    return False
```

**Lock TTL**: 5 seconds
- **Purpose**: Prevents deadlock if service crashes while holding lock
- **Justification**: Normal processing takes <100ms, 5s is safe buffer

#### 2. Database Constraints

**Prevents duplicate active conversations**:
```sql
CREATE UNIQUE INDEX idx_unique_active_mapping 
ON conversation_mappings (wa_id) 
WHERE status = 'active';
```

**Behavior**: If two workers try to create mapping simultaneously, one gets `UniqueViolation` error

#### 3. Idempotent Message Logging

**Prevents duplicate message tracking**:
```sql
CREATE UNIQUE INDEX idx_wamid ON message_tracking (wamid);

INSERT INTO message_tracking (...) VALUES (...)
ON CONFLICT (wamid) DO NOTHING;
```

**Behavior**: Duplicate `wamid` → silent ignore, log warning

#### 4. Optimistic Locking for Status Updates

**Prevents lost updates**:
```sql
UPDATE message_tracking
SET status = $1, updated_at = $2
WHERE id = $3 AND status = $4;  -- Compare current status
```

**Behavior**: If status changed between SELECT and UPDATE → 0 rows affected

### Lock Contention Handling

**Monitoring**:
```python
# Metric: lock acquisition failures
lock_failures = Counter('lock_acquisition_failures_total', 'Lock acquisition failures')

if not with_lock_retry(wa_id):
    lock_failures.inc()
    send_to_dlq(message, reason="lock_timeout")
```

**Alerting**:
- If `lock_failures` > 10/minute → Warning
- If `lock_failures` > 100/minute → Critical (possible thundering herd)

---

### Reliability & Fault Tolerance

#### Failure Scenario Matrix

| Component | Failure Mode | Detection | Action | Recovery Time |
|-----------|--------------|-----------|--------|---------------|
| Redis | Connection lost | Health check fails | Fallback to DB | 0s (automatic) |
| Redis | Slow response | Timeout (500ms) | Fallback to DB | 0s (automatic) |
| PostgreSQL | Connection lost | Query exception | Pause queue consumption | Manual |
| PostgreSQL | Slow query | Timeout (5s) | Reject message (requeue) | Automatic |
| RabbitMQ | Connection lost | Connection exception | Reconnect with backoff | 30s (automatic) |
| RabbitMQ | Queue full | Publish exception | Alert + circuit breaker | Manual |

#### Redis Failure Handling

**Pattern**: Graceful Degradation

```python
def get_mapping_with_fallback(wa_id: str) -> Optional[dict]:
    try:
        # Try Redis first
        cached = redis.get(f"mapping:wa:{wa_id}", timeout=0.5)
        if cached:
            cache_hit_counter.inc()
            return json.loads(cached)
    except (redis.TimeoutError, redis.ConnectionError) as e:
        logger.warning(f"Redis unavailable, falling back to DB: {e}")
        cache_miss_counter.inc()
    
    # Fallback to database
    return db.query(
        "SELECT * FROM conversation_mappings WHERE wa_id = $1 AND status = 'active'",
        wa_id
    )
```

**Impact**: 
- Latency increases from ~10ms to ~50ms
- Service remains fully functional
- Cache hit rate drops to 0%

#### Database Failure Handling

**Pattern**: Fail-Stop

```python
def health_check():
    try:
        db.query("SELECT 1")
        return {"database": "ok"}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {"database": "error"}

# In queue consumer
if health_check()["database"] != "ok":
    logger.critical("Database unhealthy, pausing queue consumption")
    channel.stop_consuming()
    trigger_alert("database_down")
    time.sleep(30)  # Wait before retry
```

**Rationale**: Without database, we cannot:
- Create new mappings
- Track messages
- Prevent duplicate conversations

**Better to**: Stop processing than risk data corruption

#### Dead Letter Queue (DLQ)

**Reasons for DLQ routing**:

| Reason | Description | Resolution |
|--------|-------------|------------|
| `mapping_not_found` | Outbound message for unknown conversation | Manual investigation |
| `lock_timeout` | Could not acquire lock after 3 retries | Automatic retry after 5 min |
| `invalid_payload` | Missing required fields | Fix producer, discard |
| `state_violation` | Invalid status transition | Manual review |
| `mapping_status_expired` | Mapping expired before outbound sent | Alert Genesys team |
| `database_error` | Persistent DB error | Manual investigation |

**DLQ Processing Strategy**:
```python
# Automatic retry for transient errors
RETRIABLE_REASONS = ['lock_timeout', 'database_error']

def process_dlq_message(message: dict):
    if message['reason'] in RETRIABLE_REASONS:
        if message['retry_count'] < 3:
            # Requeue to main queue
            message['retry_count'] += 1
            publish_to_queue('inboundQueue', message)
        else:
            # Exhausted retries
            store_in_permanent_dlq(message)
            alert_team(message)
    else:
        # Manual intervention required
        store_in_permanent_dlq(message)
```

**Monitoring**:
```python
dlq_depth = Gauge('dlq_message_count', 'Messages in DLQ')
dlq_messages_total = Counter('dlq_messages_total', 'DLQ messages', ['reason'])

# Alert if DLQ depth > 100
if dlq_depth.get() > 100:
    trigger_alert("dlq_depth_high")
```

---

### Scalability

#### Horizontal Scaling Strategy

**Service Architecture**: Stateless workers consuming from shared queues

**Scaling Trigger**: Queue depth

```yaml
# Kubernetes HPA (Horizontal Pod Autoscaler)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: state-manager
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: state-manager
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: External
    external:
      metric:
        name: rabbitmq_queue_messages
        selector:
          matchLabels:
            queue: inboundQueue
      target:
        type: AverageValue
        averageValue: "1000"  # Scale up if queue depth > 1000 per pod
```

**Capacity Planning**:

| Load Level | Messages/sec | Required Instances | Queue Depth |
|------------|--------------|-------------------|-------------|
| Low | 1,000 | 3 | < 500 |
| Normal | 5,000 | 5 | < 1,000 |
| High | 10,000 | 10 | < 2,000 |
| Peak | 20,000 | 20 | < 5,000 |

#### Database Scaling

**MVP**: Single PostgreSQL instance with replication

**Read/Write Split**:
```python
# Write operations (mappings, message tracking) → Primary
primary_db = Database(settings.DB_PRIMARY_URL)

# Read operations (API endpoints) → Replica (optional)
replica_db = Database(settings.DB_REPLICA_URL or settings.DB_PRIMARY_URL)

@app.get("/mapping/wa/{wa_id}")
def get_mapping(wa_id: str):
    # Use replica for reads
    return replica_db.query("SELECT * FROM conversation_mappings WHERE wa_id = $1", wa_id)
```

**Future**: 
- Table partitioning for `message_tracking` (by month)
- Connection pooling (PgBouncer)
- Separate DB per tenant (already physically isolated in MVP)

#### Cache Scaling

**Redis Clustering** (Future):
```
Hash slot distribution:
- Slot 0-5460:   Redis Node 1
- Slot 5461-10922:  Redis Node 2
- Slot 10923-16383: Redis Node 3

Key distribution uses consistent hashing:
mapping:wa:{wa_id} → hashed to slot → routed to node
```

**MVP**: Single Redis instance with persistence (AOF)

---

### Observability

#### Metrics (Prometheus)

**Latency Histograms**:
```python
from prometheus_client import Histogram

mapping_resolution_latency = Histogram(
    'mapping_resolution_duration_seconds',
    'Time to resolve mapping',
    ['operation', 'cache_hit']
)

# Usage
with mapping_resolution_latency.labels(operation='wa_lookup', cache_hit='true').time():
    mapping = get_mapping_by_wa_id(wa_id)
```

**Counters**:
```python
from prometheus_client import Counter

messages_processed = Counter(
    'messages_processed_total',
    'Total messages processed',
    ['direction', 'status']
)

conversations_created = Counter(
    'conversations_created_total',
    'New conversations created'
)

duplicate_messages = Counter(
    'duplicate_messages_total',
    'Messages with duplicate wamid'
)

cache_operations = Counter(
    'cache_operations_total',
    'Cache operations',
    ['operation', 'result']  # operation: get/set, result: hit/miss/error
)
```

**Gauges**:
```python
from prometheus_client import Gauge

active_conversations = Gauge(
    'active_conversations_count',
    'Number of active conversations'
)

# Update periodically (every 60s)
def update_active_conversations():
    count = db.query("SELECT COUNT(*) FROM conversation_mappings WHERE status = 'active'")[0]
    active_conversations.set(count)

lock_contention_rate = Gauge(
    'lock_contention_rate',
    'Percentage of lock acquisition failures'
)
```

#### Structured Logging

**Log Format** (JSON):
```json
{
  "timestamp": "2025-01-15T10:30:00.123Z",
  "level": "INFO",
  "service": "state-manager",
  "operation": "inbound_identity_resolution",
  "trace_id": "abc-123-xyz",
  "wa_id": "919876543210",
  "wamid": "wamid.xxx",
  "mapping_id": "uuid-456",
  "cache_hit": true,
  "is_new_conversation": false,
  "duration_ms": 8,
  "message": "Mapping resolved successfully"
}
```

**Log Levels**:

| Level | Use Case | Example |
|-------|----------|---------|
| DEBUG | Detailed flow | "Acquired lock for wa_id=..." |
| INFO | Normal operations | "Mapping resolved", "Message tracked" |
| WARNING | Recoverable issues | "Duplicate wamid ignored", "Invalid state transition" |
| ERROR | Failed operations | "Database query failed", "DLQ send failed" |
| CRITICAL | Service degradation | "Database unreachable", "Redis cluster down" |

**Key Operations to Log**:

1. **Mapping Creation**:
```python
logger.info(
    "New conversation mapping created",
    extra={
        "operation": "mapping_create",
        "wa_id": wa_id,
        "mapping_id": mapping_id,
        "contact_name": contact_name
    }
)
```

2. **Conversation Correlation**:
```python
logger.info(
    "Conversation correlated",
    extra={
        "operation": "conversation_correlated",
        "wa_id": wa_id,
        "conversation_id": conversation_id,
        "communication_id": communication_id
    }
)
```

3. **DLQ Routing**:
```python
logger.error(
    "Message sent to DLQ",
    extra={
        "operation": "dlq_send",
        "reason": reason,
        "wamid": wamid,
        "retry_count": retry_count
    }
)
```

#### Alerting Rules

**Critical Alerts** (Page on-call):
```yaml
groups:
- name: state_manager_critical
  rules:
  - alert: DatabaseDown
    expr: up{job="postgres"} == 0
    for: 1m
    annotations:
      summary: "PostgreSQL is down"
      
  - alert: HighDLQDepth
    expr: dlq_message_count > 1000
    for: 5m
    annotations:
      summary: "DLQ has {{ $value }} messages"
      
  - alert: HighErrorRate
    expr: rate(messages_processed_total{status="error"}[5m]) > 10
    for: 2m
    annotations:
      summary: "Error rate: {{ $value }}/sec"
```

**Warning Alerts** (Slack notification):
```yaml
groups:
- name: state_manager_warnings
  rules:
  - alert: LowCacheHitRate
    expr: rate(cache_operations_total{result="hit"}[5m]) / rate(cache_operations_total[5m]) < 0.8
    for: 10m
    annotations:
      summary: "Cache hit rate: {{ $value | humanizePercentage }}"
      
  - alert: HighLatency
    expr: histogram_quantile(0.95, mapping_resolution_duration_seconds) > 0.2
    for: 5m
    annotations:
      summary: "P95 latency: {{ $value }}s"
```

#### Dashboards

**Grafana Dashboard Panels**:

1. **Operations Overview**:
   - Messages processed/sec (by direction)
   - Active conversations (gauge)
   - Conversations created/hour

2. **Performance**:
   - P50/P95/P99 latency (inbound, outbound, correlation)
   - Cache hit rate (%)
   - Database query duration

3. **Reliability**:
   - DLQ depth (over time)
   - Error rate (%)
   - Lock contention rate

4. **Infrastructure**:
   - Database connections (active/idle)
   - Redis memory usage
   - RabbitMQ queue depth

---

## Data Retention & Archival

### Retention Policy

| Table | Active Retention | Archive Retention | Total Retention |
|-------|------------------|-------------------|-----------------|
| `conversation_mappings` | 90 days | 1 year | 15 months |
| `message_tracking` | 30 days | 6 months | 7.5 months |

### Archival Strategy

**Monthly Batch Job**: `archival_job.py`

**Execution**: 1st day of month at 02:00 AM

**Process**:

1. **Archive Conversation Mappings**:
```sql
-- Create archive table (one-time)
CREATE TABLE conversation_mappings_archive (LIKE conversation_mappings INCLUDING ALL);

-- Move old records
INSERT INTO conversation_mappings_archive
SELECT * FROM conversation_mappings
WHERE updated_at < NOW() - INTERVAL '90 days'
  AND status IN ('expired', 'closed');

-- Delete from active table
DELETE FROM conversation_mappings
WHERE updated_at < NOW() - INTERVAL '90 days'
  AND status IN ('expired', 'closed');
```

2. **Archive Message Tracking** (with partitioning):
```sql
-- Create monthly partition (future enhancement)
CREATE TABLE message_tracking_2025_01 PARTITION OF message_tracking
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Drop old partition (automatic archival)
DROP TABLE IF EXISTS message_tracking_2024_07;  -- 6 months old
```

**Backup Before Deletion**:
```bash
# Export to S3 before dropping
pg_dump -t conversation_mappings_archive | gzip | aws s3 cp - s3://backups/state-manager/mappings_2025_01.sql.gz
```

### Data Lifecycle

```
Day 0:    Message arrives → Active table
Day 30:   Archive message_tracking → Archive table
Day 90:   Archive conversation_mappings → Archive table
Day 210:  Delete from message_tracking_archive
Day 450:  Delete from conversation_mappings_archive
```

---

## Security Considerations

### Media URL Validation

**Threat**: Server-Side Request Forgery (SSRF)

**Protection**: Whitelist allowed domains

```python
ALLOWED_MEDIA_DOMAINS = [
    "minio.internal.company.com",
    "s3.amazonaws.com"
]

def validate_media_url(url: str) -> bool:
    """
    Validate media URL is from trusted source
    Returns True if valid, False otherwise
    """
    if not url:
        return True  # NULL is valid
    
    try:
        parsed = urlparse(url)
        
        # Check scheme
        if parsed.scheme not in ['https', 'http']:
            logger.warning(f"Invalid media URL scheme: {parsed.scheme}")
            return False
        
        # Check domain
        if not any(parsed.hostname.endswith(domain) for domain in ALLOWED_MEDIA_DOMAINS):
            logger.warning(f"Media URL from untrusted domain: {parsed.hostname}")
            return False
        
        return True
    except Exception as e:
        logger.error(f"Media URL validation error: {e}")
        return False

# Usage in inbound processing
if message.get('media_url') and not validate_media_url(message['media_url']):
    send_to_dlq(message, reason="invalid_media_url")
    return
```

### API Authentication

**Requirement**: Internal service-to-service authentication

**MVP Implementation**: API Key

```python
from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader

API_KEY = os.getenv("STATE_MANAGER_API_KEY")
api_key_header = APIKeyHeader(name="X-API-Key")

def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return api_key

# Protect endpoints
@app.get("/mapping/wa/{wa_id}")
def get_mapping(wa_id: str, api_key: str = Depends(verify_api_key)):
    # Implementation
    pass
```

**Future Enhancement**: Mutual TLS (mTLS)

### SQL Injection Prevention

**Always use parameterized queries**:

```python
# ✅ CORRECT - Parameterized query
db.query(
    "SELECT * FROM conversation_mappings WHERE wa_id = $1",
    wa_id
)

# ❌ WRONG - String interpolation (SQL injection risk)
db.query(f"SELECT * FROM conversation_mappings WHERE wa_id = '{wa_id}'")
```

### Secrets Management

**Environment Variables**:
```bash
# Never hardcode secrets in code
DB_PASSWORD=${DB_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD}
STATE_MANAGER_API_KEY=${STATE_MANAGER_API_KEY}
```

**Production**: Use secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)

---

## Future Enhancements

### Phase 2: Multi-Channel Support

**Goal**: Support Instagram, Facebook Messenger, Telegram

**Schema Changes**:
```sql
ALTER TABLE conversation_mappings
ADD COLUMN channel VARCHAR(20) DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'instagram', 'messenger', 'telegram'));

-- Update unique constraint
DROP INDEX idx_unique_active_mapping;
CREATE UNIQUE INDEX idx_unique_active_mapping 
ON conversation_mappings (channel, wa_id) 
WHERE status = 'active';
```

**Cache Key Updates**:
```python
# Old: mapping:wa:{wa_id}
# New: mapping:{channel}:{external_id}
cache_key = f"mapping:{channel}:{external_id}"
```

### Phase 3: Multi-Active Conversations

**Use Case**: Power users with separate conversations (sales, support, billing)

**Configuration Table**:
```sql
CREATE TABLE tenant_settings (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    allow_multiple_active_conversations BOOLEAN DEFAULT FALSE,
    max_active_conversations_per_user INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Constraint Adjustment**:
```sql
-- Remove unique constraint, add CHECK constraint
ALTER TABLE conversation_mappings
DROP CONSTRAINT IF EXISTS unique_active_mapping;

-- Application-level enforcement based on tenant settings
```

### Phase 4: Event Sourcing

**Goal**: Full audit trail with event replay capability

**Event Store Schema**:
```sql
CREATE TABLE conversation_events (
    id UUID PRIMARY KEY,
    aggregate_id UUID NOT NULL,  -- mapping_id
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    sequence_number INT NOT NULL,
    occurred_at TIMESTAMP NOT NULL,
    UNIQUE (aggregate_id, sequence_number)
);

-- Event types:
-- - ConversationCreated
-- - ConversationCorrelated
-- - MessageReceived
-- - MessageSent
-- - StatusUpdated
-- - ConversationExpired
```

**Benefits**:
- Complete history of every state change
- Ability to rebuild state from events
- Time-travel debugging
- Analytics on state transitions

### Phase 5: Real-Time Analytics

**Stream Processing**: Apache Kafka + Flink

```python
# Publish events to Kafka
def publish_event(event_type: str, data: dict):
    kafka_producer.send(
        topic='state-manager-events',
        value={
            'event_type': event_type,
            'data': data,
            'timestamp': datetime.utcnow().isoformat()
        }
    )

# Real-time aggregations
# - Average response time
# - Conversation duration distribution
# - Peak load hours
# - User engagement metrics
```

---

## Testing Strategy

### Unit Tests

**Test Cases**:

1. **State Machine Validation**:
```python
def test_valid_state_transitions():
    assert is_valid_transition('queued', 'sent') == True
    assert is_valid_transition('sent', 'delivered') == True
    assert is_valid_transition('delivered', 'read') == True

def test_invalid_state_transitions():
    assert is_valid_transition('delivered', 'sent') == False
    assert is_valid_transition('queued', 'read') == False
```

2. **Cache Key Generation**:
```python
def test_cache_key_format():
    key = generate_cache_key('wa', '919876543210')
    assert key == 'mapping:wa:919876543210'
```

3. **Idempotency**:
```python
def test_duplicate_wamid_handling():
    # Insert message
    insert_message(mapping_id, wamid='test123')
    
    # Try inserting again
    result = insert_message(mapping_id, wamid='test123')
    assert result['created'] == False
```

### Integration Tests

**Test Cases**:

1. **Redis Failover**:
```python
def test_redis_failover():
    # Stop Redis
    redis_container.stop()
    
    # Operation should still succeed via DB fallback
    mapping = get_mapping_by_wa_id('919876543210')
    assert mapping is not None
    
    # Start Redis
    redis_container.start()
```

2. **Concurrent Mapping Creation**:
```python
def test_concurrent_mapping_creation():
    # Simulate 10 simultaneous messages from same wa_id
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(create_mapping, wa_id='919876543210', wamid=f'wamid_{i}')
            for i in range(10)
        ]
    
    # Only ONE mapping should be created
    mappings = db.query("SELECT * FROM conversation_mappings WHERE wa_id = '919876543210'")
    assert len(mappings) == 1
```

3. **Lock Timeout**:
```python
def test_lock_timeout_handling():
    # Hold lock indefinitely
    redis.set('lock:mapping:919876543210', '1', ex=30)
    
    # Try to process message
    result = process_inbound_message({'wa_id': '919876543210', 'wamid': 'test'})
    
    # Should send to DLQ
    assert result['dlq_reason'] == 'lock_timeout'
```

### Load Tests

**Tool**: Locust or K6

**Scenario 1: Steady State**:
```python
# 5,000 messages/sec for 10 minutes
# 70% inbound, 30% outbound
# 50% cache hit rate
```

**Scenario 2: Burst Traffic**:
```python
# Normal: 5,000 msg/sec
# Spike: 15,000 msg/sec for 5 minutes
# Return to normal
```

**Scenario 3: New Users**:
```python
# All messages from new wa_ids
# Cache hit rate: 0%
# Every message creates new mapping
```

**Success Criteria**:
- P95 latency < 200ms
- Error rate < 0.1%
- No database connection pool exhaustion
- Queue depth remains < 10,000

---

## Deployment Configuration

### Environment Variables

```bash
# Application
SERVICE_NAME=state-manager
LOG_LEVEL=INFO
CONVERSATION_TTL_HOURS=24
LOCK_TTL_SECONDS=5
LOCK_RETRY_COUNT=3
EXPIRY_JOB_INTERVAL_MINUTES=5

# Database (PostgreSQL)
DB_HOST=postgres.internal
DB_PORT=5432
DB_NAME=xypr_state_mvp
DB_USER=state_manager
DB_PASSWORD=${DB_PASSWORD}  # From secrets manager
DB_MAX_CONNECTIONS=50
DB_CONNECTION_TIMEOUT=5
DB_QUERY_TIMEOUT=30

# Redis
REDIS_HOST=redis.internal
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_POOL_SIZE=20
REDIS_SOCKET_TIMEOUT=0.5
REDIS_SOCKET_CONNECT_TIMEOUT=1

# RabbitMQ
RABBITMQ_HOST=rabbitmq.internal
RABBITMQ_PORT=5672
RABBITMQ_USER=state_manager
RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD}
RABBITMQ_VHOST=/xypr
RABBITMQ_PREFETCH_COUNT=100
RABBITMQ_HEARTBEAT=60

# Queues
INBOUND_QUEUE=inboundQueue
OUTBOUND_QUEUE=outboundQueue
STATUS_QUEUE=statusQueue
DLQ_NAME=state-manager-dlq
INBOUND_PROCESSED_QUEUE=inbound-processed
OUTBOUND_PROCESSED_QUEUE=outbound-processed

# API
API_PORT=8080
API_KEY=${STATE_MANAGER_API_KEY}

# Observability
METRICS_PORT=9090
PROMETHEUS_ENABLED=true
JAEGER_ENABLED=false  # Optional distributed tracing
```

### Docker Compose (Local Development)

```yaml
version: '3.8'

services:
  state-manager:
    build: .
    ports:
      - "8080:8080"
      - "9090:9090"
    environment:
      - DB_HOST=postgres
      - REDIS_HOST=redis
      - RABBITMQ_HOST=rabbitmq
    depends_on:
      - postgres
      - redis
      - rabbitmq

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: xypr_state_mvp
      POSTGRES_USER: state_manager
      POSTGRES_PASSWORD: devpassword
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: state_manager
      RABBITMQ_DEFAULT_PASS: devpassword

volumes:
  postgres_data:
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: state-manager
spec:
  replicas: 3
  selector:
    matchLabels:
      app: state-manager
  template:
    metadata:
      labels:
        app: state-manager
    spec:
      containers:
      - name: state-manager
        image: xypr/state-manager:latest
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: state-manager-secrets
              key: db-password
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
```

---

## Summary

This State Manager Service is the **transactional core** of the XYPR WhatsApp-to-Genesys middleware. 

### Key Guarantees

✅ **No duplicate conversations**: Database unique constraint + distributed locks  
✅ **Deterministic message routing**: Bidirectional wa_id ↔ conversation_id mappings  
✅ **Complete message lifecycle tracking**: Every message logged with state progression  
✅ **High performance**: Redis caching (< 10ms) with database fallback (< 50ms)  
✅ **Horizontal scalability**: Stateless workers, shared-nothing architecture  
✅ **Fault tolerance**: Graceful degradation on Redis failure, fail-stop on DB failure  
✅ **Idempotency**: All operations can be safely retried  
✅ **Concurrency safety**: Distributed locks + database constraints prevent race conditions  

### MVP Simplifications

- **Single Tenant**: No tenant_id columns required
- **Physical Isolation**: Separate database per tenant (future multi-tenant = different DB)
- **Simplified Queries**: No tenant_id filtering in WHERE clauses
- **Easier Scaling**: Scale entire tenant's infrastructure independently

### Design Principles

1. **Idempotency First**: Every operation is retry-safe
2. **Atomicity**: Database constraints enforce business rules
3. **Observable**: Comprehensive metrics, logs, and tracing
4. **Fail-Fast**: Explicit error handling, clear DLQ routing
5. **Cache-Aside**: Redis enhances performance but isn't required

---

**End of Document**
--- END state-manager/state-manager-frd.md ---


--- BEGIN tenant-service/tenant-service-frd.md ---

# Tenant Service — Functional Requirements Document

**Version:** 1.0
**Status:** MVP
**Service Port:** 3007

---

## 1. Overview

The Tenant Service is the central configuration store for the WhatsApp-Genesys Cloud integration platform. It manages tenant lifecycle (create, read, update, delete), credential storage, and the WhatsApp Business Account onboarding flow. Every other service resolves tenant identity and credentials through this service.

---

## 2. Responsibilities

| Responsibility | Description |
|---|---|
| Tenant CRUD | Create, read, update, delete tenant records |
| Credential storage | Securely store and retrieve Genesys and WhatsApp credentials |
| WhatsApp onboarding | Process Meta Embedded Signup OAuth callback; persist WABA config |
| Tenant resolution | Look up tenants by phone number ID or Genesys integration ID |
| Caching | Cache tenant config in Redis for low-latency lookups |

---

## 3. Data Model

### 3.1 `tenants` table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `tenant_id` | VARCHAR(50) | PK | Server-generated (`t_<hex16>`) |
| `name` | VARCHAR(255) | NOT NULL | Display name |
| `email` | VARCHAR(255) | | Primary contact email |
| `domain` | VARCHAR(255) | | Custom domain for the tenant |
| `subdomain` | VARCHAR(100) | UNIQUE | Subdomain for multi-tenant routing |
| `status` | VARCHAR(20) | DEFAULT 'active' | `active` \| `suspended` \| `deleted` |
| `plan` | VARCHAR(50) | DEFAULT 'standard' | Billing plan |
| `rate_limit` | INTEGER | DEFAULT 100 | API calls per minute |
| `phone_number_id` | VARCHAR(100) | UNIQUE | WhatsApp phone number ID |
| `genesys_integration_id` | VARCHAR(100) | UNIQUE | Genesys integration ID |
| `genesys_org_id` | VARCHAR(100) | | Genesys organization ID |
| `genesys_region` | VARCHAR(100) | | Genesys API region |
| `whatsapp_configured` | BOOLEAN | DEFAULT false | True after successful WABA signup |
| `onboarding_completed` | BOOLEAN | DEFAULT false | True after onboarding flow complete |
| `settings` | JSONB | | Tenant-specific settings (timezone, language, etc.) |
| `metadata` | JSONB | | Extensible metadata |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | AUTO | Auto-updated by trigger |

### 3.2 `tenant_credentials` table

Stores Genesys OAuth and other credential types. At most one **active** credential per `(tenant_id, credential_type)`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | PK |
| `tenant_id` | VARCHAR(50) | FK -> tenants |
| `credential_type` | VARCHAR(50) | `genesys` \| `whatsapp` |
| `credentials` | JSONB | Credential payload |
| `is_active` | BOOLEAN | Active credential flag |

### 3.3 `tenant_whatsapp_config` table

| Column | Type | Description |
|--------|------|-------------|
| `tenant_id` | VARCHAR(50) | FK -> tenants (UNIQUE) |
| `waba_id` | VARCHAR(100) | WhatsApp Business Account ID |
| `phone_number_id` | VARCHAR(100) | Phone number ID |
| `access_token` | TEXT | Meta Graph API token |
| `business_account_id` | VARCHAR(100) | Meta Business Account ID |
| `verify_token` | VARCHAR(255) | Webhook verify token |
| `display_phone_number` | VARCHAR(50) | Human-readable number |
| `quality_rating` | VARCHAR(50) | GREEN / YELLOW / RED |
| `configured` | BOOLEAN | True once fully configured |

---

## 4. API Specification

### Base URL: `/api/tenants` or `/tenants`

---

### 4.1 Create Tenant

**`POST /tenants`**

Creates a new tenant. The `tenant_id` is auto-generated server-side.

**Request body:**
```json
{
  "name": "Acme Corp",
  "email": "admin@acme.com",
  "domain": "acme.com",
  "subdomain": "acme",
  "plan": "standard",
  "settings": { "timezone": "UTC", "language": "en" }
}
```

Required: `name`, `email`

**Response `201 Created`:**
```json
{
  "tenant": {
    "id": "t_a1b2c3d4e5f6a7b8",
    "name": "Acme Corp",
    "email": "admin@acme.com",
    "domain": "acme.com",
    "status": "active",
    "plan": "standard",
    "whatsappConfigured": false,
    "createdAt": "2026-02-12T10:00:00Z"
  },
  "apiKey": "sk_...",
  "message": "Tenant created successfully"
}
```

**Error `400`:** `name` or `email` missing
**Error `409`:** Tenant with this email or subdomain already exists

---

### 4.2 List Tenants

**`GET /tenants?limit=20&offset=0`**

**Response `200`:**
```json
{
  "tenants": [ { ...tenant } ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

### 4.3 Get Tenant

**`GET /tenants/:tenantId`**

**Response `200`:** Tenant object (camelCase, all fields)
**Error `404`:** Tenant not found

---

### 4.4 Update Tenant

**`PATCH /tenants/:tenantId`**

Accepts any subset of: `name`, `email`, `domain`, `subdomain`, `plan`, `status`, `settings`, `phoneNumberId`, `genesysIntegrationId`.

**Error `404`:** Tenant not found

---

### 4.5 Delete Tenant

**`DELETE /tenants/:tenantId`**

Cascades to all related records. Returns `{ message }`.

---

### 4.6 Genesys Credentials

**`PUT /tenants/:tenantId/genesys/credentials`**

```json
{
  "clientId": "...",
  "clientSecret": "...",
  "region": "mypurecloud.com",
  "integrationId": "..."
}
```

**`GET /tenants/:tenantId/genesys/credentials`**

Returns masked `clientSecret` (`***xxxx`).

---

### 4.7 Generic Credentials

**`POST /tenants/:tenantId/credentials`** — Store credential by type

Body: `{ "type": "genesys|whatsapp", "credentials": { ... } }`

**`GET /tenants/:tenantId/credentials/:type`** — Retrieve credential by type

---

### 4.8 WhatsApp Config

**`POST /tenants/:tenantId/whatsapp`** — Store/update WABA config manually

Body: `{ "wabaId", "phoneNumberId", "accessToken", "businessId"?, "displayPhoneNumber"?, "qualityRating"? }`

**`GET /tenants/:tenantId/whatsapp`** — Retrieve config (access token masked)

Response includes `configured` boolean.

---

### 4.9 WhatsApp Embedded Signup

**`POST /api/whatsapp/signup`**

Processes the Meta Embedded Signup OAuth callback. Persists WABA configuration and sets `whatsapp_configured = true` on the tenant.

**Request body:**
```json
{
  "code": "<oauth-code>",
  "state": "<tenantId>"
}
```

Both fields required.

**Response `200`:**
```json
{
  "message": "WhatsApp signup completed successfully",
  "tenantId": "t_...",
  "config": {
    "wabaId": "...",
    "phoneNumberId": "...",
    "displayPhoneNumber": "+1 555-0100",
    "qualityRating": "GREEN",
    "configured": true
  }
}
```

**Error `400`:** Missing `code` or `state`
**Error `404`:** Tenant not found
**Error `400`:** No WABA found in OAuth token (WABA_NOT_FOUND)

---

### 4.10 Tenant Resolution Endpoints

| Endpoint | Description |
|---|---|
| `GET /tenants/by-phone/:phoneNumberId` | Look up tenant by WhatsApp phone number ID |
| `GET /tenants/by-integration/:integrationId` | Look up tenant by Genesys integration ID |
| `GET /tenants/by-genesys-org/:genesysOrgId` | Look up tenant by Genesys org ID |

These are used internally by other services (inbound-transformer, genesys-webhook-service).

---

### 4.11 Genesys Tenant Provisioning

**`POST /tenants/provision/genesys`**

Get-or-create a tenant for a Genesys organization.

Body: `{ "genesysOrgId", "genesysOrgName", "genesysRegion" }` — all required

Response: `{ "message", "tenantId", "tenantName" }`

---

### 4.12 Health Check

**`GET /health`**

```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2026-02-12T10:00:00Z"
}
```

---

## 5. Response Schema

All responses use **camelCase** field names.

### Tenant Object

```json
{
  "id": "t_a1b2c3d4e5f6a7b8",
  "name": "Acme Corp",
  "email": "admin@acme.com",
  "domain": "acme.com",
  "subdomain": "acme",
  "status": "active",
  "plan": "standard",
  "rateLimit": 100,
  "phoneNumberId": "15550001234",
  "genesysIntegrationId": "intg-001",
  "genesysOrgId": "org-001",
  "genesysRegion": "mypurecloud.com",
  "settings": { "timezone": "UTC" },
  "whatsappConfigured": true,
  "onboardingCompleted": false,
  "createdAt": "2026-02-12T10:00:00Z",
  "updatedAt": "2026-02-12T10:05:00Z"
}
```

### Error Object

```json
{
  "error": {
    "message": "Human-readable description",
    "code": "MACHINE_READABLE_CODE"
  }
}
```

**Error codes:** `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `WABA_NOT_FOUND`, `SIGNUP_ERROR`, `INTERNAL_ERROR`

---

## 6. Caching Strategy

| Cache Key | TTL | Data |
|---|---|---|
| `tenant:{id}:config` | 3600s | Core tenant fields |
| `tenant:{id}:genesys_creds` | 3600s | Genesys credentials |
| `tenant:{id}:whatsapp` | 3600s | WhatsApp config (masked) |
| `tenant:{id}:credentials:{type}` | 3600s | Generic credentials |
| `apikey:{key}` | none | API key -> tenant ID |
| `subdomain:{sub}` | none | Subdomain -> tenant ID |
| `phone:{phoneNumberId}` | 3600s | Phone number -> tenant |
| `integration:{id}` | 3600s | Integration ID -> tenant |

Cache is invalidated on every write. Redis unavailability degrades gracefully (falls through to DB).

---

## 7. Non-functional Requirements (MVP)

| Requirement | Target |
|---|---|
| Availability | 99.9% uptime |
| Response time (cached) | < 10 ms p99 |
| Response time (DB) | < 100 ms p99 |
| Credential masking | Secrets show only last 4 chars in API responses |
| Auth | None for MVP (deferred — handled by API Gateway) |

---

## 8. Deferred (Post-MVP)

- JWT `BearerAuth` on all protected routes (D.1, D.2)
- CORS middleware (D.3)
- Per-tenant rate limiting enforcement (D.4)
- OpenAPI runtime validation (D.5)
- Field-level credential encryption at rest
- `node-pg-migrate` migration system (task 1.6)

--- END tenant-service/tenant-service-frd.md ---


--- BEGIN whatsapp-api-service/whatsapp-api-frd.md ---

# Functional Requirements Document: WhatsApp API Service

**Document Version:** 2.0 (LLM-Optimized)  
**Service Name:** `whatsapp-api-service`  
**Service Type:** Outbound Message Gateway  
**Parent Document:** System Design Document  
**Last Updated:** 2024-02-12

---

## 1. EXECUTIVE SUMMARY

### 1.1 Service Purpose
The WhatsApp API Service is a microservice that acts as the **egress gateway** to Meta's Cloud API (Graph API). It consumes pre-formatted WhatsApp messages from an internal queue and delivers them to customers via Meta's infrastructure.

### 1.2 Service Boundaries
- **Input Boundary:** RabbitMQ queue `outbound-processed` (messages already transformed to Meta format)
- **Output Boundary:** Meta Graph API (HTTPS POST requests)
- **Dependencies:** Tenant Service (credentials), RabbitMQ (message broker)

### 1.3 Key Metrics
- **Target Throughput:** 50 messages/second
- **Meta API Rate Limit:** 80 messages/second (Tier 2 WABA)
- **Retry Strategy:** Exponential backoff with jitter
- **Tenant Isolation:** Required (one tenant's failure must not affect others)

---

## 2. ARCHITECTURE OVERVIEW

### 2.1 Service Components

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────┐
│   RabbitMQ      │────────>│  WhatsApp API        │────────>│  Meta Graph │
│   (outbound-    │         │  Service             │         │  API        │
│   processed)    │         │                      │         │             │
└─────────────────┘         │  - Consumer          │         └─────────────┘
                            │  - Auth Handler      │               │
                            │  - HTTP Client       │               │
                            │  - Error Handler     │               │
                            └──────────────────────┘               │
                                      │                             │
                                      │ Fetch Credentials           │
                                      v                             │
                            ┌──────────────────────┐               │
                            │  Tenant Service      │               │
                            │  /tenants/:id/       │               │
                            │  credentials         │               │
                            └──────────────────────┘               │
                                                                    │
                            ┌──────────────────────┐               │
                            │  Logging/Monitoring  │<──────────────┘
                            │  - Success/Failure   │
                            │  - Latency Metrics   │
                            └──────────────────────┘
```

### 2.2 Technology Stack Requirements
- **Language:** Node.js (TypeScript preferred) or Python
- **Message Broker Client:** `amqplib` (Node.js) or `pika` (Python)
- **HTTP Client:** `axios` (Node.js) or `requests` (Python)
- **Configuration:** Environment variables + Config service (optional)
- **Logging:** Structured JSON logging (Winston/Bunyan for Node, structlog for Python)
- **Monitoring:** Prometheus metrics + Health check endpoint

---

## 3. DATA CONTRACTS

### 3.1 Input Message Schema (from RabbitMQ)

**Queue Name:** `outbound-processed`  
**Exchange:** `whatsapp-exchange` (topic exchange)  
**Routing Key Pattern:** `outbound.processed.{tenantId}`

#### 3.1.1 Message Envelope Structure
```json
{
  "metadata": {
    "tenantId": "string (UUID v4, required)",
    "phoneNumberId": "string (Meta WABA Phone Number ID, required)",
    "internalId": "string (UUID v4, required, for tracing)",
    "timestamp": "string (ISO 8601, required)",
    "priority": "number (0-10, optional, default: 5)",
    "retryCount": "number (optional, default: 0)"
  },
  "wabaPayload": {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "string (E.164 format, required)",
    "type": "string (text|template|image|document|video|audio|location|contacts|interactive)",
    "...": "additional fields based on message type"
  }
}
```

#### 3.1.2 Example: Text Message
```json
{
  "metadata": {
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "phoneNumberId": "100000001",
    "internalId": "msg-12345-67890",
    "timestamp": "2024-02-12T10:30:00.000Z",
    "priority": 5,
    "retryCount": 0
  },
  "wabaPayload": {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "919876543210",
    "type": "text",
    "text": {
      "body": "Hello from Genesys Support. How can we help you today?"
    }
  }
}
```

#### 3.1.3 Example: Template Message
```json
{
  "metadata": {
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "phoneNumberId": "100000001",
    "internalId": "msg-template-98765",
    "timestamp": "2024-02-12T10:35:00.000Z"
  },
  "wabaPayload": {
    "messaging_product": "whatsapp",
    "to": "919876543210",
    "type": "template",
    "template": {
      "name": "order_confirmation",
      "language": {
        "code": "en"
      },
      "components": [
        {
          "type": "body",
          "parameters": [
            {
              "type": "text",
              "text": "John Doe"
            },
            {
              "type": "text",
              "text": "ORD-12345"
            }
          ]
        }
      ]
    }
  }
}
```

#### 3.1.4 Example: Media Message (Image)
```json
{
  "metadata": {
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "phoneNumberId": "100000001",
    "internalId": "msg-media-55555"
  },
  "wabaPayload": {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "919876543210",
    "type": "image",
    "image": {
      "link": "https://cdn.example.com/images/product-123.jpg",
      "caption": "Your requested product image"
    }
  }
}
```

### 3.2 Tenant Credentials Schema (from Tenant Service)

**Endpoint:** `GET /api/v1/tenants/{tenantId}/credentials?type=whatsapp`  
**Authentication:** Internal service token (JWT or API key)

#### 3.2.1 Response Structure
```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "credentialType": "whatsapp",
  "credentials": {
    "systemUserAccessToken": "string (encrypted or plaintext, 200+ chars)",
    "phoneNumberId": "string (Meta WABA Phone Number ID)",
    "businessAccountId": "string (Meta WABA ID, optional)",
    "wabaProfile": {
      "displayName": "string (optional)",
      "about": "string (optional)",
      "tier": "string (optional, e.g., 'tier_2')"
    },
    "rateLimits": {
      "messagesPerSecond": 80,
      "messagesPerDay": 100000
    }
  },
  "status": "active|suspended|expired",
  "expiresAt": "string (ISO 8601, token expiration)",
  "lastValidated": "string (ISO 8601)"
}
```

#### 3.2.2 Error Responses
```json
// 404 Not Found
{
  "error": {
    "code": "TENANT_NOT_FOUND",
    "message": "Tenant with ID {tenantId} does not exist"
  }
}

// 403 Forbidden
{
  "error": {
    "code": "CREDENTIALS_SUSPENDED",
    "message": "WhatsApp credentials for tenant {tenantId} are suspended"
  }
}

// 500 Internal Server Error
{
  "error": {
    "code": "DECRYPTION_FAILED",
    "message": "Failed to decrypt tenant credentials"
  }
}
```

### 3.3 Meta Graph API Contract

**Base URL:** `https://graph.facebook.com/v18.0`  
**Endpoint:** `POST /{phone_number_id}/messages`  
**Authentication:** Bearer token (System User Access Token)

#### 3.3.1 Request Headers
```
Authorization: Bearer {systemUserAccessToken}
Content-Type: application/json
User-Agent: whatsapp-api-service/1.1
```

#### 3.3.2 Request Body
The `wabaPayload` from the input message (see Section 3.1).

#### 3.3.3 Success Response (200 OK)
```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    {
      "input": "919876543210",
      "wa_id": "919876543210"
    }
  ],
  "messages": [
    {
      "id": "wamid.HBgNMTIzNDU2Nzg5MAUCABEYEjRFNkY3ODlBQkNERUYwMTIA"
    }
  ]
}
```

**Key Fields:**
- `messages[0].id`: The WhatsApp Message ID (WAMID) - **MUST be logged for tracking**

#### 3.3.4 Error Responses

##### 400 Bad Request
```json
{
  "error": {
    "message": "Invalid parameter",
    "type": "OAuthException",
    "code": 100,
    "error_data": {
      "messaging_product": "whatsapp",
      "details": "Parameter 'to' is invalid"
    },
    "error_subcode": 2388003,
    "fbtrace_id": "AXYZabcdef123456"
  }
}
```

**Common 400 Error Subcodes:**
- `2388003`: Invalid phone number format
- `2388001`: Template does not exist
- `2388002`: Template parameter mismatch
- `2388005`: Media download failed
- `2388009`: Recipient not on WhatsApp

##### 401 Unauthorized
```json
{
  "error": {
    "message": "Invalid OAuth access token",
    "type": "OAuthException",
    "code": 190,
    "fbtrace_id": "AXYZabcdef123456"
  }
}
```

##### 403 Forbidden
```json
{
  "error": {
    "message": "Phone number not registered",
    "type": "OAuthException",
    "code": 10,
    "error_subcode": 2388054,
    "fbtrace_id": "AXYZabcdef123456"
  }
}
```

##### 429 Rate Limit Exceeded
```json
{
  "error": {
    "message": "Too many messages sent from this phone number",
    "type": "OAuthException",
    "code": 4,
    "error_subcode": 2388104,
    "fbtrace_id": "AXYZabcdef123456"
  }
}
```

##### Meta Error Code: 131047 (24-Hour Window Expired)
```json
{
  "error": {
    "message": "User's phone number is not part of the allowed list",
    "type": "OAuthException",
    "code": 131047,
    "error_data": {
      "messaging_product": "whatsapp",
      "details": "Recipient phone number not currently opted in"
    },
    "fbtrace_id": "AXYZabcdef123456"
  }
}
```

**Note:** Error code `131047` can also indicate the 24-hour customer service window has expired.

---

## 4. FUNCTIONAL REQUIREMENTS

### 4.1 Message Consumption (REQ-OUT-01)

**Requirement ID:** `REQ-OUT-01`  
**Priority:** CRITICAL  
**Owner:** WhatsApp API Service

#### 4.1.1 Description
The service MUST continuously consume messages from the RabbitMQ queue `outbound-processed`.

#### 4.1.2 Acceptance Criteria
1. Consumer establishes connection to RabbitMQ on service startup
2. Consumer prefetch count set to `10` (configurable)
3. Consumer acknowledges messages only after successful processing or permanent failure
4. Consumer handles connection failures with automatic reconnection (exponential backoff)
5. Consumer processes messages in FIFO order per routing key (per tenant)

#### 4.1.3 Configuration Parameters
```yaml
rabbitmq:
  host: "rabbitmq.internal.svc.cluster.local"
  port: 5672
  username: "${RABBITMQ_USER}"
  password: "${RABBITMQ_PASSWORD}"
  vhost: "/whatsapp"
  queue: "outbound-processed"
  exchange: "whatsapp-exchange"
  prefetchCount: 10
  reconnectDelay: 5000  # milliseconds
  maxReconnectAttempts: 10
```

#### 4.1.4 Error Handling
- **Connection Failure:** Retry with exponential backoff (5s, 10s, 20s, 40s, max 60s)
- **Channel Error:** Recreate channel, log error, alert operations
- **Parse Error:** Log error, NACK message without requeue (dead letter)

#### 4.1.5 Implementation Pseudocode
```typescript
async function startConsumer() {
  const connection = await connectToRabbitMQ();
  const channel = await connection.createChannel();
  
  await channel.assertQueue('outbound-processed', { durable: true });
  await channel.prefetch(config.prefetchCount);
  
  channel.consume('outbound-processed', async (msg) => {
    if (!msg) return;
    
    try {
      const payload = JSON.parse(msg.content.toString());
      await processMessage(payload);
      channel.ack(msg);
    } catch (error) {
      if (error instanceof ParseError) {
        // Permanent failure - don't requeue
        channel.nack(msg, false, false);
      } else if (error instanceof RetryableError) {
        // Temporary failure - requeue
        channel.nack(msg, false, true);
      } else {
        // Unknown error - log and decide based on error type
        handleUnknownError(error, msg, channel);
      }
    }
  });
}
```

---

### 4.2 Credential Retrieval (REQ-AUTH-01)

**Requirement ID:** `REQ-AUTH-01`  
**Priority:** CRITICAL  
**Owner:** WhatsApp API Service

#### 4.2.1 Description
For each message, the service MUST retrieve valid WhatsApp Business API credentials for the tenant.

#### 4.2.2 Acceptance Criteria
1. Service calls Tenant Service API: `GET /api/v1/tenants/{tenantId}/credentials?type=whatsapp`
2. Response includes System User Access Token and Phone Number ID
3. Credentials are cached in-memory with TTL (15 minutes default)
4. Cache is invalidated on 401/403 errors from Meta
5. Failed credential fetch results in message NACK with requeue

#### 4.2.3 Caching Strategy
```typescript
interface CredentialCache {
  [tenantId: string]: {
    token: string;
    phoneNumberId: string;
    cachedAt: number;
    ttl: number;  // milliseconds
  }
}

async function getCredentials(tenantId: string): Promise<Credentials> {
  const cached = cache[tenantId];
  
  if (cached && Date.now() - cached.cachedAt < cached.ttl) {
    return { token: cached.token, phoneNumberId: cached.phoneNumberId };
  }
  
  // Fetch from Tenant Service
  const credentials = await fetchFromTenantService(tenantId);
  
  // Cache for 15 minutes
  cache[tenantId] = {
    token: credentials.systemUserAccessToken,
    phoneNumberId: credentials.phoneNumberId,
    cachedAt: Date.now(),
    ttl: 15 * 60 * 1000
  };
  
  return credentials;
}
```

#### 4.2.4 Configuration Parameters
```yaml
tenantService:
  baseUrl: "http://tenant-service.internal.svc.cluster.local:8080"
  endpoint: "/api/v1/tenants/{tenantId}/credentials"
  timeout: 5000  # milliseconds
  retryAttempts: 3
  retryDelay: 1000  # milliseconds
  credentialCacheTTL: 900000  # 15 minutes in milliseconds
```

#### 4.2.5 Error Scenarios
| Error Type | HTTP Code | Action |
|------------|-----------|--------|
| Tenant Not Found | 404 | Log error, NACK without requeue (dead letter) |
| Credentials Suspended | 403 | Log warning, NACK without requeue, alert ops |
| Service Timeout | 408/504 | Log error, NACK with requeue (retry) |
| Internal Server Error | 500 | Log error, NACK with requeue (retry) |

---

### 4.3 Message Delivery to Meta (REQ-OUT-02)

**Requirement ID:** `REQ-OUT-02`  
**Priority:** CRITICAL  
**Owner:** WhatsApp API Service

#### 4.3.1 Description
The service MUST send WhatsApp messages to Meta's Graph API using the credentials retrieved in REQ-AUTH-01.

#### 4.3.2 HTTP Request Specification

**Method:** `POST`  
**URL:** `https://graph.facebook.com/v18.0/{phoneNumberId}/messages`

**Headers:**
```
Authorization: Bearer {systemUserAccessToken}
Content-Type: application/json
User-Agent: whatsapp-api-service/1.1
X-Tenant-ID: {tenantId}  # Custom header for logging
X-Internal-Message-ID: {internalId}  # Custom header for tracing
```

**Request Body:**
```json
{wabaPayload}  // From input message (Section 3.1)
```

**Timeout:** 10 seconds (configurable)

#### 4.3.3 Implementation Requirements
1. Use connection pooling (max 100 connections per tenant)
2. Enable HTTP keep-alive
3. Retry on network errors (max 3 retries with exponential backoff)
4. Log full request/response for debugging (sanitize tokens in logs)

#### 4.3.4 Success Handling (200 OK)
```typescript
async function handleSuccess(response: MetaApiResponse, internalId: string) {
  const wamid = response.messages[0].id;
  
  logger.info({
    event: 'message_delivered',
    internalId,
    wamid,
    recipient: response.contacts[0].wa_id,
    timestamp: new Date().toISOString()
  });
  
  // Emit metric
  metrics.increment('messages.delivered', { tenant: tenantId });
  
  // Acknowledge RabbitMQ message
  channel.ack(originalMessage);
}
```

#### 4.3.5 Configuration Parameters
```yaml
metaApi:
  baseUrl: "https://graph.facebook.com"
  version: "v18.0"
  timeout: 10000  # milliseconds
  maxRetries: 3
  retryDelay: 1000  # milliseconds, with exponential backoff
  connectionPoolSize: 100
  keepAliveTimeout: 60000  # milliseconds
```

---

### 4.4 Error Handling (REQ-ERR-01)

**Requirement ID:** `REQ-ERR-01`  
**Priority:** CRITICAL  
**Owner:** WhatsApp API Service

#### 4.4.1 Description
The service MUST handle all Meta API errors according to the error type and implement appropriate retry logic.

#### 4.4.2 Error Classification Matrix

| HTTP Code | Error Code | Error Subcode | Error Type | Description | Retry? | Action |
|-----------|------------|---------------|------------|-------------|--------|--------|
| 200 | - | - | SUCCESS | Message delivered | N/A | ACK, log WAMID |
| 400 | 100 | 2388003 | INVALID_PARAM | Invalid phone number | NO | ACK, log error, alert |
| 400 | 100 | 2388001 | TEMPLATE_NOT_FOUND | Template doesn't exist | NO | ACK, log error, alert |
| 400 | 100 | 2388002 | TEMPLATE_PARAM_MISMATCH | Wrong template params | NO | ACK, log error |
| 400 | 100 | 2388005 | MEDIA_DOWNLOAD_FAILED | Cannot download media | YES (1x) | NACK with requeue |
| 400 | 100 | 2388009 | RECIPIENT_NOT_ON_WHATSAPP | User not on WhatsApp | NO | ACK, log info |
| 400 | 131047 | - | WINDOW_EXPIRED | 24h session window expired | NO | ACK, log warning, notify Genesys |
| 401 | 190 | - | INVALID_TOKEN | Token expired/invalid | YES (1x) | Invalidate cache, NACK, alert |
| 403 | 10 | 2388054 | PHONE_NOT_REGISTERED | Phone number not registered | NO | ACK, log critical, alert ops |
| 429 | 4 | 2388104 | RATE_LIMIT | Too many messages | YES | NACK with delay, backpressure |
| 500 | - | - | META_SERVER_ERROR | Meta service down | YES | NACK with exponential backoff |
| 502/503/504 | - | - | META_UNAVAILABLE | Meta temporarily unavailable | YES | NACK with exponential backoff |
| - | - | - | NETWORK_ERROR | Connection timeout/refused | YES | NACK with exponential backoff |

#### 4.4.3 Retry Strategy

##### Retryable Errors
- 500, 502, 503, 504 (Meta server errors)
- Network timeouts
- 401/403 (auth errors - retry once after cache invalidation)
- 429 (rate limit - retry with backoff)

##### Non-Retryable Errors
- 400 with client error subcodes (invalid params, template errors)
- 131047 (window expired)
- 403 (phone not registered)

##### Exponential Backoff Algorithm
```typescript
function calculateBackoff(attempt: number, baseDelay: number = 1000): number {
  const maxDelay = 60000; // 1 minute
  const jitter = Math.random() * 1000;
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay + jitter;
}

// Example:
// Attempt 1: 1000ms + jitter
// Attempt 2: 2000ms + jitter
// Attempt 3: 4000ms + jitter
// Attempt 4: 8000ms + jitter
// Attempt 5: 16000ms + jitter
// Attempt 6+: 60000ms + jitter
```

#### 4.4.4 Error Handling Implementation

```typescript
async function handleMetaApiError(
  error: MetaApiError,
  message: RabbitMQMessage,
  retryCount: number
): Promise<void> {
  const errorCode = error.error?.code;
  const errorSubcode = error.error?.error_subcode;
  const httpStatus = error.httpStatus;
  
  // Log structured error
  logger.error({
    event: 'meta_api_error',
    internalId: message.metadata.internalId,
    tenantId: message.metadata.tenantId,
    httpStatus,
    errorCode,
    errorSubcode,
    errorMessage: error.error?.message,
    fbtrace: error.error?.fbtrace_id,
    retryCount
  });
  
  // Classify error
  if (isNonRetryableError(errorCode, errorSubcode, httpStatus)) {
    // Permanent failure - don't retry
    channel.ack(message);
    
    // Special handling for specific errors
    if (errorCode === 131047) {
      await notifyGenesysSessionExpired(message);
    }
    
    if (errorSubcode === 2388001) {
      await alertTemplateNotFound(message);
    }
    
  } else if (isAuthError(errorCode)) {
    // Auth error - invalidate cache and retry once
    await invalidateCredentialCache(message.metadata.tenantId);
    
    if (retryCount === 0) {
      await requeueMessage(message, 5000); // 5 second delay
    } else {
      channel.ack(message); // Already retried once
      await alertAuthFailure(message);
    }
    
  } else if (isRateLimitError(errorCode, errorSubcode)) {
    // Rate limit - apply backpressure
    const delayMs = calculateBackoff(retryCount, 10000); // Start at 10s
    await requeueMessage(message, delayMs);
    await applyBackpressure(message.metadata.tenantId);
    
  } else if (isServerError(httpStatus)) {
    // Meta server error - retry with exponential backoff
    const maxRetries = 5;
    
    if (retryCount < maxRetries) {
      const delayMs = calculateBackoff(retryCount);
      await requeueMessage(message, delayMs);
    } else {
      // Max retries exceeded
      channel.ack(message);
      await alertMaxRetriesExceeded(message);
    }
    
  } else {
    // Unknown error - log and treat as non-retryable
    channel.ack(message);
    await alertUnknownError(message, error);
  }
}
```

#### 4.4.5 Dead Letter Queue Configuration
```yaml
rabbitmq:
  deadLetterExchange: "whatsapp-dlx"
  deadLetterQueue: "outbound-failed"
  deadLetterRoutingKey: "outbound.failed"
  messageTTL: 86400000  # 24 hours before message expires
```

---

### 4.5 Tenant Isolation (REQ-ISO-01)

**Requirement ID:** `REQ-ISO-01`  
**Priority:** HIGH  
**Owner:** WhatsApp API Service

#### 4.5.1 Description
Failures for one tenant MUST NOT impact message delivery for other tenants.

#### 4.5.2 Acceptance Criteria
1. Each tenant's credentials are cached independently
2. Rate limiting is applied per tenant (not globally)
3. Errors for one tenant do not block queue consumption
4. Per-tenant circuit breakers prevent cascading failures

#### 4.5.3 Per-Tenant Circuit Breaker
```typescript
interface CircuitBreaker {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  threshold: number;
  timeout: number;
}

const circuitBreakers: Map<string, CircuitBreaker> = new Map();

async function sendMessageWithCircuitBreaker(
  tenantId: string,
  message: Message
): Promise<void> {
  const breaker = getOrCreateCircuitBreaker(tenantId);
  
  if (breaker.state === 'OPEN') {
    const now = Date.now();
    if (now - breaker.lastFailureTime > breaker.timeout) {
      breaker.state = 'HALF_OPEN';
    } else {
      throw new CircuitBreakerOpenError(
        `Circuit breaker open for tenant ${tenantId}`
      );
    }
  }
  
  try {
    await sendToMeta(message);
    
    // Success - reset breaker
    breaker.failureCount = 0;
    breaker.state = 'CLOSED';
    
  } catch (error) {
    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();
    
    if (breaker.failureCount >= breaker.threshold) {
      breaker.state = 'OPEN';
      logger.warn({
        event: 'circuit_breaker_opened',
        tenantId,
        failureCount: breaker.failureCount
      });
    }
    
    throw error;
  }
}

function getOrCreateCircuitBreaker(tenantId: string): CircuitBreaker {
  if (!circuitBreakers.has(tenantId)) {
    circuitBreakers.set(tenantId, {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      threshold: 5,  // Open after 5 consecutive failures
      timeout: 60000  // Try again after 1 minute
    });
  }
  return circuitBreakers.get(tenantId)!;
}
```

#### 4.5.4 Per-Tenant Rate Limiting
```typescript
interface RateLimiter {
  tokens: number;
  maxTokens: number;
  refillRate: number;  // tokens per second
  lastRefill: number;
}

const rateLimiters: Map<string, RateLimiter> = new Map();

async function checkRateLimit(tenantId: string): Promise<boolean> {
  const limiter = getOrCreateRateLimiter(tenantId);
  const now = Date.now();
  
  // Refill tokens based on time elapsed
  const elapsed = (now - limiter.lastRefill) / 1000;
  const tokensToAdd = elapsed * limiter.refillRate;
  limiter.tokens = Math.min(limiter.tokens + tokensToAdd, limiter.maxTokens);
  limiter.lastRefill = now;
  
  if (limiter.tokens >= 1) {
    limiter.tokens -= 1;
    return true;
  }
  
  return false;
}

function getOrCreateRateLimiter(tenantId: string): RateLimiter {
  if (!rateLimiters.has(tenantId)) {
    rateLimiters.set(tenantId, {
      tokens: 80,  // Start with full bucket
      maxTokens: 80,  // Meta Tier 2 limit
      refillRate: 80 / 60,  // 80 messages per minute = 1.33/sec
      lastRefill: Date.now()
    });
  }
  return rateLimiters.get(tenantId)!;
}
```

---

## 5. NON-FUNCTIONAL REQUIREMENTS

### 5.1 Performance (NFR-PERF-01)

#### 5.1.1 Throughput
- **Target:** 50 messages/second (aggregate across all tenants)
- **Peak:** 100 messages/second (burst capacity)
- **Per Tenant:** Dynamically limited based on Meta API tier

#### 5.1.2 Latency
- **Message Processing Time:** < 500ms (p95)
- **Meta API Response Time:** < 2 seconds (p95)
- **End-to-End Latency:** < 3 seconds (queue → Meta confirmation)

#### 5.1.3 Resource Limits
```yaml
resources:
  cpu: "2 cores"
  memory: "2Gi"
  maxConnections: 100
  maxConcurrentRequests: 50
```

---

### 5.2 Reliability (NFR-REL-01)

#### 5.2.1 Availability
- **Target SLA:** 99.9% uptime
- **Max Downtime:** 43 minutes per month
- **Recovery Time:** < 5 minutes (auto-restart)

#### 5.2.2 Durability
- **Message Loss:** Zero message loss (at-least-once delivery)
- **Data Persistence:** RabbitMQ messages persisted to disk
- **Backup:** Logs retained for 30 days

---

### 5.3 Observability (NFR-OBS-01)

#### 5.3.1 Metrics to Expose (Prometheus)
```typescript
// Counter metrics
metrics.counter('messages.consumed.total', { tenant, status })
metrics.counter('messages.delivered.total', { tenant })
metrics.counter('messages.failed.total', { tenant, error_code })
metrics.counter('meta_api.requests.total', { tenant, status_code })

// Histogram metrics
metrics.histogram('message.processing.duration', { tenant })
metrics.histogram('meta_api.request.duration', { tenant })
metrics.histogram('credential.fetch.duration', { tenant })

// Gauge metrics
metrics.gauge('rabbitmq.queue.depth', { queue: 'outbound-processed' })
metrics.gauge('tenant.circuit_breaker.state', { tenant, state })
metrics.gauge('tenant.rate_limit.available', { tenant })
```

#### 5.3.2 Logging Requirements
```typescript
// Structured logging format (JSON)
interface LogEntry {
  timestamp: string;  // ISO 8601
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  service: 'whatsapp-api-service';
  version: string;
  event: string;
  tenantId?: string;
  internalId?: string;
  wamid?: string;
  duration?: number;
  errorCode?: string;
  errorMessage?: string;
  fbtrace?: string;
  [key: string]: any;
}

// Example log entries
logger.info({
  event: 'message_consumed',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  internalId: 'msg-12345',
  messageType: 'text'
});

logger.error({
  event: 'meta_api_error',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  internalId: 'msg-12345',
  errorCode: 131047,
  errorMessage: 'Session expired',
  fbtrace: 'AXYZabcdef123456',
  retryCount: 0
});
```

#### 5.3.3 Health Check Endpoint
```
GET /health

Response:
{
  "status": "healthy" | "degraded" | "unhealthy",
  "version": "1.1.0",
  "uptime": 86400,  // seconds
  "checks": {
    "rabbitmq": {
      "status": "connected",
      "latency": 5  // milliseconds
    },
    "tenantService": {
      "status": "reachable",
      "latency": 12  // milliseconds
    },
    "metaApi": {
      "status": "reachable",
      "latency": 150  // milliseconds
    }
  },
  "metrics": {
    "messagesProcessedLast1Min": 42,
    "errorRateLast1Min": 0.02,  // 2%
    "queueDepth": 10
  }
}
```

---

### 5.4 Security (NFR-SEC-01)

#### 5.4.1 Token Handling
- **Storage:** Tokens MUST NOT be logged in plaintext
- **Transmission:** HTTPS only for all external communications
- **Caching:** In-memory cache only (no disk persistence)

#### 5.4.2 Log Sanitization
```typescript
function sanitizeLog(obj: any): any {
  const sensitive = ['token', 'accessToken', 'systemUserAccessToken', 'password'];
  
  return Object.keys(obj).reduce((acc, key) => {
    if (sensitive.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
      acc[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object') {
      acc[key] = sanitizeLog(obj[key]);
    } else {
      acc[key] = obj[key];
    }
    return acc;
  }, {} as any);
}
```

---

## 6. TESTING REQUIREMENTS

### 6.1 Unit Tests

#### 6.1.1 Test Coverage Requirements
- **Minimum Coverage:** 80%
- **Critical Paths:** 100% (message processing, error handling)

#### 6.1.2 Test Scenarios
```typescript
describe('Message Processing', () => {
  test('should successfully send text message to Meta API', async () => {
    // Arrange
    const mockMessage = createMockTextMessage();
    const mockCredentials = createMockCredentials();
    
    // Act
    const result = await processMessage(mockMessage);
    
    // Assert
    expect(result.status).toBe('delivered');
    expect(result.wamid).toBeDefined();
  });
  
  test('should handle template not found error (2388001)', async () => {
    // Arrange
    const mockMessage = createMockTemplateMessage();
    metaApiMock.mockRejectedValue(createMetaError(100, 2388001));
    
    // Act
    await processMessage(mockMessage);
    
    // Assert
    expect(channelMock.ack).toHaveBeenCalledWith(mockMessage);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errorSubcode: 2388001 })
    );
  });
  
  test('should retry on 500 error with exponential backoff', async () => {
    // Arrange
    const mockMessage = createMockTextMessage();
    metaApiMock
      .mockRejectedValueOnce(createMetaError(500))
      .mockResolvedValueOnce({ messages: [{ id: 'wamid.123' }] });
    
    // Act
    await processMessage(mockMessage);
    
    // Assert
    expect(metaApiMock).toHaveBeenCalledTimes(2);
    expect(channelMock.ack).toHaveBeenCalledWith(mockMessage);
  });
  
  test('should invalidate cache on 401 error', async () => {
    // Arrange
    const mockMessage = createMockTextMessage();
    metaApiMock.mockRejectedValue(createMetaError(190));
    
    // Act
    await processMessage(mockMessage);
    
    // Assert
    expect(credentialCache.invalidate).toHaveBeenCalledWith(
      mockMessage.metadata.tenantId
    );
  });
});
```

---

### 6.2 Integration Tests

#### 6.2.1 Test Scenarios
1. **End-to-End Message Delivery**
   - Publish message to RabbitMQ
   - Verify Meta API receives correct payload
   - Verify message acknowledged

2. **Credential Retrieval**
   - Mock Tenant Service responses
   - Verify caching behavior
   - Verify cache invalidation on errors

3. **Error Handling**
   - Simulate various Meta API errors
   - Verify correct retry/no-retry behavior
   - Verify DLQ routing

4. **Rate Limiting**
   - Send burst of messages for one tenant
   - Verify rate limit enforcement
   - Verify other tenants unaffected

---

### 6.3 Load Tests

#### 6.3.1 Test Parameters
```yaml
loadTest:
  duration: "10m"
  rampUp: "1m"
  tenants: 10
  messagesPerSecond: 50
  messageTypes:
    - text: 70%
    - template: 20%
    - media: 10%
```

#### 6.3.2 Success Criteria
- **Throughput:** Sustain 50 msg/s for 10 minutes
- **Error Rate:** < 1%
- **Latency (p95):** < 3 seconds
- **Memory:** Stable (no leaks)
- **CPU:** < 80% utilization

---

## 7. DEPLOYMENT SPECIFICATIONS

### 7.1 Environment Variables
```bash
# Service Configuration
NODE_ENV=production
SERVICE_PORT=8080
LOG_LEVEL=info

# RabbitMQ
RABBITMQ_HOST=rabbitmq.internal.svc.cluster.local
RABBITMQ_PORT=5672
RABBITMQ_USER=whatsapp-service
RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD}  # From secret
RABBITMQ_VHOST=/whatsapp
RABBITMQ_QUEUE=outbound-processed
RABBITMQ_PREFETCH=10

# Tenant Service
TENANT_SERVICE_URL=http://tenant-service.internal.svc.cluster.local:8080
TENANT_SERVICE_TIMEOUT=5000

# Meta API
META_API_BASE_URL=https://graph.facebook.com
META_API_VERSION=v18.0
META_API_TIMEOUT=10000
META_API_MAX_RETRIES=3

# Caching
CREDENTIAL_CACHE_TTL=900000  # 15 minutes

# Observability
PROMETHEUS_PORT=9090
HEALTH_CHECK_PORT=8081
```

### 7.2 Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: whatsapp-api-service
  namespace: whatsapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: whatsapp-api-service
  template:
    metadata:
      labels:
        app: whatsapp-api-service
    spec:
      containers:
      - name: whatsapp-api-service
        image: whatsapp-api-service:1.1.0
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        - containerPort: 8081
          name: health
        env:
        - name: NODE_ENV
          value: "production"
        - name: RABBITMQ_PASSWORD
          valueFrom:
            secretKeyRef:
              name: rabbitmq-credentials
              key: password
        resources:
          requests:
            cpu: "1"
            memory: "1Gi"
          limits:
            cpu: "2"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 8081
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8081
          initialDelaySeconds: 10
          periodSeconds: 5
```

---

## 8. MONITORING AND ALERTS

### 8.1 Critical Alerts

#### 8.1.1 Service Down
```yaml
alert: ServiceDown
expr: up{job="whatsapp-api-service"} == 0
for: 1m
severity: critical
message: "WhatsApp API Service is down"
```

#### 8.1.2 High Error Rate
```yaml
alert: HighErrorRate
expr: |
  rate(messages_failed_total[5m]) / rate(messages_consumed_total[5m]) > 0.05
for: 5m
severity: warning
message: "Error rate > 5% for WhatsApp API Service"
```

#### 8.1.3 Queue Depth Growing
```yaml
alert: QueueDepthHigh
expr: rabbitmq_queue_messages{queue="outbound-processed"} > 1000
for: 10m
severity: warning
message: "Outbound queue depth > 1000 messages"
```

#### 8.1.4 Credential Fetch Failures
```yaml
alert: CredentialFetchFailures
expr: |
  increase(tenant_service_errors_total[5m]) > 10
for: 5m
severity: critical
message: "Multiple credential fetch failures from Tenant Service"
```

---

## 9. APPENDIX

### 9.1 Meta API Rate Limits by Tier

| Tier | Messages/Second | Messages/Day | Registration |
|------|----------------|--------------|--------------|
| Tier 1 | 20 | 1,000 | Default |
| Tier 2 | 80 | 10,000 | Verified Business |
| Tier 3 | 200 | 100,000 | High Volume |
| Tier 4 | 400 | 1,000,000 | Enterprise |

### 9.2 Meta API Error Code Reference

**Complete list:** https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes

**Most Common Errors:**
- `100`: Invalid parameter
- `190`: Invalid OAuth access token
- `4`: Rate limit exceeded
- `131047`: 24-hour window expired / recipient not opted in
- `2388001`: Template does not exist
- `2388003`: Invalid phone number
- `2388054`: Phone number not registered

### 9.3 Example cURL Commands for Testing

```bash
# Test Meta API directly
curl -X POST \
  "https://graph.facebook.com/v18.0/{phone_number_id}/messages" \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "919876543210",
    "type": "text",
    "text": { "body": "Test message" }
  }'

# Publish test message to RabbitMQ
curl -X POST \
  "http://localhost:15672/api/exchanges/whatsapp/whatsapp-exchange/publish" \
  -u "guest:guest" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {},
    "routing_key": "outbound.processed.tenant-123",
    "payload": "{\"metadata\":{\"tenantId\":\"tenant-123\",\"phoneNumberId\":\"100000001\",\"internalId\":\"msg-test-001\"},\"wabaPayload\":{\"messaging_product\":\"whatsapp\",\"to\":\"919876543210\",\"type\":\"text\",\"text\":{\"body\":\"Test message\"}}}",
    "payload_encoding": "string"
  }'
```

---

## 10. GLOSSARY

- **WABA:** WhatsApp Business Account
- **WAMID:** WhatsApp Message ID (format: `wamid.{base64}`)
- **System User Token:** Long-lived access token for Meta Graph API
- **Phone Number ID:** Meta's unique identifier for a WhatsApp business phone number
- **Graph API:** Meta's HTTP API for WhatsApp Business Platform
- **24-Hour Window:** Customer service session window (timer resets when customer messages)
- **Template Message:** Pre-approved message template (required outside 24h window)
- **ACK:** Acknowledge (remove message from queue)
- **NACK:** Negative Acknowledge (reject message, optionally requeue)
- **DLQ:** Dead Letter Queue (for permanently failed messages)
- **Circuit Breaker:** Pattern to prevent cascading failures
- **Backpressure:** Technique to slow down message consumption when downstream is overloaded

---

**Document End**
--- END whatsapp-api-service/whatsapp-api-frd.md ---


--- BEGIN whatsapp-webhook-service/whatsapp-webhook-frd.md ---

# Functional Requirements Document

## WhatsApp Webhook Service

**Service Name:** `whatsapp-webhook-service`

**Version:** 1.1 (Updated)

**Parent Document:** System Design Document

---

# 1. Overview

The **WhatsApp Webhook Service** is the entry point for all incoming traffic from the Meta (WhatsApp Business) Platform. It is responsible for receiving webhook events, validating their authenticity, handling media assets, and buffering the data into RabbitMQ for asynchronous processing.

---

## 1.1 Primary Responsibilities

\begin{itemize}
\item Ingress Security: Validating the X-Hub-Signature-256 header to ensure requests come from Meta.
\item Verification: Handling the initial GET verification challenge from Meta during setup.
\item Media Handling: Detecting media messages, downloading the binary content from Meta's CDN, and uploading it to the private MinIO media-inbound bucket.
\item Buffering: Pushing the validated payload (with MinIO URLs injected) to the RabbitMQ-inboundQueue.
\end{itemize}

---

# 2. Dependencies

\begin{table}
\begin{tabular}{|l|l|}
\hline
Dependency & Purpose \\
\hline
RabbitMQ & Destination for raw inbound messages \\
MinIO & Storage for downloaded media files \\
Tenant Service & To resolve tenant\_id from phone\_number\_id and retrieve app\_secret \\
\hline
\end{tabular}
\end{table}

---

# 3. Data Architecture

---

## 3.1 Input (HTTP Webhook)

The service accepts the standard Meta Graph API Webhook format.

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "123456789",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "...",
          "phone_number_id": "..."
        },
        "contacts": [{
          "profile": { "name": "John Doe" },
          "wa_id": "919876543210"
        }],
        "messages": [{
          "from": "919876543210",
          "id": "wamid.HBg...",
          "timestamp": "1700000000",
          "type": "image",
          "image": {
            "id": "media-id-123",
            "mime_type": "image/jpeg"
          }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

---

## 3.2 Output (RabbitMQ Payload)

The service normalizes the nested Meta structure into a flatter internal event object.

**Queue:** RabbitMQ-inboundQueue

```json
{
  "tenantId": "resolved-from-phone-number-id",
  "waId": "919876543210",
  "wamid": "wamid.HBg...",
  "timestamp": 1700000000,
  "contactName": "John Doe",
  "type": "message",
  "payload": {
    "type": "image",
    "id": "media-id-123",
    "mime_type": "image/jpeg",
    "media_url": "https://minio.internal/media-inbound/..."
  }
}
```

**Note:** Status events like read/delivered follow a similar structure but with `type: "event"`

---

# 4. Functional Specifications

---

# 4.1 Webhook Verification (Setup)

**Requirement ID: REQ-IN-01**

**Trigger:** HTTP GET /webhook

**Input:** Query params `hub.mode`, `hub.verify_token`, `hub.challenge`

### Logic

\begin{enumerate}
\item Verify `hub.mode` is `subscribe`.
\item Verify `hub.verify_token` matches the configured environment variable `WEBHOOK_VERIFY_TOKEN`.
\item If valid, return `hub.challenge` as plain text with 200 OK.
\item If invalid, return 403 Forbidden.
\end{enumerate}

---

# 4.2 Message Reception and Validation

**Requirement ID: REQ-IN-01, REQ-SEC-01**

**Trigger:** HTTP POST /webhook

### Logic

\begin{enumerate}
\item **Tenant Resolution:**
  \begin{itemize}
  \item Extract `metadata.phone_number_id` from the payload.
  \item Call Tenant Service endpoint `GET /tenants/resolve/:phoneNumberId` to get the `tenant_id` and the `app_secret` (WABA credentials).
  \item If not found, return 404 (or 200 to Meta to stop retries if it's a misconfiguration).
  \end{itemize}

\item **Signature Check:**
  \begin{itemize}
  \item Calculate HMAC-SHA256 of the request body using the retrieved `app_secret`.
  \item Compare with `X-Hub-Signature-256`.
  \item If mismatch, log security warning and return 403 Forbidden.
  \end{itemize}

\item **Parsing:**
  \begin{itemize}
  \item Extract the `messages` or `statuses` array.
  \item Process each item individually.
  \end{itemize}
\end{enumerate}

---

# 4.3 Media Processing

**Requirement ID: REQ-IN-03, REQ-IN-04**

**Condition:** Message type is `image`, `video`, `document`, `audio`, or `sticker`.

### Logic

\begin{enumerate}
\item Get the Media ID from the payload.
\item Call Meta API: `GET /{media-id}` to retrieve the download URL.
  \begin{itemize}
  \item Use the tenant's WABA System User Token (retrieved via Auth Service or Tenant Service credentials).
  \end{itemize}
\item Download the binary file.
\item Upload to MinIO bucket `media-inbound` with key: `/{tenantId}/{year}/{month}/{uuid}.{ext}`.
\item Generate a Presigned URL (valid for 7 days, or per config).
\item Inject this `media_url` into the message payload before queuing.
\end{enumerate}

---

# 4.4 Queue Dispatch

**Requirement ID: REQ-IN-06** (Triggering State Manager)

### Logic

\begin{enumerate}
\item Wrap the parsed data into the Internal Event structure.
\item Publish to RabbitMQ-inboundQueue.
\item **Ack:** Return HTTP 200 to Meta after successful publishing.
  \begin{itemize}
  \item If RabbitMQ fails, return 500 to trigger Meta retry.
  \end{itemize}
\end{enumerate}

---

# 5. Non-Functional Requirements

\begin{itemize}
\item **Availability:** 99.9\% uptime. (Meta disables webhooks after consecutive failures).

\item **Latency:** Must accept and queue the request within 3 seconds (Meta timeout).
  \begin{itemize}
  \item Heavy processing (like media download) should be asynchronous if file sizes are large, though the current design blocks response until queued to ensure data safety.
  \item **Refinement:** Consider downloading media in the background if 3s timeout becomes an issue.
  \end{itemize}

\item **Security:** App Secret must be stored securely.
\end{itemize}

---

# Final Summary

The WhatsApp Webhook Service is the critical ingress point that:

\begin{itemize}
\item Validates all incoming Meta webhook requests via signature verification
\item Handles initial webhook verification for setup
\item Downloads and stores media assets in MinIO
\item Normalizes Meta's nested payload structure
\item Buffers validated events into RabbitMQ for downstream processing
\item Ensures tenant isolation through proper credential resolution
\item Maintains strict security and performance requirements
\end{itemize}

This service acts as the secure gateway between Meta's platform and the internal message processing pipeline, ensuring data integrity, security, and reliable message flow.

---
--- END whatsapp-webhook-service/whatsapp-webhook-frd.md ---

