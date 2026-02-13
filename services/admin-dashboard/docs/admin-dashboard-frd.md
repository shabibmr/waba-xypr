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
* admin-aggregation-service (NEW - for cross-tenant queries)
* tenant-service
* state-manager (via aggregator)
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

Service: `admin-aggregation-service`

### Logic

1. **Call Aggregator**: `GET /admin/aggregate/trace/:messageId`
2. **Aggregator Behavior**:
    - **Targeted Mode**: If tenant known (from index), query specific Tenant DB.
    - **Broadcast Mode**: If unknown, parallel query all active Tenant DBs.
3. **Response**, Returns unified lifecycle + source tenant ID.

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
