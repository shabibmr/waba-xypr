# 06 - Genesys API Service

**Priority:** HIGH  
**Est Time:** 4-5 hours  
**Dependencies:** 00, 02 (Tenant), 03 (Auth)  
**Parallel:** Yes (with 07, 09)

---

## 🎯 Objective
Implement endpoint to send messages (text + media) to Genesys Cloud using Open Messaging API.

---

## 🛡️ Guard Rails
- [x] Auth Service running (port 3004)
- [x] Tenant Service running (port 3007)
- [x] Genesys OAuth credentials configured

---

## 📍 Anchors
**New File:** `src/routes/messages.routes.ts`  
**New File:** `src/controllers/messages.controller.ts` **New File:** `src/services/auth.client.ts`

---

## 📝 Implementation

### Step 1: Create Auth Client

**File:** `src/services/auth.client.ts`

```typescript
import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3004';

export async function getGenesysToken(tenantId: string): Promise<string> {
    const response = await axios.get(`${AUTH_SERVICE_URL}/auth/token`, {
        headers: { 'X-Tenant-ID': tenantId }
    });
    return response.data.token;
}
```

### Step 2: Create Messages Controller

**File:** `src/controllers/messages.controller.ts`

```typescript
import { Request, Response } from 'express';
import axios from 'axios';
import { getGenesysToken } from '../services/auth.client';

export async function sendInboundMessage(req: Request, res: Response) {
    try {
        const { conversationId, message, tenantId } = req.body;

        // Get OAuth token
        const token = await getGenesysToken(tenantId);

        // Get region from tenant (or use default)
        const region = process.env.GENESYS_REGION || 'mypurecloud.com';
        const apiUrl = `https://api.${region}/api/v2/conversations/messages/${conversationId}`;

        // Send to Genesys
        const response = await axios.post(apiUrl, message, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({
            messageId: response.data.id,
            status: 'sent',
            genesysConversationId: conversationId
        });

    } catch (error: any) {
        console.error('Error sending to Genesys:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to send message to Genesys',
            details: error.response?.data || error.message
        });
    }
}
```

### Step 3: Create Routes

**File:** `src/routes/messages.routes.ts`

```typescript
import { Router } from 'express';
import * as messagesController from '../controllers/messages.controller';

const router = Router();

router.post('/genesys/messages/inbound', messagesController.sendInboundMessage);

export default router;
```

### Step 4: Update Main Entry

**File:** `src/index.ts` (modify)

```typescript
import express from 'express';
import messagesRoutes from './routes/messages.routes';

const app = express();
const PORT = process.env.PORT || 3010;

app.use(express.json());
app.use('/', messagesRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'genesys-api-service' });
});

app.listen(PORT, () => {
    console.log(`Genesys API Service on port ${PORT}`);
});
```

---

## ✅ Verification

```bash
# Test sending text message
curl -X POST http://localhost:3010/genesys/messages/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "test-conversation-id",
    "tenantId": "demo-tenant-001",
    "message": {
      "type": "Text",
      "text": "Test message",
      "direction": "Inbound"
    }
  }'
```

---

## 📤 Deliverables
- [x] Send text messages to Genesys
- [x] Send media messages (Structured type)
- [x] OAuth token integration
- [x] Error handling
