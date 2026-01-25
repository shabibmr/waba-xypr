# Multi-Tenant WhatsApp Implementation - Outbound Transformer

## Overview

Successfully removed the hardcoded `META_ACCESS_TOKEN` and implemented tenant-specific WhatsApp credential fetching in the Outbound Transformer service.

## Changes Made

### 1. Configuration Updates (`src/config/index.js`)

**Removed:**
- `meta.accessToken` - No longer using hardcoded token
- `meta.appSecret` - Not needed for message sending

**Added:**
- `services.tenantService` - Tenant Service URL for credential fetching

### 2. New Tenant Service (`src/services/tenant.service.js`)

**Created new file** to fetch tenant-specific WhatsApp credentials:

```javascript
getTenantWhatsAppCredentials(tenantId)
```

Returns:
- `accessToken` - Tenant's Meta access token
- `phoneNumberId` - Tenant's WhatsApp phone number ID
- `wabaId` - Tenant's WhatsApp Business Account ID

### 3. WhatsApp Service Updates (`src/services/whatsapp.service.js`)

**Updated functions** to accept tenant-specific access token:

- `sendMessage(phoneNumberId, message, accessToken` ← Added parameter
- `sendTemplateMessage(..., accessToken)` ← Added parameter

### 4. Message Processor Updates (`src/services/message-processor.service.js`)

**Updated flow:**

1. Get conversation mapping (includes `tenantId`)
2. **Fetch tenant WhatsApp credentials** from tenant-service
3. Transform message to Meta format
4. Send via WhatsApp API with **tenant-specific access token**
5. Track message delivery

### 5. State Service Updates (`src/services/state.service.js`)

**Updated documentation** to reflect that `getConversationMapping` returns:
- `waId` - WhatsApp user ID
- `phoneNumberId` - Phone number ID
- **`tenantId`** - Tenant identifier

## How It Works

### Message Flow

```
1. RabbitMQ Queue → Outbound Message
   ↓
2. Get Conversation Mapping (includes tenantId)
   ↓
3. Fetch Tenant WhatsApp Credentials
   ├─ accessToken
   ├─ phoneNumberId
   └─ wabaId
   ↓
4. Transform to Meta Format
   ↓
5. Send to Meta WhatsApp API
   (with tenant-specific token)
   ↓
6. Track Message Status
```

## Dependencies

**Must be configured in Tenant Service:**
- Each tenant must have WhatsApp configuration:
  - `meta_access_token`
  - `whatsapp_phone_number_id`
  - `whatsapp_business_account_id`

**Endpoint used:**
```
GET /api/tenants/:tenantId/whatsapp/config
```

## Environment Variables

### Removed (No longer needed)
- ~~`META_ACCESS_TOKEN`~~ - Now fetched per-tenant
- ~~`META_APP_SECRET`~~ - Not needed for outbound

### Required
- `TENANT_SERVICE_URL` - URL of tenant service (default: http://tenant-service:3007)
- `STATE_SERVICE_URL` - URL of state manager
- `RABBITMQ_URL` - RabbitMQ connection string

## Benefits

✅ **True Multi-Tenancy** - Each organization uses their own WABA  
✅ **Credential Isolation** - No shared tokens between tenants  
✅ **Dynamic Configuration** - Change WhatsApp credentials without redeploying  
✅ **Better Security** - Credentials stored securely in tenant service  
✅ **Scalability** - Support unlimited tenants with different WABAs  

## Testing

### 1. Ensure Tenant Has WhatsApp Config
```bash
curl http://localhost:3007/api/tenants/test-tenant/whatsapp/config
```

### 2. Send Test Message
Publish a message to the outbound queue and verify:
- Tenant credentials are fetched correctly
- Message is sent with correct access token
- No errors in logs

### 3. Check Logs
```
Processing outbound message: msg-123
Using WhatsApp credentials for tenant: test-tenant
Message sent to WhatsApp: wamid.xxx
```

## Migration Notes

**For Existing Deployments:**
1. Ensure all tenants have WhatsApp configuration in tenant-service
2. Remove `META_ACCESS_TOKEN` from environment variables
3. Deploy updated outbound-transformer
4. Verify messages are still sending correctly

## Next Steps

- ✅ Outbound Transformer: Multi-tenant WhatsApp support
- ⏳ Inbound Transformer: Verify tenant resolution
- ⏳ WhatsApp Webhook: Verify tenant resolution from phone number
- ⏳ Genesys Webhook: Verify tenant resolution from organization
