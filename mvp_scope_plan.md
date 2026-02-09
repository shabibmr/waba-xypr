# MVP Scope Plan - WABA-Genesys Integration

## 🎯 Objective
Demonstrate complete **inbound** (WhatsApp → Genesys) and **outbound** (Genesys → WhatsApp) message flows with **text and media support**, involving all backend services.

---

## ✅ In Scope

### Message Types
- **Text messages** (bidirectional)
- **Media messages** (images, documents, videos)
  - Download from source platform (WhatsApp/Genesys)
  - Store in MinIO with presigned URLs
  - Forward to destination platform
  - Basic media type detection (no validation/scanning)

### Services (All 10 Core Services)
1. **tenant-service** - Tenant management & credentials
2. **auth-service** - OAuth token handling (Genesys + WhatsApp)
3. **state-manager** - Conversation mappings & message tracking
4. **whatsapp-webhook-service** - Inbound entry point + media download
5. **inbound-transformer** - WhatsApp → Genesys format transformation
6. **genesys-api-service** - Send messages to Genesys Cloud
7. **genesys-webhook-service** - Outbound entry point + media detection
8. **outbound-transformer** - Genesys → WhatsApp format + media handling
9. **whatsapp-api-service** - Send messages to WhatsApp Cloud
10. **api-gateway** - Routing & centralized entry point

### Frontend
- **agent-portal** (Customer Portal) - Basic onboarding flow

### Infrastructure
- **Redis** - Caching (tenant config, tokens, conversation mappings)
- **PostgreSQL** - Persistence (tenants, credentials, conversation mappings, message tracking)
- **RabbitMQ** - Async processing queues
- **MinIO** - Webhook payloads & media storage

### Features
- Single demo tenant (simplified multi-tenancy)
- Bidirectional conversation mapping (wa_id ↔ conversation_id)
- Message tracking with status updates
- Token caching (Genesys: 55min TTL, WhatsApp: 24h TTL)
- Presigned URLs for media access
- Basic customer portal with onboarding

---

## ❌ Out of Scope (Post-MVP)

### Advanced Features
- Multi-tenant isolation & rate limiting
- Advanced error handling & retry mechanisms (exponential backoff)
- Webhook signature validation (optional for demo)
- Production-grade security
- Full analytics & reporting dashboards
- Payment/subscription features
- Advanced agent widget features

### Advanced Media Features
- Media validation & virus scanning
- Thumbnail generation
- Media format conversion
- Size/duration limits enforcement
- Media compression

---

## 📊 Success Criteria

### End-to-End Flows
1. ✅ **Inbound Text**: Customer sends WhatsApp text → Agent receives in Genesys
2. ✅ **Inbound Media**: Customer sends WhatsApp image → Agent views image in Genesys
3. ✅ **Outbound Text**: Agent replies in Genesys → Customer receives on WhatsApp
4. ✅ **Outbound Media**: Agent sends document in Genesys → Customer receives on WhatsApp

### Technical Verification
- All 10 services running and communicating
- Database shows conversation mappings & message tracking (with media fields)
- Redis cache shows tenant config, tokens, and mappings
- MinIO contains webhook payloads and media files
- RabbitMQ queues processing messages
- Customer portal successfully onboards demo tenant

---

## 🏗️ Flow Summary

### Inbound (WhatsApp → Genesys)
```
Customer (WhatsApp) 
  → Meta API 
  → API Gateway 
  → WhatsApp Webhook Service (download media, store MinIO, queue RabbitMQ)
  → RabbitMQ
  → Inbound Transformer (transform, get conversation mapping)
  → State Manager (resolve/create mapping)
  → Genesys API Service (get OAuth token)
  → Genesys Cloud
  → Agent Desktop
```

### Outbound (Genesys → WhatsApp)
```
Agent Desktop
  → Genesys Cloud
  → API Gateway
  → Genesys Webhook Service (detect media, store MinIO, queue RabbitMQ)
  → RabbitMQ
  → Outbound Transformer (download media, transform, reverse mapping)
  → State Manager (resolve conversation → wa_id)
  → WhatsApp API Service (get token)
  → Meta WhatsApp API
  → Customer (WhatsApp)
```

---

## 📁 Key Database Tables

### tenants
- id, name, phone_number_id, genesys_integration_id, status

### tenant_credentials
- tenant_id, credential_type (genesys/whatsapp), credentials (JSONB)

### conversation_mappings
- tenant_id, wa_id, conversation_id, contact_name, created_at, last_activity_at

### message_tracking
- conversation_id, meta_message_id, genesys_message_id, direction, status, **media_type, media_url**

---

## 📦 MinIO Buckets

- `webhooks-inbound/` - Raw WhatsApp webhook payloads
- `webhooks-outbound/` - Raw Genesys webhook payloads
- `media-inbound/` - WhatsApp media files (images, documents, videos)
- `media-outbound/` - Genesys media files (images, documents, videos)

---

## 🔑 Redis Keys

```
phone:{phone_number_id} → {tenant_id, status, config}
integration:{genesys_integration_id} → {tenant_id, config}
tenant:{tenantId}:oauth:token → {accessToken, expiresAt}
tenant:{tenantId}:whatsapp:token → {accessToken, phoneNumberId}
mapping:wa:{waId} → {conversationId, tenantId}
mapping:conv:{conversationId} → {waId, tenantId}
```

---

## 🚀 Next Steps After MVP

1. Multi-tenant isolation & rate limiting
2. Advanced media features (validation, thumbnails, compression)
3. Retry mechanisms with exponential backoff
4. Webhook signature validation
5. Comprehensive analytics dashboard
6. Payment/subscription integration
7. Advanced agent widget features
8. Production security hardening
