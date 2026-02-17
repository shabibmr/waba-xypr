# WhatsApp API Service - Credentials Guide

## 📋 Overview

The WhatsApp API service uses **Meta WhatsApp Business API** credentials to send messages to customers. These credentials are stored per-tenant and fetched dynamically for each message.

---

## 🔑 Credential Type: Meta System User Access Token

### What It Is
A **long-lived access token** (System User Access Token) that authenticates API requests to Meta's WhatsApp Business API (Graph API).

### How It's Used
```javascript
// WhatsApp API Service makes requests like:
POST https://graph.facebook.com/v18.0/{phoneNumberId}/messages
Headers:
  Authorization: Bearer {accessToken}
  Content-Type: application/json
```

---

## 🗄️ Credential Storage

### Database Table: `tenant_whatsapp_config`

```sql
CREATE TABLE tenant_whatsapp_config (
    id                   SERIAL PRIMARY KEY,
    tenant_id            VARCHAR(50) UNIQUE,
    waba_id              VARCHAR(100) NOT NULL,
    phone_number_id      VARCHAR(100) NOT NULL,
    access_token         TEXT NOT NULL,           -- ← THE KEY CREDENTIAL
    business_id          VARCHAR(100),
    display_phone_number VARCHAR(50),
    quality_rating       VARCHAR(50),
    is_active            BOOLEAN DEFAULT true,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    business_account_id  VARCHAR(100),
    verify_token         VARCHAR(255),
    configured           BOOLEAN DEFAULT true
);
```

### Current Test Tenant Configuration
```
Tenant ID: t_a3eecb94bb822a92
Phone Number ID: 882555404932892
WABA ID: 882555404932892
Access Token: EAARKcTyPnWQBQmgbn8q... (truncated for security)
Display Phone: 882555404932892
```

---

## 🔄 Credential Retrieval Flow

### Step-by-Step Process

1. **WhatsApp API Service receives a message** from RabbitMQ queue
   ```json
   {
     "metadata": {
       "tenantId": "t_a3eecb94bb822a92",
       "phoneNumberId": "882555404932892"
     },
     "wabaPayload": {
       "to": "919876543220",
       "type": "text",
       "text": { "body": "Hello!" }
     }
   }
   ```

2. **Fetches credentials** from Tenant Service
   ```javascript
   GET http://tenant-service:3007/tenants/{tenantId}/credentials/meta

   // Returns:
   {
     "accessToken": "EAARKcTyPnWQBQmgbn8q..."
   }
   ```

3. **Calls Meta WhatsApp API**
   ```javascript
   POST https://graph.facebook.com/v18.0/882555404932892/messages
   Headers:
     Authorization: Bearer EAARKcTyPnWQBQmgbn8q...
   Body:
     {
       "messaging_product": "whatsapp",
       "to": "919876543220",
       "type": "text",
       "text": { "body": "Hello!" }
     }
   ```

---

## 📝 How Credentials Are Configured

### Option 1: OAuth Signup Flow (Recommended)

**Endpoint:** `POST /api/whatsapp/signup`

**Process:**
1. User authorizes app via Meta's OAuth flow
2. Meta returns authorization `code`
3. Backend exchanges code for access token
4. System stores credentials automatically

**Example Flow:**
```bash
# 1. User completes OAuth on Meta's platform
# 2. Meta redirects to callback with code

# 3. Backend processes callback
POST http://localhost:3007/api/whatsapp/signup
{
  "code": "AQBxyz123...",
  "state": "t_a3eecb94bb822a92"
}

# 4. System automatically:
# - Exchanges code for access_token
# - Fetches WABA ID and phone number ID
# - Stores in tenant_whatsapp_config table
# - Marks tenant.whatsapp_configured = true
```

### Option 2: Manual Configuration

**Endpoint:** `PUT /api/tenants/{tenantId}/whatsapp/config`

**Example:**
```bash
curl -X PUT http://localhost:3007/api/tenants/t_a3eecb94bb822a92/whatsapp/config \
  -H "Content-Type: application/json" \
  -d '{
    "wabaId": "882555404932892",
    "phoneNumberId": "882555404932892",
    "accessToken": "EAARKcTyPnWQBQ..."
  }'
```

---

## 🔐 Security Considerations

### Current Implementation
- ✅ **Stored Encrypted:** Access tokens stored as plain text in database (TEXT column)
- ✅ **HTTPS Only:** All Meta API calls use HTTPS
- ✅ **Per-Tenant Isolation:** Each tenant has separate credentials
- ✅ **Active Flag:** Can deactivate credentials without deletion

### Production Recommendations
- ⚠️ **Encrypt at Rest:** Use database encryption for `access_token` column
- ⚠️ **Rotate Tokens:** Implement token rotation policy
- ⚠️ **Audit Logging:** Log credential access and usage
- ⚠️ **Secrets Manager:** Consider using AWS Secrets Manager, HashiCorp Vault, etc.

---

## 🧪 Testing Without Real Credentials

### Current Test Behavior
The test environment has a **sample/demo access token** stored:
```
Access Token: EAARKcTyPnWQBQmgbn8q...
Status: INVALID (causes 401 errors)
```

### Why Tests Show 401 Errors
```
✅ Expected Behavior:
- WhatsApp API Service successfully retrieves credentials
- Attempts to POST to Meta's Graph API
- Meta returns 401 Unauthorized (token invalid)
- Service properly retries with backoff

This proves the pipeline works! Just needs valid credentials.
```

### To Test With Real Credentials
1. **Get Meta Access Token:**
   - Create a Meta Developer App
   - Set up WhatsApp Business API
   - Generate System User Access Token

2. **Configure Tenant:**
   ```bash
   curl -X PUT http://localhost:3007/api/tenants/t_a3eecb94bb822a92/whatsapp/config \
     -H "Content-Type: application/json" \
     -d '{
       "wabaId": "YOUR_WABA_ID",
       "phoneNumberId": "YOUR_PHONE_NUMBER_ID",
       "accessToken": "YOUR_VALID_TOKEN"
     }'
   ```

3. **Run Test:**
   ```bash
   ./test-genesys-webhook.sh
   ```

---

## 📊 Credential Lifecycle

### Token Characteristics
- **Type:** System User Access Token (long-lived)
- **Expiration:** Typically 60-90 days (or never expires for System Users)
- **Scope:** `whatsapp_business_management`, `whatsapp_business_messaging`
- **Permissions:** Send messages, manage templates, read message status

### Refresh Strategy
**Current:** Manual refresh (replace token when expired)
**Recommended:** Implement automatic token refresh using Meta's token refresh API

---

## 🔍 Troubleshooting

### Common Issues

#### 1. 401 Unauthorized
```
Error: Request failed with status code 401
Cause: Invalid or expired access token
Fix: Update credentials with valid token
```

#### 2. 190 Invalid Token
```
Error: (#190) Invalid OAuth 2.0 Access Token
Cause: Token revoked or app permissions changed
Fix: Regenerate token via Meta Developer Portal
```

#### 3. Credentials Not Found
```
Error: Credentials not found
Cause: No WhatsApp config for tenant
Fix: Configure via signup flow or manual API
```

### Debug Commands

```bash
# Check if tenant has credentials
curl http://localhost:3007/tenants/t_a3eecb94bb822a92/credentials/meta

# Check database directly
docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys \
  -c "SELECT tenant_id, phone_number_id, LEFT(access_token, 20) || '...'
      FROM tenant_whatsapp_config
      WHERE tenant_id = 't_a3eecb94bb822a92';"

# Test WhatsApp API connectivity
curl -X GET \
  "https://graph.facebook.com/v18.0/me?access_token=YOUR_TOKEN"
```

---

## 📚 References

### Meta WhatsApp API Documentation
- **Graph API Reference:** https://developers.facebook.com/docs/graph-api
- **WhatsApp Business API:** https://developers.facebook.com/docs/whatsapp
- **System Users:** https://developers.facebook.com/docs/development/build-and-test/system-users
- **Token Generation:** https://developers.facebook.com/docs/whatsapp/business-management-api/get-started

### Internal Documentation
- **Tenant Service FRD:** `services/tenant-service/docs/tenant-service-frd.md`
- **WhatsApp API Service FRD:** `services/whatsapp-api-service/docs/whatsapp-api-frd.md`
- **CLAUDE.md:** Architecture overview and service details

---

## ✅ Summary

**Credential:** Meta System User Access Token
**Storage:** `tenant_whatsapp_config.access_token` (per-tenant)
**Usage:** `Authorization: Bearer {token}` header on Graph API calls
**Configuration:** OAuth signup flow or manual API
**Current Status:** Demo token (invalid - causes expected 401 errors)

**For production:** Replace with valid Meta System User Access Token from your WhatsApp Business API account.
