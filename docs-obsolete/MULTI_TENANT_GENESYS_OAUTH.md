# Multi-Tenant Genesys OAuth Implementation

## Overview

Successfully implemented multi-tenant Genesys OAuth support, allowing each tenant to use their own Genesys Cloud credentials instead of sharing a single set of credentials.

## Changes Made

### 1. Tenant Service Updates

**Added Methods** (`src/services/tenantService.js`):
- `setGenesysCredentials(tenantId, credentials)` - Store/update Genesys OAuth credentials
- `getGenesysCredentials(tenantId)` - Retrieve Genesys credentials with caching

**Added Controller Methods** (`src/controllers/tenantController.js`):
- `setGenesysCredentials` - PUT endpoint to store credentials
- `getGenesysCredentials` - GET endpoint with masked secret for security

**Added Routes** (`src/routes/tenantRoutes.js`):
- `PUT /api/tenants/:tenantId/genesys/credentials`
- `GET /api/tenants/:tenantId/genesys/credentials`

**Database Schema**: Already configured in `docker/postgres/init.sql`:
- `genesys_client_id` VARCHAR(255)
- `genesys_client_secret` TEXT
- `genesys_region` VARCHAR(100)

### 2. Auth Service Updates

**Updated** (`src/index.js`):
- Modified `getValidToken()` to accept `tenantId` parameter
- Added `getTenantGenesysCredentials(tenantId)` to fetch credentials from tenant-service
- Updated token caching to be tenant-specific: `genesys:oauth:token:{tenantId}`
- Modified `/auth/token` endpoint to require `X-Tenant-ID` header

### 3. Genesys API Service Updates

**Updated** (`src/services/tenant.service.js`):
- Updated endpoint URL to `/tenants/{tenantId}/genesys/credentials`
- Improved error handling for missing credentials

### 4. Setup Script

**Created** (`scripts/setup-genesys-creds.js`):
- Utility script to configure Genesys credentials for a tenant
- Pre-populated with your Genesys OAuth credentials
- Usage: `node scripts/setup-genesys-creds.js <tenant-id>`

## Configuration

### Your Genesys Credentials
```javascript
{
  clientId: '7c513299-40e9-4c51-a34f-935bd56cfb56',
  clientSecret: '-Yn-vPj1HCDq8HvYeadbLVBAx0I5wVkvcVKdS1MqRXo',
  region: 'aps1.mypurecloud.com'
}
```

### Setting Up a Tenant

**Option 1: Use the setup script**
```bash
cd scripts
node setup-genesys-creds.js your-tenant-id
```

**Option 2: Use curl**
```bash
curl -X PUT \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "7c513299-40e9-4c51-a34f-935bd56cfb56",
    "clientSecret": "-Yn-vPj1HCDq8HvYeadbLVBAx0I5wVkvcVKdS1MqRXo",
    "region": "aps1.mypurecloud.com"
  }' \
  http://localhost:3007/api/tenants/your-tenant-id/genesys/credentials
```

## How It Works

### Token Request Flow

1. **Service needs Genesys token** → Calls Auth Service with `X-Tenant-ID` header
2. **Auth Service checks cache** → `genesys:oauth:token:{tenantId}`
3. **If expired or missing** → Fetches tenant's Genesys credentials from Tenant Service
4. **Requests new token** → Uses tenant-specific credentials with Genesys Cloud
5. **Caches token** → Stores with tenant-specific key
6. **Returns token** → Service uses it for Genesys API calls

### Security Features

- **Credentials are encrypted** at rest in PostgreSQL
- **Secrets are masked** when retrieved via GET endpoint (shows only last 4 characters)
- **Redis caching** reduces database queries and improves performance
- **Per-tenant token isolation** ensures tokens don't leak across tenants

## Testing

### 1. Set Credentials for a Tenant
```bash
curl -X PUT \
  -H "Content-Type: application/json" \
  -d '{...}' \
  http://localhost:3007/api/tenants/test-tenant/genesys/credentials
```

### 2. Request a Token
```bash
curl -H "X-Tenant-ID: test-tenant" \
  http://localhost:3004/auth/token
```

### 3. Use Token with Genesys API Service
```bash
curl -H "X-Tenant-ID: test-tenant" \
  http://localhost:3010/genesys/organization/users
```

## Migration Notes

**For Existing Deployments:**
1. Update all services (tenant-service, auth-service, genesys-api-service)
2. Run setup script for each existing tenant
3. Verify token requests include `X-Tenant-ID` header
4. Remove global GENESYS_CLIENT_ID and GENESYS_CLIENT_SECRET from env files (no longer needed)

## Benefits

✅ **True Multi-Tenancy** - Each organization uses their own Genesys account  
✅ **Scalability** - Support unlimited tenants with different Genesys instances  
✅ **Isolation** - Complete separation of credentials and tokens  
✅ **Flexibility** - Each tenant can have different Genesys regions  
✅ **Security** - Credentials stored securely with proper access control  

## Next Steps

- ✅ Tenant Service: Genesys credentials storage
- ✅ Auth Service: Multi-tenant OAuth support
- ⏳ Outbound Transformer: Remove hardcoded WhatsApp token
- ⏳ Inbound Transformer: Verify tenant resolution
- ⏳ Webhook Services: Verify tenant resolution
