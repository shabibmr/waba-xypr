# Multi-Tenant WhatsApp-Genesys Integration Guide

## Answer to Your Question

**No, the original architecture does NOT support multi-tenancy out of the box.** 

The initial implementation was designed for **single-tenant deployment** where each organization runs their own isolated instance with their own credentials.

## What's Been Added for Multi-Tenancy

I've now provided the complete multi-tenant enhancements:

### ✅ New Components Added

1. **Tenant Service** (Port 3007) - Manages tenant onboarding, credentials, and API keys
2. **Tenant Resolver Middleware** - Extracts tenant context from requests
3. **Updated Services** - All services now filter by tenant_id
4. **Tenant-Aware Caching** - Redis keys prefixed with tenant_id
5. **Credential Management** - Store multiple Meta/Genesys credentials per tenant

### 🔑 Key Multi-Tenant Features

- **Tenant Identification**: Via subdomain, API key, or JWT token
- **Data Isolation**: All queries filtered by tenant_id
- **Credential Management**: Each tenant has their own Meta/Genesys credentials
- **Rate Limiting**: Per-tenant rate limits
- **Usage Tracking**: Tenant-specific statistics and billing data
- **API Key Management**: Generate multiple API keys per tenant

## Setup Instructions

### 1. Update Docker Compose

Add the tenant service to `docker-compose.yml`:

```yaml
tenant-service:
  build:
    context: ./tenant-service
    dockerfile: Dockerfile
  container_name: whatsapp-tenant-service
  ports:
    - "3007:3007"
  environment:
    PORT: 3007
    REDIS_URL: redis://redis:6379
    DB_HOST: postgres
    DB_PORT: 5432
    DB_NAME: whatsapp_genesys
    DB_USER: postgres
    DB_PASSWORD: ${DB_PASSWORD}
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  restart: unless-stopped
```

### 2. Database Migration

Run the migration to add tenant support:

```sql
-- Add tenant tables
CREATE TABLE tenants (
  tenant_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE,
  status VARCHAR(20) DEFAULT 'active',
  plan VARCHAR(50) DEFAULT 'standard',
  rate_limit INTEGER DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

CREATE TABLE tenant_credentials (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(50) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  credential_type VARCHAR(50) NOT NULL,
  credentials JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tenant_api_keys (
  api_key VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(50) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add tenant_id to existing tables
ALTER TABLE conversation_mappings ADD COLUMN tenant_id VARCHAR(50);
ALTER TABLE message_tracking ADD COLUMN tenant_id VARCHAR(50);

CREATE INDEX idx_conv_tenant ON conversation_mappings(tenant_id, wa_id);
CREATE INDEX idx_msg_tenant ON message_tracking(tenant_id, created_at);
```

### 3. Create Shared Middleware Directory

```bash
mkdir -p shared/middleware
# Copy tenant-resolver.js to this directory
```

### 4. Update All Services

Replace the single-tenant services with the multi-tenant versions provided:
- `state-manager/server.js` - Updated with tenant filtering
- `auth-service/server.js` - Updated with tenant-specific credentials
- Add tenant middleware to all other services

## Usage Guide

### Onboard a New Tenant

```bash
# Create tenant
curl -X POST http://localhost:3007/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "acme-corp",
    "name": "Acme Corporation",
    "subdomain": "acme",
    "plan": "enterprise"
  }'

# Response includes API key:
{
  "tenant": {
    "tenant_id": "acme-corp",
    "name": "Acme Corporation",
    "subdomain": "acme",
    "status": "active",
    "plan": "enterprise"
  },
  "apiKey": "sk_a1b2c3d4e5f6...",
  "message": "Tenant created successfully"
}
```

### Store Tenant Credentials

```bash
# Store Meta WhatsApp credentials
curl -X POST http://localhost:3007/tenants/acme-corp/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "type": "meta",
    "credentials": {
      "appSecret": "your_meta_app_secret",
      "verifyToken": "your_verify_token",
      "accessToken": "your_meta_access_token",
      "phoneNumberId": "123456789"
    }
  }'

# Store Genesys credentials
curl -X POST http://localhost:3007/tenants/acme-corp/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "type": "genesys",
    "credentials": {
      "clientId": "genesys_client_id",
      "clientSecret": "genesys_client_secret",
      "region": "mypurecloud.com"
    }
  }'
```

### Make Tenant-Aware API Calls

There are **3 ways** to identify the tenant in requests:

#### Option 1: API Key (Recommended)
```bash
curl http://localhost:3000/state/stats \
  -H "X-API-Key: sk_a1b2c3d4e5f6..."
```

#### Option 2: Subdomain
```bash
curl http://acme.yourdomain.com/state/stats
```

#### Option 3: JWT Token
```bash
curl http://localhost:3000/state/stats \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
# JWT must contain "tenant_id" claim
```

### Tenant-Specific Statistics

```bash
# Get tenant stats (automatically filtered)
curl http://localhost:3000/state/stats \
  -H "X-API-Key: sk_tenant_api_key"

# Response:
{
  "tenantId": "acme-corp",
  "totalMappings": 1234,
  "totalMessages": 5678,
  "activeConversations": 89,
  "todayMessages": 123
}
```

### List Tenant Conversations

```bash
curl http://localhost:3000/state/conversations?limit=10 \
  -H "X-API-Key: sk_tenant_api_key"
```

## Tenant Isolation Verification

### Test Data Isolation

```bash
# Create mapping for Tenant A
curl -X POST http://localhost:3000/state/mapping \
  -H "X-API-Key: sk_tenant_a_key" \
  -H "Content-Type: application/json" \
  -d '{
    "waId": "1234567890",
    "contactName": "John Doe"
  }'

# Try to access with Tenant B key (should fail)
curl http://localhost:3000/state/mapping/1234567890 \
  -H "X-API-Key: sk_tenant_b_key"

# Response: 404 Mapping not found (correct - data isolated)
```

## Architecture Changes Summary

### Before (Single-Tenant)
```
User Request → API Gateway → Service → Database
                                         ↓
                              ALL tenant data mixed
```

### After (Multi-Tenant)
```
User Request with API Key
    ↓
API Gateway + Tenant Resolver
    ↓ (adds X-Tenant-ID header)
Service with Tenant Filter
    ↓
Database Query: WHERE tenant_id = 'acme-corp'
    ↓
Only tenant's data returned
```

## Migration from Single to Multi-Tenant

If you have existing single-tenant deployments:

1. **Assign tenant_id to existing data**:
```sql
-- Assign all existing data to default tenant
UPDATE conversation_mappings SET tenant_id = 'default';
UPDATE message_tracking SET tenant_id = 'default';
```

2. **Create default tenant**:
```bash
curl -X POST http://localhost:3007/tenants \
  -d '{"tenantId":"default","name":"Default Tenant"}'
```

3. **Migrate credentials** to tenant service

4. **Generate API keys** for existing users

## Pricing Tiers Example

You can implement usage-based billing:

```javascript
// Example: Check tenant plan limits
const planLimits = {
  'starter': { messages: 1000, agents: 5 },
  'professional': { messages: 10000, agents: 25 },
  'enterprise': { messages: -1, agents: -1 } // unlimited
};

// In rate limiter middleware
if (req.tenant.plan === 'starter' && monthlyUsage > 1000) {
  return res.status(429).json({ error: 'Monthly limit exceeded' });
}
```

## Security Best Practices

1. **API Key Storage**: Store hashed in database
2. **Credential Encryption**: Encrypt tenant credentials (use AWS KMS, HashiCorp Vault)
3. **Audit Logging**: Log all tenant actions
4. **Rate Limiting**: Enforce per-tenant limits
5. **Query Validation**: Always validate tenant_id in WHERE clauses

## Monitoring Multi-Tenant System

```bash
# Get all tenant stats (admin endpoint)
curl http://localhost:3007/tenants

# Monitor specific tenant
curl http://localhost:3007/tenants/acme-corp

# Check tenant health
curl http://localhost:3000/state/stats \
  -H "X-API-Key: sk_tenant_key"
```

## Common Issues & Solutions

### Issue: "Tenant not found"
**Solution**: Check if tenant exists and is active
```bash
curl http://localhost:3007/tenants/YOUR_TENANT_ID
```

### Issue: "Credentials not found"
**Solution**: Store tenant credentials
```bash
curl -X POST http://localhost:3007/tenants/YOUR_TENANT_ID/credentials \
  -d '{"type":"genesys","credentials":{...}}'
```

### Issue: Rate limit exceeded
**Solution**: Check tenant plan and upgrade if needed

## Conclusion

The architecture now **fully supports multi-tenancy** with:

✅ Complete data isolation by tenant_id  
✅ Tenant-specific credentials management  
✅ Per-tenant rate limiting and quotas  
✅ Tenant resolution via API key, subdomain, or JWT  
✅ Separate statistics and billing per tenant  
✅ Secure credential storage and caching  

This enables you to:
- **SaaS Deployment**: One instance serving multiple customers
- **White-Label**: Rebrand for different clients
- **Usage-Based Billing**: Track and charge per tenant
- **Scalable**: Add tenants without new infrastructure