# 05 - Inbound Transformer Implementation

**Priority:** HIGH  
**Estimated Time:** 4-6 hours  
**Dependencies:** 00 (Infrastructure), 01 (State Manager), 06 (Genesys API Service)  
**Can Run in Parallel:** Yes (with 02, 03, 04, 07, 08, 09)

---

## 🎯 Objective
Complete the Inbound Transformer to consume WhatsApp messages from RabbitMQ, transform them to Genesys format, and send to Genesys Cloud.

---

## 🛡️ Guard Rails

- [x] RabbitMQ queue `INBOUND_WHATSAPP_MESSAGES` exists
- [x] State Manager running on port 3005
- [x] Genesys API Service running on port 3010
- [x] Inbound Transformer has RabbitMQ consumer setup

---

## 📍 Anchors

**Existing Files to Modify:**
- `/services/inbound-transformer/src/consumers/inboundConsumer.ts`
- `/services/inbound-transformer/src/services/transformer.service.ts`

**New Files:**
- `/services/inbound-transformer/src/services/genesys.service.ts`
- `/services/inbound-transformer/src/services/state.service.ts`

---

## 📝 Implementation

### Step 1: Create State Service Client

**File:** `src/services/state.service.ts`

```typescript
import axios from 'axios';

const STATE_MANAGER_URL = process.env.STATE_MANAGER_URL || 'http://localhost:3005';

export class StateService {
    async getOrCreateMapping(waId: string, tenantId: string) {
        const response = await axios.get(
            `${STATE_MANAGER_URL}/state/mapping/${waId}`,
            { headers: { 'X-Tenant-ID': tenantId } }
        );
        return response.data;
    }

    async trackMessage(data: any) {
        await axios.post(`${STATE_MANAGER_URL}/state/message`, data);
    }
}
```

### Step 2: Create Genesys Service Client

**File:** `src/services/genesys.service.ts`

```typescript
import axios from 'axios';

const GENESYS_API_URL = process.env.GENESYS_API_URL || 'http://localhost:3010';

export class GenesysService {
    async sendInboundMessage(conversationId: string, message: any, tenantId: string) {
        const response = await axios.post(
            `${GENESYS_API_URL}/genesys/messages/inbound`,
            { conversationId, message, tenantId }
        );
        return response.data;
    }
}
```

### Step 3: Update Transformer Service

**File:** `src/services/transformer.service.ts` (modify existing)

```typescript
export class TransformerService {
    transformToGenesys(whatsappMessage: any, conversationId: string, tenantId: string) {
        const { type, content, waId, phoneNumberId } = whatsappMessage;

        // Text message
        if (type === 'text') {
            return {
                channel: {
                    platform: 'Open',
                    from: { id: waId },
                    to: { id: phoneNumberId }
                },
                type: 'Text',
                text: content.text,
                direction: 'Inbound',
                metadata: {
                    tenantId,
                    source: 'whatsapp',
                    conversationId
                }
            };
        }

        // Media messages (image, document, video)
        if (['image', 'document', 'video'].includes(type)) {
            const mediaType = this.getGenesysMediaType(content.mimeType);
            
            return {
                channel: {
                    platform: 'Open',
                    from: { id: waId },
                    to: { id: phoneNumberId }
                },
                type: 'Structured',
                direction: 'Inbound',
                content: [{
                    contentType: 'Attachment',
                    attachment: {
                        mediaType: content.mimeType,
                        url: content.mediaUrl,
                        filename: `media.${this.getExtension(content.mimeType)}`
                    }
                }],
                text: content.caption || `Sent a ${type}`,
                metadata: {
                    tenantId,
                    source: 'whatsapp',
                    conversationId
                }
            };
        }

        throw new Error(`Unsupported message type: ${type}`);
    }

    private getGenesysMediaType(mimeType: string): string {
        return mimeType; // Genesys accepts standard MIME types
    }

    private getExtension(mimeType: string): string {
        const map: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'application/pdf': 'pdf',
            'video/mp4': 'mp4'
        };
        return map[mimeType] || 'bin';
    }
}
```

### Step 4: Update Inbound Consumer

**File:** `src/consumers/inboundConsumer.ts` (modify existing)

```typescript
import { Channel, ConsumeMessage } from 'amqplib';
import { TransformerService } from '../services/transformer.service';
import { StateService } from '../services/state.service';
import { GenesysService } from '../services/genesys.service';

const transformerService = new TransformerService();
const stateService = new StateService();
const genesysService = new GenesysService();

export async function processInboundMessage(msg: ConsumeMessage, channel: Channel) {
    try {
        const message = JSON.parse(msg.content.toString());
        console.log('Processing inbound message:', message.messageId);

        // 1. Get or create conversation mapping
        const mapping = await stateService.getOrCreateMapping(
            message.waId,
            message.tenantId
        );

        console.log('Conversation mapping:', mapping.conversationId);

        // 2. Transform message
        const genesysMessage = transformerService.transformToGenesys(
            message,
            mapping.conversationId,
            message.tenantId
        );

        // 3. Send to Genesys
        const result = await genesysService.sendInboundMessage(
            mapping.conversationId,
            genesysMessage,
            message.tenantId
        );

        console.log('Message sent to Genesys:', result.messageId);

        // 4. Track message
        await stateService.trackMessage({
            metaMessageId: message.messageId,
            genesysMessageId: result.messageId,
            conversationId: mapping.conversationId,
            tenantId: message.tenantId,
            direction: 'inbound',
            status: 'delivered',
            messageType: message.type,
            mediaType: message.content?.mimeType,
            mediaUrl: message.content?.mediaUrl
        });

        // 5. Acknowledge message
        channel.ack(msg);
        console.log('Inbound message processed successfully');

    } catch (error) {
        console.error('Error processing inbound message:', error);
        // Reject and requeue
        channel.nack(msg, false, true);
    }
}

// Update the consumer setup to call processInboundMessage
export async function startConsumer(channel: Channel) {
    await channel.consume('INBOUND_WHATSAPP_MESSAGES', (msg) => {
        if (msg) {
            processInboundMessage(msg, channel);
        }
    });
}
```

---

## ✅ Verification

### 1. Test with Mock Message

```bash
# Publish test message to RabbitMQ
curl -u guest:guest -X POST "http://localhost:15672/api/exchanges/%2F/amq.default/publish" \
  -H "content-type:application/json" \
  -d '{
    "properties": {},
    "routing_key": "INBOUND_WHATSAPP_MESSAGES",
    "payload": "{\"messageId\":\"test-123\",\"waId\":\"+919876543210\",\"tenantId\":\"demo-tenant-001\",\"type\":\"text\",\"content\":{\"text\":\"Hello from WhatsApp\"},\"phoneNumberId\":\"123456789\"}",
    "payload_encoding": "string"
  }'
```

### 2. Check Logs

```bash
cd services/inbound-transformer
npm run dev
# Should see:
# - Processing inbound message: test-123
# - Conversation mapping: <uuid>
# - Message sent to Genesys: <genesys-msg-id>
# - Inbound message processed successfully
```

### 3. Verify in Database

```sql
SELECT * FROM conversation_mappings WHERE wa_id = '+919876543210';
SELECT * FROM message_tracking WHERE meta_message_id = 'test-123';
```

---

## 📤 Deliverables

- [x] State Manager integration
- [x] Genesys API integration
- [x] Text message transformation
- [x] Media message transformation (image/document/video)
- [x] Message tracking
- [x] Error handling with requeue

---

## 🔗 Blocks

- Genesys API Service (Task 06) must be running
