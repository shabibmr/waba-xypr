# 10 - API Gateway Configuration

**Priority:** MEDIUM  
**Estimated Time:** 2-3 hours  
**Dependencies:** None (can run anytime)  
**Can Run in Parallel:** Yes (with any other task)

---

## 🎯 Objective
Configure API Gateway to route requests to backend services with proper CORS, logging, and error handling for MVP demo.

---

## 🛡️ Guard Rails (Check Before Starting)

- [x] All backend services are running (or at least know their ports)
- [x] API Gateway exists at `/services/api-gateway`
- [x] Express server is set up

---

## 📍 Anchors (Where to Make Changes)

**Existing Files:**
- `/services/api-gateway/src/index.js` - Main entry point
- `/services/api-gateway/src/middleware/` - Middleware directory
- `/services/api-gateway/src/routes/` - Route definitions

**New Files to Create:**
- `/services/api-gateway/src/middleware/logger.js`
- `/services/api-gateway/src/middleware/error-handler.js`
- `/services/api-gateway/src/routes/proxy.routes.js`
- `/services/api-gateway/src/config/services.config.js`

---

## 📝 Step-by-Step Implementation

### Step 1: Install Dependencies

```bash
cd services/api-gateway
npm install http-proxy-middleware cors morgan
```

### Step 2: Create Services Configuration

**File:** `src/config/services.config.js`

```javascript
// Service registry with URLs
module.exports = {
    services: {
        tenant: {
            url: process.env.TENANT_SERVICE_URL || 'http://localhost:3007',
            path: '/api/tenants'
        },
        auth: {
            url: process.env.AUTH_SERVICE_URL || 'http://localhost:3004',
            path: '/auth'
        },
        state: {
            url: process.env.STATE_SERVICE_URL || 'http://localhost:3005',
            path: '/state'
        },
        whatsappWebhook: {
            url: process.env.WHATSAPP_WEBHOOK_URL || 'http://localhost:3009',
            path: '/webhook/meta'
        },
        genesysWebhook: {
            url: process.env.GENESYS_WEBHOOK_URL || 'http://localhost:3011',
            path: '/webhook/genesys'
        },
        whatsappApi: {
            url: process.env.WHATSAPP_API_URL || 'http://localhost:3008',
            path: '/whatsapp'
        },
        genesysApi: {
            url: process.env.GENESYS_API_URL || 'http://localhost:3010',
            path: '/genesys'
        },
        agentPortal: {
            url: process.env.AGENT_PORTAL_URL || 'http://localhost:3014',
            path: '/portal'
        }
    }
};
```

### Step 3: Create Logger Middleware

**File:** `src/middleware/logger.js`

```javascript
const morgan = require('morgan');

// Custom token for tenant ID
morgan.token('tenant-id', (req) => {
    return req.headers['x-tenant-id'] || 'none';
});

// Custom format
const format = ':method :url :status :response-time ms - tenant: :tenant-id';

// Create logger middleware
const logger = morgan(format, {
    skip: (req) => {
        // Skip health check logs
        return req.url === '/health';
    }
});

module.exports = logger;
```

### Step 4: Create Error Handler Middleware

**File:** `src/middleware/error-handler.js`

```javascript
// Global error handler
function errorHandler(err, req, res, next) {
    console.error('API Gateway Error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    });

    // Don't leak error details in production
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal server error'
        : err.message;

    res.status(err.status || 500).json({
        error: message,
        path: req.url,
        timestamp: new Date().toISOString()
    });
}

module.exports = errorHandler;
```

### Step 5: Create Proxy Routes

**File:** `src/routes/proxy.routes.js`

```javascript
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { services } = require('../config/services.config');

const router = express.Router();

// Helper to create proxy
function createProxy(target, pathRewrite = {}) {
    return createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite,
        onError: (err, req, res) => {
            console.error(`Proxy error for ${req.url}:`, err.message);
            res.status(502).json({
                error: 'Bad Gateway',
                message: 'Service unavailable',
                service: target
            });
        },
        onProxyReq: (proxyReq, req) => {
            // Forward original headers
            console.log(`Proxying: ${req.method} ${req.url} -> ${target}`);
        }
    });
}

// Tenant Service
router.use('/api/tenants', createProxy(services.tenant.url));

// Auth Service
router.use('/auth', createProxy(services.auth.url));

// State Manager
router.use('/state', createProxy(services.state.url));

// WhatsApp Webhook
router.use('/webhook/meta', createProxy(services.whatsappWebhook.url));

// Genesys Webhook
router.use('/webhook/genesys', createProxy(services.genesysWebhook.url));

// WhatsApp API (internal - not exposed externally in production)
router.use('/api/whatsapp', createProxy(services.whatsappApi.url, {
    '^/api/whatsapp': '/whatsapp'
}));

// Genesys API (internal - not exposed externally in production)
router.use('/api/genesys', createProxy(services.genesysApi.url, {
    '^/api/genesys': '/genesys'
}));

// Agent Portal (frontend)
router.use('/portal', createProxy(services.agentPortal.url));

module.exports = router;
```

### Step 6: Update Main Entry Point

**File:** `src/index.js` (replace existing)

```javascript
const express = require('express');
const cors = require('cors');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/error-handler');
const proxyRoutes = require('./routes/proxy.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Tenant-ID',
        'X-Credential-Type',
        'X-Integration-ID'
    ],
    credentials: true
};

// Apply middleware
app.use(cors(corsOptions));
app.use(logger);
app.use(express.json({ limit: '10mb' }));

// Health check (direct, not proxied)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'api-gateway',
        timestamp: new Date().toISOString()
    });
});

// API Routes (proxied)
app.use('/', proxyRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.url,
        message: 'The requested endpoint does not exist'
    });
});

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
    console.log('Service routes configured:');
    console.log('  POST   /webhook/meta          -> WhatsApp Webhook Service');
    console.log('  POST   /webhook/genesys       -> Genesys Webhook Service');
    console.log('  *      /api/tenants/*         -> Tenant Service');
    console.log('  *      /auth/*                -> Auth Service');
    console.log('  *      /state/*               -> State Manager');
    console.log('  *      /api/whatsapp/*        -> WhatsApp API Service');
    console.log('  *      /api/genesys/*         -> Genesys API Service');
    console.log('  *      /portal/*              -> Agent Portal');
});
```

### Step 7: Update Environment Variables

**File:** `.env.example`

```env
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=*

# Service URLs
TENANT_SERVICE_URL=http://localhost:3007
AUTH_SERVICE_URL=http://localhost:3004
STATE_SERVICE_URL=http://localhost:3005
WHATSAPP_WEBHOOK_URL=http://localhost:3009
GENESYS_WEBHOOK_URL=http://localhost:3011
WHATSAPP_API_URL=http://localhost:3008
GENESYS_API_URL=http://localhost:3010
AGENT_PORTAL_URL=http://localhost:3014
```

---

## ✅ Verification Steps

### 1. Start API Gateway

```bash
cd services/api-gateway
npm install
npm run dev
```

Expected output:
```
API Gateway running on port 3000
Service routes configured:
  POST   /webhook/meta          -> WhatsApp Webhook Service
  ...
```

### 2. Test Health Check

```bash
curl http://localhost:3000/health
```

Expected Response:
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "timestamp": "2026-02-09T11:00:00.000Z"
}
```

### 3. Test Tenant Service Routing

```bash
curl http://localhost:3000/api/tenants/demo-tenant-001
```

Should proxy to Tenant Service and return tenant data.

### 4. Test Auth Service Routing

```bash
curl http://localhost:3000/auth/token \
  -H "X-Tenant-ID: demo-tenant-001"
```

Should proxy to Auth Service.

### 5. Test WhatsApp Webhook Routing

```bash
curl "http://localhost:3000/webhook/meta?hub.mode=subscribe&hub.verify_token=test&hub.challenge=123"
```

Should proxy to WhatsApp Webhook Service.

### 6. Test CORS Headers

```bash
curl -X OPTIONS http://localhost:3000/api/tenants \
  -H "Origin: http://localhost:3014" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

Should see CORS headers in response:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
```

### 7. Test 404 Handler

```bash
curl http://localhost:3000/nonexistent
```

Expected Response:
```json
{
  "error": "Not Found",
  "path": "/nonexistent",
  "message": "The requested endpoint does not exist"
}
```

### 8. Test Request Logging

Send a request and check console:
```bash
curl http://localhost:3000/api/tenants
```

Console should show:
```
GET /api/tenants 200 45 ms - tenant: none
```

---

## 🚨 Common Issues

### Issue 1: Service Not Responding (502 Bad Gateway)
**Solution:**
```bash
# Check target service is running
curl http://localhost:3007/health  # Tenant Service
curl http://localhost:3004/health  # Auth Service

# Start missing service
cd services/<service-name>
npm run dev
```

### Issue 2: CORS Errors in Browser
**Solution:**
Check browser console for specific origin. Update `.env`:
```env
CORS_ORIGIN=http://localhost:3014,http://localhost:3000
```

Or allow all for development:
```env
CORS_ORIGIN=*
```

### Issue 3: Headers Not Forwarded
**Solution:**
The proxy automatically forwards most headers. For custom headers, ensure they're in `allowedHeaders` in CORS config.

### Issue 4: Request Body Lost
**Solution:**
Already handled by `express.json()` middleware. If still an issue, check:
```javascript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

---

## 📤 Deliverables

- [x] Centralized routing to all 10 services
- [x] CORS configuration for cross-origin requests
- [x] Request logging with tenant ID tracking
- [x] Error handling with proper status codes
- [x] Health check endpoint
- [x] 404 handler for undefined routes
- [x] Service URL configuration via environment
- [x] All verification tests passing

---

## 🔗 Integration Points

**External Traffic (Internet → Gateway):**
- WhatsApp webhooks → `/webhook/meta`
- Genesys webhooks → `/webhook/genesys`
- Agent Portal UI → `/portal`

**Internal Traffic (Gateway → Services):**
- Tenant management → `/api/tenants/*`
- Authentication → `/auth/*`
- State management → `/state/*`

---

## 📊 Request Flow

```
Client/Webhook
    ↓
API Gateway (port 3000)
    ├─ CORS middleware
    ├─ Logger middleware
    ├─ JSON parser
    ├─ Route matcher
    └─ Proxy middleware
        ↓
Backend Service
    ↓
Response
    ↓
API Gateway
    ├─ Error handler (if error)
    └─ CORS headers
        ↓
Client/Webhook
```

---

## 🎯 Testing Checklist

- [ ] Gateway starts without errors
- [ ] All service routes configured
- [ ] Health check responds
- [ ] Tenant service proxying works
- [ ] Auth service proxying works
- [ ] WhatsApp webhook proxying works
- [ ] Genesys webhook proxying works
- [ ] CORS headers present in responses
- [ ] Request logging works
- [ ] 404 handler catches unknown routes
- [ ] Error handler catches service errors
- [ ] Can handle 10MB request bodies

---

## 🚀 Optional Enhancements (Post-MVP)

For production, consider adding:

1. **Rate Limiting**
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

2. **Request Validation**
```javascript
const { body, validationResult } = require('express-validator');
```

3. **API Key Authentication** (for internal routes)
```javascript
const apiKeyAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey === process.env.INTERNAL_API_KEY) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};
```

4. **Circuit Breaker** (for failing services)
```javascript
const CircuitBreaker = require('opossum');
```

**For MVP: Skip these enhancements**
