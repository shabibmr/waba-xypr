# IMPORANT: Fix API Gateway Configuration Errors

**Target File:** `services/api-gateway/src/config/config.js`

## 1. Fix Tenant Service Port Mismatch
**Issue:** The tenant service runs on port `3007`, but the gateway configuration defaults to `3006`.
**Action:** Update the default URL to use port 3007.

```javascript
// Change this:
'tenant-service': process.env.TENANT_SERVICE_URL || 'http://tenant-service:3006',

// To this:
'tenant-service': process.env.TENANT_SERVICE_URL || SHARED_SERVICES.TENANT_SERVICE.url,
```

## 2. Fix Hardcoded Service URLs
**Issue:** `genesys-api-service` is using a hardcoded string instead of the shared constant.
**Action:** Update to use `SHARED_SERVICES`.

```javascript
// Change this:
'genesys-api-service': process.env.GENESYS_API_URL || 'http://genesys-api:3010'

// To this:
'genesys-api-service': process.env.GENESYS_API_URL || SHARED_SERVICES.GENESYS_API.url
```

## 3. Update Allowed Origins (CORS)
**Issue:** The default `allowedOrigins` does not include the standard local development ports for the frontend applications (`3012`, `3014`).
**Action:** Add these ports to the default array.

```javascript
// Change this:
allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],

// To this:
allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3001', 
    'http://localhost:3012', 
    'http://localhost:3014'
],
```
