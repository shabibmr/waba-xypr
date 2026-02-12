# Shared Libraries Documentation

Centralized constants, middleware, and utilities used across all microservices in the WhatsApp-Genesys integration platform.

## Overview

The `shared/` directory contains reusable code that ensures consistency across all services. This includes:
- **Constants**: Queue names, Redis keys, service URLs
- **Middleware**: Authentication and tenant resolution
- **Types**: Shared TypeScript definitions (if applicable)
- **Utils**: Common utility functions

## Installation

Shared libraries are referenced directly from the monorepo:

```javascript
const { QUEUES, SERVICES, KEYS } = require('../../shared/constants');
const { tenantResolver } = require('../../shared/middleware/tenantResolver');
```

## Constants

### Queue Names (`constants/queues.js`)

Centralized RabbitMQ queue names to ensure consistency across producers and consumers.

```javascript
const { QUEUES } = require('../../shared/constants');

// Usage in services
await channel.assertQueue(QUEUES.INBOUND_WHATSAPP_MESSAGES);
await channel.sendToQueue(QUEUES.OUTBOUND_GENESYS_MESSAGES, message);
```

**Available Queues**:

| Queue Name | Purpose | Producer | Consumer |
|------------|---------|----------|----------|
| `INBOUND_WHATSAPP_MESSAGES` | WhatsApp → Genesys messages | WhatsApp Webhook | Inbound Transformer |
| `OUTBOUND_GENESYS_MESSAGES` | Genesys → WhatsApp messages | Genesys Webhook | Outbound Transformer |
| `WHATSAPP_STATUS_UPDATES` | WhatsApp delivery receipts | WhatsApp Webhook | State Manager |
| `GENESYS_STATUS_UPDATES` | Genesys status updates | Genesys API | State Manager |
| `TENANT_EVENTS` | Tenant configuration changes | Tenant Service | All Services |
| `ERROR_EVENTS` | System error notifications | All Services | Monitoring |

### Redis Keys (`constants/keys.js`)

Helper functions to generate consistent Redis keys with proper namespacing.

```javascript
const { KEYS } = require('../../shared/constants');

// Tenant keys
const tenantKey = KEYS.tenant('tenant-001');
// → 'tenant:tenant-001'

const mappingKey = KEYS.tenantMappingWa('tenant-001', '+919876543210');
// → 'tenant:tenant-001:mapping:wa:+919876543210'

// Auth keys
const tokenKey = KEYS.genesysToken('mypurecloud.com');
// → 'genesys:oauth:token:mypurecloud.com'

// Rate limiting
const rateLimitKey = KEYS.rateLimit('tenant-001', '202601141030');
// → 'ratelimit:tenant-001:202601141030'
```

**TTL Constants**:
```javascript
KEYS.TTL.MAPPING        // 3600 seconds (1 hour)
KEYS.TTL.TOKEN_BUFFER   // 300 seconds (5 minutes)
KEYS.TTL.RATE_LIMIT     // 60 seconds (1 minute)
```

### Service URLs (`constants/services.js`)

Default ports and URLs for all microservices.

```javascript
const { SERVICES } = require('../../shared/constants');

// Usage
const authServiceUrl = process.env.AUTH_SERVICE_URL || SERVICES.AUTH_SERVICE.url;
const response = await axios.get(`${authServiceUrl}/auth/token`);
```

**Service Configuration**:

| Service | Port | Default URL |
|---------|------|-------------|
| API_GATEWAY | 3000 | `http://api-gateway:3000` |
| INBOUND_TRANSFORMER | 3002 | `http://inbound-transformer:3002` |
| OUTBOUND_TRANSFORMER | 3003 | `http://outbound-transformer:3003` |
| AUTH_SERVICE | 3004 | `http://auth-service:3004` |
| STATE_MANAGER | 3005 | `http://state-manager:3005` |
| ADMIN_DASHBOARD | 3006 | `http://admin-dashboard:80` |
| TENANT_SERVICE | 3007 | `http://tenant-service:3007` |
| WHATSAPP_API | 3008 | `http://whatsapp-api-service:3008` |
| WHATSAPP_WEBHOOK | 3009 | `http://whatsapp-webhook-service:3009` |
| GENESYS_API | 3010 | `http://genesys-api-service:3010` |
| GENESYS_WEBHOOK | 3011 | `http://genesys-webhook-service:3011` |
| AGENT_WIDGET | 3012 | `http://agent-widget:3012` |

## Middleware

### Tenant Resolver (`middleware/tenantResolver.js`)

Multi-tenant middleware that identifies and validates tenants from incoming requests.

**Resolution Strategies** (in order):
1. **API Key**: `X-API-Key` header
2. **JWT Token**: `Authorization: Bearer <token>` with `tenant_id` claim
3. **Subdomain**: `acme.yourdomain.com` → tenant ID `acme`

**Usage**:

```javascript
const { tenantResolver, tenantRateLimiter } = require('../../shared/middleware/tenantResolver');

// Apply to all routes
app.use(tenantResolver);

// Optional: Add rate limiting per tenant
app.use(tenantRateLimiter);

// Access tenant in route handlers
app.get('/api/data', (req, res) => {
  const tenantId = req.tenant.id;
  const tenantName = req.tenant.name;
  const tenantStatus = req.tenant.status;
  
  // Tenant ID is also added to headers for downstream services
  // req.headers['x-tenant-id'] === tenantId
});
```

**Tenant Object Structure**:
```javascript
req.tenant = {
  id: 'tenant-001',
  name: 'Acme Corp',
  status: 'active',
  rateLimit: 100,  // requests per minute
  // ... other tenant properties
}
```

**Error Responses**:

| Status | Error | Reason |
|--------|-------|--------|
| 401 | Tenant identification required | No tenant identifier provided |
| 403 | Tenant not found | Invalid tenant ID |
| 403 | Tenant inactive | Tenant status is not 'active' |
| 429 | Rate limit exceeded | Tenant exceeded rate limit |
| 500 | Tenant resolution failed | Internal error |

### Rate Limiting

The `tenantRateLimiter` middleware enforces per-tenant rate limits:

```javascript
app.use(tenantRateLimiter);
```

**Response Headers**:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
```

**Rate Limit Exceeded Response**:
```json
{
  "error": "Rate limit exceeded",
  "limit": 100,
  "retryAfter": 60
}
```

## Best Practices

### Using Shared Constants

✅ **DO**: Use shared constants for all queue names and Redis keys
```javascript
const { QUEUES } = require('../../shared/constants');
await channel.assertQueue(QUEUES.INBOUND_WHATSAPP_MESSAGES);
```

❌ **DON'T**: Hardcode queue names
```javascript
await channel.assertQueue('inbound-whatsapp-messages'); // Typo-prone
```

### Service URLs

✅ **DO**: Use environment variables with shared constants as fallback
```javascript
const authUrl = process.env.AUTH_SERVICE_URL || SERVICES.AUTH_SERVICE.url;
```

❌ **DON'T**: Hardcode URLs
```javascript
const authUrl = 'http://localhost:3004'; // Breaks in production
```

### Tenant Context

✅ **DO**: Always use `req.tenant` after tenant resolver
```javascript
app.use(tenantResolver);
app.get('/api/data', (req, res) => {
  const tenantId = req.tenant.id; // Validated and guaranteed
});
```

❌ **DON'T**: Parse tenant from headers manually
```javascript
const tenantId = req.headers['x-tenant-id']; // May not be validated
```

## Adding New Shared Code

### Adding a New Constant

1. Add to appropriate file in `shared/constants/`
2. Export from `shared/constants/index.js`
3. Update this documentation
4. Notify all service teams

### Adding New Middleware

1. Create file in `shared/middleware/`
2. Export from middleware directory
3. Document usage and examples
4. Add tests in `tests/shared/`

## Testing

Shared libraries should be tested independently:

```bash
cd tests
npm test -- --testPathPattern=shared
```

## Dependencies

The shared library has minimal dependencies:
- `redis`: For tenant resolution and caching
- No other external dependencies to keep it lightweight

## Migration Guide

If you're updating services to use shared constants:

1. **Replace hardcoded queue names**:
   ```javascript
   // Before
   await channel.assertQueue('inbound-messages');
   
   // After
   const { QUEUES } = require('../../shared/constants');
   await channel.assertQueue(QUEUES.INBOUND_WHATSAPP_MESSAGES);
   ```

2. **Replace hardcoded service URLs**:
   ```javascript
   // Before
   const url = 'http://tenant-service:3007';
   
   // After
   const { SERVICES } = require('../../shared/constants');
   const url = process.env.TENANT_SERVICE_URL || SERVICES.TENANT_SERVICE.url;
   ```

3. **Add tenant resolution**:
   ```javascript
   // Before
   app.get('/api/data', (req, res) => {
     const tenantId = req.headers['x-tenant-id'];
     // Manual validation...
   });
   
   // After
   const { tenantResolver } = require('../../shared/middleware/tenantResolver');
   app.use(tenantResolver);
   app.get('/api/data', (req, res) => {
     const tenantId = req.tenant.id; // Already validated
   });
   ```

## Support

For issues with shared libraries:
- Check service-specific READMEs for usage examples
- See [DEVELOPMENT.md](../docs/DEVELOPMENT.md) for development guidelines
- Open an issue if you find bugs or need new shared utilities
