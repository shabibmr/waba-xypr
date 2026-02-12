# 08 - Outbound Transformer

**Priority:** HIGH  
**Est Time:** 5-7 hours  
**Dependencies:** 00, 01 (State), 07 (Genesys Webhook), 09 (WhatsApp API)  
**Parallel:** No (depends on multiple services)

---

## 🎯 Objective
Consume Genesys messages from RabbitMQ, download media, transform to WhatsApp format, and send.

---

## 🛡️ Guard Rails
- [x] RabbitMQ queue `OUTBOUND_GENESYS_MESSAGES` exists
- [x] State Manager running (3005)
- [x] WhatsApp API Service running (3008)
- [x] Auth Service running (3004) - for downloading media from Genesys

---

## 📍 Anchors
**Modify:** `src/controllers/outbound.controller.ts`  
**New:** `src/services/media-downloader.service.ts`  
**New:** `src/services/whatsapp-transformer.service.ts`

---

## 📝 Implementation

### Step 1: Media Downloader Service

**File:** `src/services/media-downloader.service.ts`

```typescript
import axios from 'axios';
import { Client } from 'minio';
import { v4 as uuidv4 } from 'uuid';
import { getGenesysToken } from './auth.client';

const minioClient = new Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
});

export class MediaDownloader {
    async downloadGenesysMedia(mediaUrl: string, mimeType: string, tenantId: string) {
        // Get OAuth token for Genesys API
        const token = await getGenesysToken(tenantId);

        // Download media
        const response = await axios.get(mediaUrl, {
            headers: { 'Authorization': `Bearer ${token}` },
            responseType: 'arraybuffer'
        });

        const buffer = Buffer.from(response.data);

        // Determine file extension
        const ext = this.getExtension(mimeType);
        const filename = `${uuidv4()}.${ext}`;
        const bucketName = 'media-outbound';
        const objectPath = `${tenantId}/${new Date().toISOString().split('T')[0]}/${filename}`;

        // Upload to MinIO
        await minioClient.putObject(bucketName, objectPath, buffer, {
            'Content-Type': mimeType
        });

        // Generate presigned URL (24 hours for WhatsApp)
        const presignedUrl = await minioClient.presignedGetObject(
            bucketName,
            objectPath,
            24 * 60 * 60 // 24 hours
        );

        return {
            storagePath: objectPath,
            publicUrl: presignedUrl,
            fileSize: buffer.length,
            mimeType
        };
    }

    private getExtension(mimeType: string): string {
        const map: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'application/pdf': 'pdf',
            'video/mp4': 'mp4'
        };
        return map[mimeType] || 'bin';
    }
}
```

### Step 2: WhatsApp Transformer

**File:** `src/services/whatsapp-transformer.service.ts`

```typescript
export class WhatsAppTransformer {
    async transformToWhatsApp(genesysMessage: any, waId: string, tenantId: string, mediaDownloader: any) {
        const { type, text, content } = genesysMessage;

        // Text message
        if (type === 'Text') {
            return {
                to: waId,
                tenantId,
                message: {
                    type: 'text',
                    text: text
                }
            };
        }

        // Media message (Structured)
        if (type === 'Structured' && content && content.length > 0) {
            const attachment = content.find((c: any) => c.contentType === 'Attachment');
            
            if (attachment) {
                // Download media from Genesys
                const mediaResult = await mediaDownloader.downloadGenesysMedia(
                    attachment.attachment.url,
                    attachment.attachment.mediaType,
                    tenantId
                );

                // Determine WhatsApp media type
                const messageType = this.getWhatsAppMediaType(attachment.attachment.mediaType);

                return {
                    to: waId,
                    tenantId,
                    message: {
                        type: messageType,
                        mediaUrl: mediaResult.publicUrl,
                        caption: text || undefined
                    },
                    mediaTracking: {
                        mediaType: attachment.attachment.mediaType,
                        mediaUrl: mediaResult.storagePath
                    }
                };
            }
        }

        throw new Error(`Unsupported Genesys message type: ${type}`);
    }

    private getWhatsAppMediaType(mimeType: string): 'image' | 'document' | 'video' {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        return 'document';
    }
}
```

### Step 3: Outbound Consumer

**File:** `src/consumers/outboundConsumer.ts` (modify)

```typescript
import { Channel, ConsumeMessage } from 'amqplib';
import { StateService } from '../services/state.service';
import { WhatsAppTransformer } from '../services/whatsapp-transformer.service';
import { MediaDownloader } from '../services/media-downloader.service';
import axios from 'axios';

const stateService = new StateService();
const transformer = new WhatsAppTransformer();
const mediaDownloader = new MediaDownloader();

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'http://localhost:3008';

export async function processOutboundMessage(msg: ConsumeMessage, channel: Channel) {
    try {
        const message = JSON.parse(msg.content.toString());
        console.log('Processing outbound message:', message.conversationId);

        // 1. Get reverse mapping (conversation_id → wa_id)
        const mapping = await stateService.getConversationMapping(
            message.conversationId,
            message.tenantId
        );

        if (!mapping) {
            console.error('No mapping found for conversation:', message.conversationId);
            channel.ack(msg);
            return;
        }

        console.log('Reverse mapping:', mapping.waId);

        // 2. Transform Genesys → WhatsApp
        const whatsappMessage = await transformer.transformToWhatsApp(
            message.genesysMessage,
            mapping.waId,
            message.tenantId,
            mediaDownloader
        );

        // 3. Send to WhatsApp API Service
        const response = await axios.post(`${WHATSAPP_API_URL}/whatsapp/send`, whatsappMessage);

        console.log('Message sent to WhatsApp:', response.data.messageId);

        // 4. Track message
        await stateService.trackMessage({
            metaMessageId: response.data.messageId,
            genesysMessageId: message.genesysMessageId,
            conversationId: mapping.conversationId,
            tenantId: message.tenantId,
            direction: 'outbound',
            status: 'sent',
            messageType: whatsappMessage.message.type,
            mediaType: whatsappMessage.mediaTracking?.mediaType,
            mediaUrl: whatsappMessage.mediaTracking?.mediaUrl
        });

        // 5. Acknowledge
        channel.ack(msg);
        console.log('Outbound message processed successfully');

    } catch (error) {
        console.error('Error processing outbound message:', error);
        channel.nack(msg, false, true);
    }
}
```

---

## ✅ Verification

```bash
# Publish test Genesys message
curl -u guest:guest -X POST "http://localhost:15672/api/exchanges/%2F/amq.default/publish" \
  -H "content-type:application/json" \
  -d '{
    "routing_key": "OUTBOUND_GENESYS_MESSAGES",
    "payload": "{\"conversationId\":\"<existing-conv-id>\",\"tenantId\":\"demo-tenant-001\",\"genesysMessage\":{\"type\":\"Text\",\"text\":\"Hello from agent\"},\"genesysMessageId\":\"gen-msg-123\"}",
    "payload_encoding": "string"
  }'
```

---

## 📤 Deliverables
- [x] Reverse mapping lookup
- [x] Media download from Genesys
- [x] MinIO storage for outbound media
- [x] Transformation to WhatsApp format
- [x] WhatsApp API integration
- [x] Message tracking
