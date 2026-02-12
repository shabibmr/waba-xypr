# 04 - WhatsApp Webhook Service Enhancements

**Priority:** MEDIUM  
**Estimated Time:** 2-3 hours  
**Dependencies:** 00 (Infrastructure), 02 (Tenant Service)  
**Can Run in Parallel:** Yes (with 01, 03)

---

## 🎯 Objective
Verify and enhance WhatsApp Webhook Service with webhook payload storage to MinIO and ensure media handling is complete for MVP.

---

## 🛡️ Guard Rails (Check Before Starting)

- [x] Infrastructure setup complete (Task 00)
- [x] MinIO buckets created (`webhooks-inbound`, `media-inbound`)
- [x] Tenant Service running with phone_number_id resolution (Task 02)
- [x] RabbitMQ queue `INBOUND_WHATSAPP_MESSAGES` exists
- [x] WhatsApp Webhook Service exists at `/services/whatsapp-webhook-service`

---

## 📍 Anchors (Where to Make Changes)

**Existing Files (Already Implemented):**
- ✅ `src/services/media.service.js` - Media download from Meta
- ✅ `src/services/webhook-processor.service.js` - Message processing
- ✅ `src/utils/message-extractor.js` - Extract media IDs

**Files to Add/Modify:**
- 🔧 `src/services/webhook-storage.service.js` - NEW: Store raw webhooks to MinIO
- 🔧 `src/services/webhook-processor.service.js` - UPDATE: Add webhook storage
- 🔧 `src/services/tenant-resolver.service.js` - NEW: Tenant resolution client

---

## 📝 Step-by-Step Implementation

### Step 1: Create Webhook Storage Service

**File:** `src/services/webhook-storage.service.js` (NEW)

```javascript
const { Client } = require('minio');
const { v4: uuidv4 } = require('uuid');

class WebhookStorageService {
    constructor() {
        this.minioClient = new Client({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT || '9000'),
            useSSL: process.env.MINIO_USE_SSL === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
            secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
        });

        this.bucketName = 'webhooks-inbound';
        this.ensureBucket();
    }

    async ensureBucket() {
        try {
            const exists = await this.minioClient.bucketExists(this.bucketName);
            if (!exists) {
                await this.minioClient.makeBucket(this.bucketName);
                console.log(`Created MinIO bucket: ${this.bucketName}`);
            }
        } catch (error) {
            console.error('Error ensuring MinIO bucket exists:', error);
        }
    }

    /**
     * Store raw webhook payload to MinIO
     * @param {Object} payload - Raw webhook payload from Meta
     * @param {string} tenantId - Tenant ID
     * @returns {Promise<string>} Storage path
     */
    async storeWebhookPayload(payload, tenantId) {
        try {
            const timestamp = new Date();
            const date = timestamp.toISOString().split('T')[0];
            const webhookId = uuidv4();
            
            // Object path: tenantId/YYYY-MM-DD/webhookId.json
            const objectPath = `${tenantId}/${date}/${webhookId}.json`;

            // Add metadata
            const enrichedPayload = {
                webhookId,
                receivedAt: timestamp.toISOString(),
                tenantId,
                payload
            };

            const payloadBuffer = Buffer.from(JSON.stringify(enrichedPayload, null, 2));

            await this.minioClient.putObject(
                this.bucketName,
                objectPath,
                payloadBuffer,
                {
                    'Content-Type': 'application/json',
                    'x-webhook-id': webhookId,
                    'x-tenant-id': tenantId
                }
            );

            console.log(`Webhook payload stored: ${objectPath}`);
            return objectPath;

        } catch (error) {
            console.error('Error storing webhook payload:', error);
            throw error;
        }
    }
}

module.exports = new WebhookStorageService();
```

### Step 2: Create Tenant Resolver Service

**File:** `src/services/tenant-resolver.service.js` (NEW)

```javascript
const axios = require('axios');

const TENANT_SERVICE_URL = process.env.TENANT_SERVICE_URL || 'http://localhost:3007';

class TenantResolverService {
    /**
     * Resolve tenant by phone_number_id
     * @param {string} phoneNumberId - WhatsApp phone number ID
     * @returns {Promise<Object>} Tenant object
     */
    async resolveTenantByPhoneId(phoneNumberId) {
        try {
            const response = await axios.get(
                `${TENANT_SERVICE_URL}/api/tenants/by-phone/${phoneNumberId}`
            );
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                console.error(`No tenant found for phone_number_id: ${phoneNumberId}`);
                return null;
            }
            console.error('Error resolving tenant:', error.message);
            throw error;
        }
    }
}

module.exports = new TenantResolverService();
```

### Step 3: Update Webhook Processor

**File:** `src/services/webhook-processor.service.js` (MODIFY)

Add these imports at the top:

```javascript
const webhookStorage = require('./webhook-storage.service');
const tenantResolver = require('./tenant-resolver.service');
```

Find the `processWebhook` method and add webhook storage at the beginning:

```javascript
async processWebhook(webhookData) {
    try {
        const entries = webhookData.entry || [];
        
        for (const entry of entries) {
            const changes = entry.changes || [];
            
            for (const change of changes) {
                if (change.field !== 'messages') continue;
                
                const value = change.value;
                const phoneNumberId = value.metadata.phone_number_id;
                
                // 1. Resolve tenant by phone_number_id
                const tenant = await tenantResolver.resolveTenantByPhoneId(phoneNumberId);
                
                if (!tenant) {
                    console.error(`Skipping webhook: No tenant for phone ${phoneNumberId}`);
                    continue;
                }
                
                const tenantId = tenant.id;
                const tenantLogger = Logger.forTenant(tenantId);
                
                // 2. Store raw webhook payload to MinIO
                try {
                    await webhookStorage.storeWebhookPayload(webhookData, tenantId);
                    tenantLogger.info('Webhook payload stored to MinIO');
                } catch (storageError) {
                    tenantLogger.error('Failed to store webhook payload', storageError);
                    // Continue processing even if storage fails
                }
                
                // 3. Process messages (existing code continues...)
                const messages = value.messages || [];
                
                for (const message of messages) {
                    await this.processMessage(message, value, tenantId);
                }
            }
        }
    } catch (error) {
        console.error('Error processing webhook:', error);
        throw error;
    }
}
```

### Step 4: Verify Media Service Implementation

**File:** `src/services/media.service.js` (VERIFY - Should already exist)

Check that it has these key methods:

```javascript
class MediaService {
    constructor() {
        this.minioClient = new Client({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT || '9000'),
            useSSL: false,
            accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
            secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
        });

        this.bucketName = 'media-inbound'; // Changed from 'whatsapp-media'
    }

    async saveMedia(mediaId, accessToken, tenantId, mimeType) {
        // 1. Get media URL from Meta
        // 2. Download media file
        // 3. Store to MinIO
        // 4. Return publicUrl and metadata
    }
}
```

**If bucket name is still `whatsapp-media`, update it to `media-inbound`:**

```javascript
this.bucketName = process.env.MINIO_MEDIA_BUCKET || 'media-inbound';
```

### Step 5: Update Environment Variables

**File:** `.env.example`

```env
PORT=3009
NODE_ENV=development

# Tenant Service
TENANT_SERVICE_URL=http://localhost:3007

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_QUEUE=INBOUND_WHATSAPP_MESSAGES

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_MEDIA_BUCKET=media-inbound
MINIO_WEBHOOK_BUCKET=webhooks-inbound

# WhatsApp (for verification endpoint)
WHATSAPP_VERIFY_TOKEN=your_verify_token_here
```

### Step 6: Update Dependencies

**File:** `package.json`

Ensure these dependencies exist:

```bash
npm install minio uuid axios amqplib
```

---

## ✅ Verification Steps

### 1. Start the Service

```bash
cd services/whatsapp-webhook-service
npm install
npm run dev
```

### 2. Test Webhook Verification (GET)

```bash
curl "http://localhost:3009/webhook/meta?hub.mode=subscribe&hub.verify_token=your_verify_token_here&hub.challenge=test_challenge"
```

Expected: `test_challenge`

### 3. Test Webhook Processing (POST) - Text Message

```bash
curl -X POST http://localhost:3009/webhook/meta \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "field": "messages",
        "value": {
          "metadata": {
            "phone_number_id": "123456789"
          },
          "messages": [{
            "id": "wamid.test123",
            "from": "+919876543210",
            "timestamp": "1234567890",
            "type": "text",
            "text": {
              "body": "Hello from WhatsApp"
            }
          }]
        }
      }]
    }]
  }'
```

**Expected Results:**
- ✅ Response: 200 OK
- ✅ Webhook payload stored in MinIO (`webhooks-inbound` bucket)
- ✅ Message published to RabbitMQ
- ✅ Logs show tenant resolution successful

### 4. Test Media Message (Image)

```bash
curl -X POST http://localhost:3009/webhook/meta \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "field": "messages",
        "value": {
          "metadata": {
            "phone_number_id": "123456789"
          },
          "messages": [{
            "id": "wamid.media123",
            "from": "+919876543210",
            "timestamp": "1234567890",
            "type": "image",
            "image": {
              "id": "test-media-id-123",
              "mime_type": "image/jpeg"
            }
          }]
        }
      }]
    }]
  }'
```

**Expected Results:**
- ✅ Webhook stored to MinIO
- ✅ Media downloaded from Meta (requires valid media ID)
- ✅ Media stored to `media-inbound` bucket
- ✅ Message with `mediaUrl` published to RabbitMQ

### 5. Verify MinIO Storage

```bash
# Check webhook storage
docker run --rm --network host minio/mc ls local/webhooks-inbound/demo-tenant-001/

# Check media storage
docker run --rm --network host minio/mc ls local/media-inbound/demo-tenant-001/
```

### 6. Verify RabbitMQ Message

```bash
# Check queue has messages
curl -u guest:guest http://localhost:15672/api/queues/%2F/INBOUND_WHATSAPP_MESSAGES

# Or check in RabbitMQ UI
open http://localhost:15672
```

### 7. Check Logs for Complete Flow

Expected log sequence:
```
Resolving tenant by phone_number_id: 123456789
Tenant resolved: demo-tenant-001
Webhook payload stored to MinIO
Processing message: wamid.test123
Downloading media from WhatsApp...
Media uploaded to MinIO
Queued inbound message (hasMedia: true)
```

---

## 🚨 Common Issues

### Issue 1: Tenant Not Found
**Solution:**
```bash
# Check tenant exists in database
psql -d waba_mvp -c "SELECT * FROM tenants WHERE phone_number_id = '123456789';"

# If missing, add demo tenant
psql -d waba_mvp -f database/seeds/001_demo_tenant.sql
```

### Issue 2: MinIO Connection Failed
**Solution:**
```bash
# Check MinIO is running
docker ps | grep minio

# Test connection
curl http://localhost:9000/minio/health/live
```

### Issue 3: Media Download Fails (401)
**Solution:**
- Media download requires valid WhatsApp access token
- For testing, the service will log error but continue processing
- In production, ensure tenant has valid WhatsApp credentials

### Issue 4: RabbitMQ Not Receiving Messages
**Solution:**
```bash
# Check RabbitMQ is running
docker ps | grep rabbitmq

# Verify queue exists
curl -u guest:guest http://localhost:15672/api/queues/%2F/INBOUND_WHATSAPP_MESSAGES

# Check service logs for publish errors
```

---

## 📤 Deliverables

- [x] Raw webhook payloads stored to MinIO `webhooks-inbound`
- [x] Media files stored to MinIO `media-inbound` (already implemented)
- [x] Tenant resolution by `phone_number_id`
- [x] Text message processing complete
- [x] Media message processing complete (image/document/video)
- [x] RabbitMQ publishing with `mediaUrl` for media messages
- [x] Proper error handling for missing tenant
- [x] All verification tests passing

---

## 🔗 Next Dependencies

Services that depend on WhatsApp Webhook Service:
- ✅ Task 05 - Inbound Transformer (consumes RabbitMQ messages)

---

## 📊 Data Flow Summary

```
WhatsApp Cloud
    ↓ (POST webhook)
WhatsApp Webhook Service
    ├─→ Store raw payload to MinIO (webhooks-inbound)
    ├─→ Resolve tenant by phone_number_id (Redis cache)
    ├─→ Download media from Meta (if media message)
    ├─→ Store media to MinIO (media-inbound)
    └─→ Publish to RabbitMQ (INBOUND_WHATSAPP_MESSAGES)
         ↓
    Inbound Transformer (Task 05)
```

---

## 🎯 Testing Checklist

Before marking complete:
- [ ] Service starts without errors
- [ ] Tenant resolution works (with caching)
- [ ] Webhook payloads stored to MinIO
- [ ] Text messages published to RabbitMQ
- [ ] Image messages: media downloaded & stored
- [ ] Document messages: media handled correctly
- [ ] Video messages: media handled correctly
- [ ] Error handling: unknown tenant logged, not crashed
- [ ] Error handling: media download failure logged, continues processing
- [ ] RabbitMQ messages include all required fields (tenantId, waId, type, content)
