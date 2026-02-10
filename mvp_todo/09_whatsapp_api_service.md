# 09 - WhatsApp API Service

**Priority:** HIGH  
**Est Time:** 4-5 hours  
**Dependencies:** 00, 02 (Tenant), 03 (Auth)  
**Parallel:** Yes (with 06, 07)

---

## 🎯 Objective
Implement endpoint to send messages (text + media) to WhatsApp Cloud API.

---

## 🛡️ Guard Rails
- [x] Auth Service running (port 3004)
- [x] Tenant Service running (port 3007)
- [x] WhatsApp credentials configured

---

## 📍 Anchors
**New File:** `src/routes/send.routes.ts`  
**New File:** `src/controllers/send.controller.ts`  
**New File:** `src/services/whatsapp.service.ts`

---

## 📝 Implementation

### Step 1: Create WhatsApp Service

**File:** `src/services/whatsapp.service.ts`

```typescript
import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3004';

export class WhatsAppService {
    async getAccessToken(tenantId: string): Promise<{ token: string; phoneNumberId: string }> {
        const response = await axios.get(`${AUTH_SERVICE_URL}/auth/token`, {
            headers: { 
                'X-Tenant-ID': tenantId,
                'X-Credential-Type': 'whatsapp'
            }
        });
        return {
            token: response.data.token,
            phoneNumberId: response.data.phoneNumberId
        };
    }

    async sendMessage(phoneNumberId: string, accessToken: string, payload: any) {
        const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
        
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    }

    buildTextPayload(to: string, text: string) {
        return {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'text',
            text: { body: text }
        };
    }

    buildMediaPayload(to: string, type: 'image' | 'document' | 'video', mediaUrl: string, caption?: string) {
        const payload: any = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type
        };

        payload[type] = { link: mediaUrl };
        
        if (caption && type === 'image') {
            payload[type].caption = caption;
        }

        return payload;
    }
}
```

### Step 2: Create Send Controller

**File:** `src/controllers/send.controller.ts`

```typescript
import { Request, Response } from 'express';
import { WhatsAppService } from '../services/whatsapp.service';

const whatsappService = new WhatsAppService();

export async function sendMessage(req: Request, res: Response) {
    try {
        const { to, message, tenantId } = req.body;

        // Get WhatsApp credentials
        const { token, phoneNumberId } = await whatsappService.getAccessToken(tenantId);

        let payload;

        // Build payload based on message type
        if (message.type === 'text') {
            payload = whatsappService.buildTextPayload(to, message.text);
        } else if (['image', 'document', 'video'].includes(message.type)) {
            payload = whatsappService.buildMediaPayload(
                to,
                message.type,
                message.mediaUrl,
                message.caption
            );
        } else {
            return res.status(400).json({ error: 'Unsupported message type' });
        }

        // Send to WhatsApp
        const result = await whatsappService.sendMessage(phoneNumberId, token, payload);

        res.json({
            messageId: result.messages[0].id,
            status: 'sent',
            waId: to
        });

    } catch (error: any) {
        console.error('Error sending to WhatsApp:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to send message to WhatsApp',
            details: error.response?.data || error.message
        });
    }
}
```

### Step 3: Create Routes

**File:** `src/routes/send.routes.ts`

```typescript
import { Router } from 'express';
import * as sendController from '../controllers/send.controller';

const router = Router();

router.post('/whatsapp/send', sendController.sendMessage);

export default router;
```

### Step 4: Update Main Entry

**File:** `src/index.ts` (modify)

```typescript
import express from 'express';
import sendRoutes from './routes/send.routes';

const app = express();
const PORT = process.env.PORT || 3008;

app.use(express.json());
app.use('/', sendRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'whatsapp-api-service' });
});

app.listen(PORT, () => {
    console.log(`WhatsApp API Service on port ${PORT}`);
});
```

---

## ✅ Verification

```bash
# Test text message
curl -X POST http://localhost:3008/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+919876543210",
    "tenantId": "demo-tenant-001",
    "message": {
      "type": "text",
      "text": "Hello from Genesys!"
    }
  }'

# Test media message
curl -X POST http://localhost:3008/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+919876543210",
    "tenantId": "demo-tenant-001",
    "message": {
      "type": "image",
      "mediaUrl": "https://your-minio/media.jpg",
      "caption": "Check this out"
    }
  }'
```

---

## 📤 Deliverables
- [x] Send text messages
- [x] Send image messages
- [x] Send document messages
- [x] Send video messages
- [x] WhatsApp token integration
