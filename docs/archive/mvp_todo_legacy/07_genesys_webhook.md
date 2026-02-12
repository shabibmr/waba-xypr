# 07 - Genesys Webhook Service

**Priority:** HIGH  
**Estimated Time:** 3-4 hours  
**Dependencies:** 00 (Infrastructure), 02 (Tenant Service)  
**Can Run in Parallel:** Yes (with 06, 09)

---

## 🎯 Objective
Implement Genesys Webhook Service to receive messages from Genesys Cloud, store payloads to MinIO, detect media attachments, and publish to RabbitMQ for outbound processing.

---

## 🛡️ Guard Rails (Check Before Starting)

- [x] Infrastructure setup complete (Task 00)
- [x] MinIO buckets created (`webhooks-outbound`)
- [x] Tenant Service running with integration_id resolution (Task 02)
- [x] RabbitMQ queue `OUTBOUND_GENESYS_MESSAGES` exists
- [x] Genesys Webhook Service exists at `/services/genesys-webhook-service`

---

## 📍 Anchors (Where to Make Changes)

**Existing Files:**
- `/services/genesys-webhook-service/src/index.ts` - Entry point
- `/services/genesys-webhook-service/src/routes/` - Route definitions
- `/services/genesys-webhook-service/src/controllers/` - Controllers

**New Files to Create:**
- `/services/genesys-webhook-service/src/routes/webhook.routes.ts`
- `/services/genesys-webhook-service/src/controllers/webhook.controller.ts`
- `/services/genesys-webhook-service/src/services/webhook-storage.service.ts`
- `/services/genesys-webhook-service/src/services/tenant-resolver.service.ts`
- `/services/genesys-webhook-service/src/services/message-publisher.service.ts`
- `/services/genesys-webhook-service/src/utils/media-detector.ts`

---

## 📝 Step-by-Step Implementation

### Step 1: Install Dependencies

```bash
cd services/genesys-webhook-service
npm install minio uuid amqplib axios
npm install -D @types/uuid @types/amqplib
```

### Step 2: Create Webhook Storage Service

**File:** `src/services/webhook-storage.service.ts`

```typescript
import { Client } from 'minio';
import { v4 as uuidv4 } from 'uuid';

class WebhookStorageService {
    private minioClient: Client;
    private bucketName = 'webhooks-outbound';

    constructor() {
        this.minioClient = new Client({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT || '9000'),
            useSSL: process.env.MINIO_USE_SSL === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
            secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
        });

        this.ensureBucket();
    }

    private async ensureBucket() {
        try {
            const exists = await this.minioClient.bucketExists(this.bucketName);
            if (!exists) {
                await this.minioClient.makeBucket(this.bucketName);
                console.log(`Created MinIO bucket: ${this.bucketName}`);
            }
        } catch (error) {
            console.error('Error ensuring bucket exists:', error);
        }
    }

    async storeWebhookPayload(payload: any, tenantId: string): Promise<string> {
        try {
            const timestamp = new Date();
            const date = timestamp.toISOString().split('T')[0];
            const webhookId = uuidv4();
            
            // Object path: tenantId/YYYY-MM-DD/webhookId.json
            const objectPath = `${tenantId}/${date}/${webhookId}.json`;

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

            console.log(`Genesys webhook stored: ${objectPath}`);
            return objectPath;

        } catch (error) {
            console.error('Error storing webhook payload:', error);
            throw error;
        }
    }
}

export default new WebhookStorageService();
```

### Step 3: Create Tenant Resolver Service

**File:** `src/services/tenant-resolver.service.ts`

```typescript
import axios from 'axios';

const TENANT_SERVICE_URL = process.env.TENANT_SERVICE_URL || 'http://localhost:3007';

class TenantResolverService {
    async resolveTenantByIntegrationId(integrationId: string) {
        try {
            const response = await axios.get(
                `${TENANT_SERVICE_URL}/api/tenants/by-integration/${integrationId}`
            );
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 404) {
                console.error(`No tenant found for integration_id: ${integrationId}`);
                return null;
            }
            console.error('Error resolving tenant:', error.message);
            throw error;
        }
    }
}

export default new TenantResolverService();
```

### Step 4: Create Media Detector Utility

**File:** `src/utils/media-detector.ts`

```typescript
export interface MediaAttachment {
    url: string;
    mediaType: string;
    filename?: string;
}

export function detectMediaInMessage(message: any): MediaAttachment | null {
    // Check if message is Structured type with attachments
    if (message.type === 'Structured' && message.content && Array.isArray(message.content)) {
        for (const contentItem of message.content) {
            if (contentItem.contentType === 'Attachment' && contentItem.attachment) {
                return {
                    url: contentItem.attachment.url,
                    mediaType: contentItem.attachment.mediaType,
                    filename: contentItem.attachment.filename
                };
            }
        }
    }

    return null;
}

export function getMessageType(message: any): 'text' | 'media' {
    const hasMedia = detectMediaInMessage(message);
    return hasMedia ? 'media' : 'text';
}
```

### Step 5: Create Message Publisher Service

**File:** `src/services/message-publisher.service.ts`

```typescript
import amqp, { Channel, Connection } from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const QUEUE_NAME = 'OUTBOUND_GENESYS_MESSAGES';

class MessagePublisherService {
    private connection: Connection | null = null;
    private channel: Channel | null = null;

    async connect() {
        try {
            this.connection = await amqp.connect(RABBITMQ_URL);
            this.channel = await this.connection.createChannel();
            
            await this.channel.assertQueue(QUEUE_NAME, { durable: true });
            
            console.log(`Connected to RabbitMQ, queue: ${QUEUE_NAME}`);
        } catch (error) {
            console.error('Error connecting to RabbitMQ:', error);
            throw error;
        }
    }

    async publishMessage(message: any) {
        if (!this.channel) {
            await this.connect();
        }

        try {
            const messageBuffer = Buffer.from(JSON.stringify(message));
            this.channel!.sendToQueue(QUEUE_NAME, messageBuffer, {
                persistent: true
            });
            
            console.log('Message published to RabbitMQ');
        } catch (error) {
            console.error('Error publishing to RabbitMQ:', error);
            throw error;
        }
    }
}

export default new MessagePublisherService();
```

### Step 6: Create Webhook Controller

**File:** `src/controllers/webhook.controller.ts`

```typescript
import { Request, Response } from 'express';
import webhookStorage from '../services/webhook-storage.service';
import tenantResolver from '../services/tenant-resolver.service';
import messagePublisher from '../services/message-publisher.service';
import { detectMediaInMessage, getMessageType } from '../utils/media-detector';

export async function handleGenesysWebhook(req: Request, res: Response) {
    try {
        const webhookPayload = req.body;

        console.log('Received Genesys webhook:', JSON.stringify(webhookPayload, null, 2));

        // Extract integration ID from webhook
        // Genesys sends integration ID in metadata or custom attributes
        const integrationId = webhookPayload.metadata?.integrationId || 
                             webhookPayload.integrationId ||
                             req.headers['x-integration-id'];

        if (!integrationId) {
            console.error('No integration ID in webhook');
            return res.status(400).json({ error: 'Integration ID required' });
        }

        // 1. Resolve tenant by integration_id
        const tenant = await tenantResolver.resolveTenantByIntegrationId(integrationId as string);

        if (!tenant) {
            console.error(`No tenant found for integration: ${integrationId}`);
            // Return 200 to avoid Genesys retries for invalid tenant
            return res.status(200).json({ status: 'ignored', reason: 'tenant_not_found' });
        }

        const tenantId = tenant.id;
        console.log(`Tenant resolved: ${tenantId}`);

        // 2. Store raw webhook to MinIO
        try {
            await webhookStorage.storeWebhookPayload(webhookPayload, tenantId);
            console.log('Webhook stored to MinIO');
        } catch (storageError) {
            console.error('Failed to store webhook:', storageError);
            // Continue processing even if storage fails
        }

        // 3. Extract message from webhook
        const message = webhookPayload.message || webhookPayload;
        const conversationId = webhookPayload.conversationId || message.conversationId;

        if (!conversationId) {
            console.error('No conversation ID in webhook');
            return res.status(400).json({ error: 'Conversation ID required' });
        }

        // 4. Detect media attachments
        const mediaAttachment = detectMediaInMessage(message);
        const messageType = getMessageType(message);

        console.log(`Message type: ${messageType}`, mediaAttachment ? 'with media' : 'no media');

        // 5. Build message for RabbitMQ
        const queueMessage = {
            conversationId,
            tenantId,
            genesysMessage: message,
            genesysMessageId: message.id,
            messageType,
            attachment: mediaAttachment,
            receivedAt: new Date().toISOString()
        };

        // 6. Publish to RabbitMQ
        await messagePublisher.publishMessage(queueMessage);

        console.log('Genesys message queued for outbound processing');

        // 7. Respond to Genesys immediately
        res.status(200).json({ status: 'accepted' });

    } catch (error: any) {
        console.error('Error processing Genesys webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Verification endpoint for Genesys webhook setup
export async function verifyWebhook(req: Request, res: Response) {
    const challenge = req.query.challenge;
    
    if (challenge) {
        console.log('Webhook verification challenge:', challenge);
        return res.status(200).send(challenge);
    }

    res.status(200).json({ status: 'ready' });
}
```

### Step 7: Create Routes

**File:** `src/routes/webhook.routes.ts`

```typescript
import { Router } from 'express';
import * as webhookController from '../controllers/webhook.controller';

const router = Router();

// Webhook verification (GET)
router.get('/webhook/genesys', webhookController.verifyWebhook);

// Webhook receiver (POST)
router.post('/webhook/genesys', webhookController.handleGenesysWebhook);

export default router;
```

### Step 8: Update Main Entry Point

**File:** `src/index.ts` (modify existing)

```typescript
import express from 'express';
import webhookRoutes from './routes/webhook.routes';
import messagePublisher from './services/message-publisher.service';

const app = express();
const PORT = process.env.PORT || 3011;

app.use(express.json());

// Routes
app.use('/', webhookRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'genesys-webhook-service' });
});

// Initialize RabbitMQ connection
messagePublisher.connect().catch(console.error);

app.listen(PORT, () => {
    console.log(`Genesys Webhook Service on port ${PORT}`);
});
```

### Step 9: Update Environment Variables

**File:** `.env.example`

```env
PORT=3011
NODE_ENV=development

# Tenant Service
TENANT_SERVICE_URL=http://localhost:3007

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_QUEUE=OUTBOUND_GENESYS_MESSAGES

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

---

## ✅ Verification Steps

### 1. Start the Service

```bash
cd services/genesys-webhook-service
npm install
npm run build
npm run dev
```

### 2. Test Webhook Verification (GET)

```bash
curl "http://localhost:3011/webhook/genesys?challenge=test_challenge_123"
```

Expected Response: `test_challenge_123`

### 3. Test Text Message Webhook (POST)

```bash
curl -X POST http://localhost:3011/webhook/genesys \
  -H "Content-Type: application/json" \
  -d '{
    "integrationId": "demo-integration-001",
    "conversationId": "conv-uuid-123",
    "message": {
      "id": "genesys-msg-001",
      "type": "Text",
      "text": "Hello from agent",
      "direction": "Outbound"
    }
  }'
```

**Expected Results:**
- ✅ Response: 200 OK `{"status":"accepted"}`
- ✅ Webhook stored to MinIO `webhooks-outbound`
- ✅ Message published to RabbitMQ
- ✅ Logs show tenant resolution

### 4. Test Media Message Webhook (POST)

```bash
curl -X POST http://localhost:3011/webhook/genesys \
  -H "Content-Type: application/json" \
  -d '{
    "integrationId": "demo-integration-001",
    "conversationId": "conv-uuid-123",
    "message": {
      "id": "genesys-msg-002",
      "type": "Structured",
      "text": "Here is a document",
      "direction": "Outbound",
      "content": [{
        "contentType": "Attachment",
        "attachment": {
          "url": "https://api.mypurecloud.com/api/v2/downloads/...",
          "mediaType": "application/pdf",
          "filename": "report.pdf"
        }
      }]
    }
  }'
```

**Expected Results:**
- ✅ Media detected in message
- ✅ Attachment metadata included in RabbitMQ message
- ✅ Webhook stored to MinIO

### 5. Verify MinIO Storage

```bash
docker run --rm --network host minio/mc ls local/webhooks-outbound/demo-tenant-001/
```

Should show JSON files with timestamps.

### 6. Verify RabbitMQ Message

```bash
# Check queue has messages
curl -u guest:guest http://localhost:15672/api/queues/%2F/OUTBOUND_GENESYS_MESSAGES

# View in UI
open http://localhost:15672
```

### 7. Check Message Structure in Queue

The RabbitMQ message should contain:

```json
{
  "conversationId": "conv-uuid-123",
  "tenantId": "demo-tenant-001",
  "genesysMessage": { ... },
  "genesysMessageId": "genesys-msg-001",
  "messageType": "media",
  "attachment": {
    "url": "https://...",
    "mediaType": "application/pdf",
    "filename": "report.pdf"
  },
  "receivedAt": "2026-02-09T11:00:00.000Z"
}
```

### 8. Test Missing Tenant

```bash
curl -X POST http://localhost:3011/webhook/genesys \
  -H "Content-Type: application/json" \
  -d '{
    "integrationId": "unknown-integration-999",
    "conversationId": "conv-123",
    "message": {"type": "Text", "text": "test"}
  }'
```

Expected: 200 OK with `{"status":"ignored","reason":"tenant_not_found"}`

---

## 🚨 Common Issues

### Issue 1: Tenant Not Found
**Solution:**
```bash
# Check tenant exists with integration_id
psql -d waba_mvp -c "SELECT * FROM tenants WHERE genesys_integration_id = 'demo-integration-001';"

# Add if missing
psql -d waba_mvp -f database/seeds/001_demo_tenant.sql
```

### Issue 2: RabbitMQ Connection Failed
**Solution:**
```bash
# Check RabbitMQ is running
docker ps | grep rabbitmq

# Test connection
curl http://localhost:15672
```

### Issue 3: MinIO Storage Fails
**Solution:**
```bash
# Check MinIO is accessible
curl http://localhost:9000/minio/health/live

# Verify bucket exists
docker run --rm --network host minio/mc ls local/ | grep webhooks-outbound
```

### Issue 4: TypeScript Build Errors
**Solution:**
```bash
# Clean and rebuild
rm -rf dist
npm run build

# Check for missing types
npm install -D @types/node @types/express
```

---

## 📤 Deliverables

- [x] Webhook receiver endpoint (POST /webhook/genesys)
- [x] Webhook verification endpoint (GET /webhook/genesys)
- [x] Tenant resolution by genesys_integration_id
- [x] Raw webhook storage to MinIO (`webhooks-outbound`)
- [x] Media attachment detection (Structured messages)
- [x] RabbitMQ publishing with attachment metadata
- [x] Health check endpoint
- [x] Error handling for missing tenant
- [x] All verification tests passing

---

## 🔗 Next Dependencies

Services that depend on Genesys Webhook Service:
- ✅ Task 08 - Outbound Transformer (consumes RabbitMQ messages)

---

## 📊 Data Flow Summary

```
Genesys Cloud
    ↓ (POST webhook)
Genesys Webhook Service
    ├─→ Resolve tenant by genesys_integration_id
    ├─→ Store raw payload to MinIO (webhooks-outbound)
    ├─→ Detect media in Structured messages
    └─→ Publish to RabbitMQ (OUTBOUND_GENESYS_MESSAGES)
         ↓
    Outbound Transformer (Task 08)
         ↓
    Download media from Genesys
         ↓
    Store to MinIO (media-outbound)
         ↓
    WhatsApp API Service (Task 09)
```

---

## 🎯 Testing Checklist

Before marking complete:
- [ ] Service starts without errors
- [ ] Tenant resolution works (with Redis caching)
- [ ] Webhook payloads stored to MinIO
- [ ] Text messages published to RabbitMQ
- [ ] Media messages detected correctly
- [ ] Attachment metadata included in queue
- [ ] Missing tenant handled gracefully (returns 200)
- [ ] TypeScript compilation successful
- [ ] RabbitMQ messages have all required fields
