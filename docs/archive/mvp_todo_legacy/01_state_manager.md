# 01 - State Manager Implementation

**Priority:** CRITICAL  
**Estimated Time:** 6-8 hours  
**Dependencies:** 00 - Infrastructure Setup (PostgreSQL + Redis)  
**Can Run in Parallel:** Yes (with 02, 03)

---

## 🎯 Objective
Implement the State Manager service with 4 key endpoints for conversation mapping and message tracking.

---

## 🛡️ Guard Rails (Check Before Starting)

- [x] Infrastructure setup complete (Task 00)
- [ ] PostgreSQL tables created (`conversation_mappings`, `message_tracking`)
- [ ] Redis is accessible
- [ ] State Manager service exists at `/services/state-manager`
- [ ] TypeScript configured

---

## 📍 Anchors (Where to Make Changes)

**Existing Files:**
- `/services/state-manager/src/index.ts` - Entry point
- `/services/state-manager/src/routes/` - Will add route file
- `/services/state-manager/src/controllers/` - Will add controllers
- `/services/state-manager/src/services/` - Will add services

**New Files to Create:**
- `/services/state-manager/src/routes/state.routes.ts`
- `/services/state-manager/src/controllers/mapping.controller.ts`
- `/services/state-manager/src/controllers/message.controller.ts`
- `/services/state-manager/src/services/mapping.service.ts`
- `/services/state-manager/src/services/message.service.ts`
- `/services/state-manager/src/config/database.ts`
- `/services/state-manager/src/config/redis.ts`

---

## 📝 Step-by-Step Implementation

### Step 1: Install Dependencies

```bash
cd services/state-manager
npm install pg uuid ioredis
npm install -D @types/pg @types/uuid
```

### Step 2: Create Database Configuration

**File:** `src/config/database.ts`

```typescript
import { Pool } from 'pg';

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'waba_mvp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
});

export default pool;
```

### Step 3: Create Redis Configuration

**File:** `src/config/redis.ts`

```typescript
import Redis from 'ioredis';

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
});

redis.on('error', (err) => {
    console.error('Redis connection error:', err);
});

redis.on('connect', () => {
    console.log('Redis connected');
});

export default redis;
```

### Step 4: Create Mapping Service

**File:** `src/services/mapping.service.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import redis from '../config/redis';

const MAPPING_TTL = 3600; // 1 hour

export interface ConversationMapping {
    conversationId: string;
    waId: string;
    tenantId: string;
    contactName?: string;
}

export class MappingService {
    // Forward mapping: wa_id -> conversation_id
    async getOrCreateMapping(waId: string, tenantId: string): Promise<ConversationMapping> {
        // 1. Check Redis cache
        const cacheKey = `mapping:wa:${waId}`;
        const cached = await redis.get(cacheKey);
        
        if (cached) {
            const mapping = JSON.parse(cached);
            // Update activity in DB (fire and forget)
            this.updateActivity(waId, tenantId).catch(console.error);
            return mapping;
        }

        // 2. Query database
        const query = `
            SELECT conversation_id, wa_id, tenant_id, contact_name
            FROM conversation_mappings
            WHERE wa_id = $1 AND tenant_id = $2
            LIMIT 1
        `;
        
        const result = await pool.query(query, [waId, tenantId]);

        if (result.rows.length > 0) {
            // Mapping exists
            const row = result.rows[0];
            const mapping: ConversationMapping = {
                conversationId: row.conversation_id,
                waId: row.wa_id,
                tenantId: row.tenant_id,
                contactName: row.contact_name
            };

            // Update activity
            await this.updateActivity(waId, tenantId);

            // Cache bidirectionally
            await this.cacheMapping(mapping);

            return mapping;
        }

        // 3. Create new mapping
        const conversationId = uuidv4();
        
        const insertQuery = `
            INSERT INTO conversation_mappings (
                tenant_id, wa_id, conversation_id, created_at, last_activity_at
            ) VALUES ($1, $2, $3, NOW(), NOW())
            RETURNING *
        `;

        const insertResult = await pool.query(insertQuery, [tenantId, waId, conversationId]);
        const row = insertResult.rows[0];

        const newMapping: ConversationMapping = {
            conversationId: row.conversation_id,
            waId: row.wa_id,
            tenantId: row.tenant_id,
            contactName: row.contact_name
        };

        // Cache bidirectionally
        await this.cacheMapping(newMapping);

        return newMapping;
    }

    // Reverse mapping: conversation_id -> wa_id
    async getConversationMapping(conversationId: string, tenantId: string): Promise<ConversationMapping | null> {
        // 1. Check Redis cache
        const cacheKey = `mapping:conv:${conversationId}`;
        const cached = await redis.get(cacheKey);
        
        if (cached) {
            const mapping = JSON.parse(cached);
            // Update activity in DB (fire and forget)
            this.updateActivityByConversationId(conversationId, tenantId).catch(console.error);
            return mapping;
        }

        // 2. Query database
        const query = `
            SELECT conversation_id, wa_id, tenant_id, contact_name
            FROM conversation_mappings
            WHERE conversation_id = $1 AND tenant_id = $2
            LIMIT 1
        `;
        
        const result = await pool.query(query, [conversationId, tenantId]);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        const mapping: ConversationMapping = {
            conversationId: row.conversation_id,
            waId: row.wa_id,
            tenantId: row.tenant_id,
            contactName: row.contact_name
        };

        // Update activity
        await this.updateActivityByConversationId(conversationId, tenantId);

        // Cache bidirectionally
        await this.cacheMapping(mapping);

        return mapping;
    }

    private async updateActivity(waId: string, tenantId: string) {
        const query = `
            UPDATE conversation_mappings
            SET last_activity_at = NOW()
            WHERE wa_id = $1 AND tenant_id = $2
        `;
        await pool.query(query, [waId, tenantId]);
    }

    private async updateActivityByConversationId(conversationId: string, tenantId: string) {
        const query = `
            UPDATE conversation_mappings
            SET last_activity_at = NOW()
            WHERE conversation_id = $1 AND tenant_id = $2
        `;
        await pool.query(query, [conversationId, tenantId]);
    }

    private async cacheMapping(mapping: ConversationMapping) {
        const { conversationId, waId, tenantId, contactName } = mapping;
        
        // Cache forward mapping
        await redis.setex(
            `mapping:wa:${waId}`,
            MAPPING_TTL,
            JSON.stringify({ conversationId, tenantId, contactName })
        );

        // Cache reverse mapping
        await redis.setex(
            `mapping:conv:${conversationId}`,
            MAPPING_TTL,
            JSON.stringify({ waId, tenantId, contactName })
        );
    }
}
```

### Step 5: Create Message Tracking Service

**File:** `src/services/message.service.ts`

```typescript
import pool from '../config/database';

export interface MessageTracking {
    metaMessageId?: string;
    genesysMessageId?: string;
    conversationId: string;
    tenantId: string;
    direction: 'inbound' | 'outbound';
    status: 'sent' | 'delivered' | 'read' | 'failed';
    messageType?: 'text' | 'image' | 'document' | 'video' | 'audio';
    mediaType?: string;
    mediaUrl?: string;
}

export class MessageService {
    async trackMessage(data: MessageTracking): Promise<void> {
        const query = `
            INSERT INTO message_tracking (
                tenant_id,
                conversation_id,
                meta_message_id,
                genesys_message_id,
                direction,
                status,
                message_type,
                media_type,
                media_url,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        `;

        await pool.query(query, [
            data.tenantId,
            data.conversationId,
            data.metaMessageId || null,
            data.genesysMessageId || null,
            data.direction,
            data.status,
            data.messageType || 'text',
            data.mediaType || null,
            data.mediaUrl || null
        ]);
    }

    async updateMessageStatus(messageId: string, status: string): Promise<void> {
        const timestamp = new Date();
        let setClause = 'status = $1, updated_at = $2';
        
        if (status === 'delivered') {
            setClause += ', delivered_at = $2';
        } else if (status === 'read') {
            setClause += ', read_at = $2';
        }

        const query = `
            UPDATE message_tracking
            SET ${setClause}
            WHERE meta_message_id = $3 OR genesys_message_id = $3
        `;

        await pool.query(query, [status, timestamp, messageId]);
    }
}
```

### Step 6: Create Controllers

**File:** `src/controllers/mapping.controller.ts`

```typescript
import { Request, Response } from 'express';
import { MappingService } from '../services/mapping.service';

const mappingService = new MappingService();

export const getOrCreateMapping = async (req: Request, res: Response) => {
    try {
        const { waId } = req.params;
        const tenantId = req.headers['x-tenant-id'] as string;

        if (!tenantId) {
            return res.status(400).json({ error: 'X-Tenant-ID header required' });
        }

        const mapping = await mappingService.getOrCreateMapping(waId, tenantId);
        
        res.json(mapping);
    } catch (error) {
        console.error('Error in getOrCreateMapping:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getConversationMapping = async (req: Request, res: Response) => {
    try {
        const { conversationId } = req.params;
        const tenantId = req.headers['x-tenant-id'] as string;

        if (!tenantId) {
            return res.status(400).json({ error: 'X-Tenant-ID header required' });
        }

        const mapping = await mappingService.getConversationMapping(conversationId, tenantId);
        
        if (!mapping) {
            return res.status(404).json({ error: 'Conversation mapping not found' });
        }

        res.json(mapping);
    } catch (error) {
        console.error('Error in getConversationMapping:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
```

**File:** `src/controllers/message.controller.ts`

```typescript
import { Request, Response } from 'express';
import { MessageService } from '../services/message.service';

const messageService = new MessageService();

export const trackMessage = async (req: Request, res: Response) => {
    try {
        await messageService.trackMessage(req.body);
        res.status(201).json({ message: 'Message tracked successfully' });
    } catch (error) {
        console.error('Error in trackMessage:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateMessageStatus = async (req: Request, res: Response) => {
    try {
        const { messageId } = req.params;
        const { status } = req.body;

        await messageService.updateMessageStatus(messageId, status);
        res.json({ message: 'Status updated successfully' });
    } catch (error) {
        console.error('Error in updateMessageStatus:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
```

### Step 7: Create Routes

**File:** `src/routes/state.routes.ts`

```typescript
import { Router } from 'express';
import * as mappingController from '../controllers/mapping.controller';
import * as messageController from '../controllers/message.controller';

const router = Router();

// Mapping routes
router.get('/state/mapping/:waId', mappingController.getOrCreateMapping);
router.get('/state/conversation/:conversationId', mappingController.getConversationMapping);

// Message tracking routes
router.post('/state/message', messageController.trackMessage);
router.patch('/state/message/:messageId', messageController.updateMessageStatus);

export default router;
```

### Step 8: Update Main Entry Point

**File:** `src/index.ts` (modify existing)

```typescript
import express from 'express';
import stateRoutes from './routes/state.routes';

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

// Routes
app.use('/', stateRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'state-manager' });
});

app.listen(PORT, () => {
    console.log(`State Manager running on port ${PORT}`);
});
```

### Step 9: Update Environment Variables

**File:** `.env.example`

```env
PORT=3005
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=waba_mvp
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## ✅ Verification Steps

### 1. Start the Service

```bash
cd services/state-manager
npm run dev
```

### 2. Test Forward Mapping (wa_id → conversation_id)

```bash
curl -X GET http://localhost:3005/state/mapping/+919876543210 \
  -H "X-Tenant-ID: demo-tenant-001"
```

Expected Response:
```json
{
  "conversationId": "generated-uuid",
  "waId": "+919876543210",
  "tenantId": "demo-tenant-001"
}
```

### 3. Test Reverse Mapping (conversation_id → wa_id)

```bash
curl -X GET http://localhost:3005/state/conversation/<conversation-id-from-above> \
  -H "X-Tenant-ID: demo-tenant-001"
```

### 4. Test Message Tracking

```bash
curl -X POST http://localhost:3005/state/message \
  -H "Content-Type: application/json" \
  -d '{
    "metaMessageId": "wamid.test123",
    "conversationId": "<conversation-id>",
    "tenantId": "demo-tenant-001",
    "direction": "inbound",
    "status": "sent",
    "messageType": "text"
  }'
```

### 5. Test Status Update

```bash
curl -X PATCH http://localhost:3005/state/message/wamid.test123 \
  -H "Content-Type: application/json" \
  -d '{"status": "delivered"}'
```

### 6. Verify Database

```bash
psql -d waba_mvp -c "SELECT * FROM conversation_mappings;"
psql -d waba_mvp -c "SELECT * FROM message_tracking;"
```

### 7. Verify Redis Cache

```bash
redis-cli keys "mapping:*"
redis-cli get "mapping:wa:+919876543210"
```

---

## 🚨 Common Issues

### Issue 1: Database Connection Error
**Solution:**
```bash
# Check PostgreSQL is running
docker ps | grep postgres
# Test connection
psql -h localhost -U postgres -d waba_mvp -c "SELECT 1;"
```

### Issue 2: Redis Connection Error
**Solution:**
```bash
redis-cli ping
# Should return PONG
```

### Issue 3: TypeScript Compilation Errors
**Solution:**
```bash
npm install
npm run build
```

---

## 📤 Deliverables

- [x] 4 API endpoints implemented
- [x] PostgreSQL integration working
- [x] Redis caching with bidirectional mapping
- [x] Message tracking with media support
- [x] All verification tests passing

---

## 🔗 Next Dependencies

Services that can now proceed:
- ✅ Task 05 - Inbound Transformer (needs State Manager)
- ✅ Task 08 - Outbound Transformer (needs State Manager)
