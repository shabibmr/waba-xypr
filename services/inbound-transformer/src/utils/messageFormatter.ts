/**
 * Message Formatting Utilities
 * Transform functions for all Open Messaging types:
 *   1. Inbound Message (WhatsApp → Genesys)
 *   2. Status Event → Genesys Receipt
 */

import { randomUUID } from 'crypto';

// ─── Status Mapping ──────────────────────────────────────────────────────────

const WHATSAPP_TO_GENESYS_STATUS: Record<string, string> = {
    sent: 'Published',
    delivered: 'Delivered',
    read: 'Read',
    failed: 'Failed'
};

const GENESYS_EVENT_STATUS: Record<string, string> = {
    Delivered: 'delivered',
    Read: 'read',
    Typing: 'typing',
    Disconnect: 'disconnect',
    Receipt: 'delivered',
    Published: 'published',
    Failed: 'failed',
    Sent: 'sent',
    Removed: 'removed'
};

// ─── 1. Inbound Message: WhatsApp → Genesys Open Messaging ──────────────────

/**
 * Derive a sensible default filename from a MIME type.
 */
function deriveFilename(mimeType?: string): string {
    if (!mimeType) return 'attachment';
    const map: Record<string, string> = {
        'image/jpeg': 'image.jpg',
        'image/png': 'image.png',
        'image/webp': 'image.webp',
        'image/gif': 'image.gif',
        'video/mp4': 'video.mp4',
        'video/3gpp': 'video.3gp',
        'audio/aac': 'audio.aac',
        'audio/mp4': 'audio.m4a',
        'audio/mpeg': 'audio.mp3',
        'audio/amr': 'audio.amr',
        'audio/ogg': 'audio.ogg',
        'application/pdf': 'document.pdf',
    };
    return map[mimeType] || 'attachment';
}

/**
 * Map a MIME type string to the Genesys Open Messaging mediaType enum.
 * Genesys expects: "Image", "Video", "Audio", "File"
 */
function toGenesysMediaType(mimeType?: string): string {
    if (!mimeType) return 'File';
    const prefix = mimeType.split('/')[0];
    switch (prefix) {
        case 'image': return 'Image';
        case 'video': return 'Video';
        case 'audio': return 'Audio';
        default: return 'File';
    }
}

/**
 * Build Genesys content attachment array from enriched inbound message.
 * Returns null if no media URL is present.
 */
export function buildAttachmentContent(metaMessage: any): any[] | null {
    if (!metaMessage.media_url) {
        return null;
    }

    return [
        {
            contentType: 'Attachment',
            attachment: {
                mediaType: toGenesysMediaType(metaMessage.media_mime_type),
                mime: metaMessage.media_mime_type || 'application/octet-stream',
                url: metaMessage.media_url,
                filename: metaMessage.media_filename || deriveFilename(metaMessage.media_mime_type)
            }
        }
    ];
}

/**
 * Transform EnrichedInboundMessage (from state-manager) to Genesys Open Messaging format.
 * Field names follow the enriched payload schema: wamid, wa_id, contact_name,
 * phone_number_id, display_phone_number, message_text, media_url.
 */
export function transformToGenesysFormat(metaMessage: any, conversationId: string | null, isNew: boolean): any {
    const attachmentContent = buildAttachmentContent(metaMessage);

    const message: any = {
        channel: {
            platform: 'Open',
            type: 'Private',
            messageId: metaMessage.wamid,
            time: new Date(parseInt(metaMessage.timestamp) * 1000).toISOString(),
            from: {
                nickname: metaMessage.contact_name,
                id: metaMessage.wa_id,
                idType: 'Phone'
            }
        },
        direction: 'Inbound',
        type: attachmentContent ? 'Structured' : 'Text',
        text: metaMessage.message_text || ''
    };

    if (attachmentContent) {
        message.content = attachmentContent;
    }

    if (!isNew && conversationId) {
        message.conversationId = conversationId;
    }

    return message;
}

// ─── 2. Status Event → Genesys Receipt ──────────────────────────────────────

/**
 * Transform a WhatsApp status event into a Genesys Open Messaging Receipt.
 *
 * Input (from state-manager via inbound.status.evt):
 *   { type, tenantId, waId, wamid, status, timestamp, reason? }
 *
 * Output (Genesys Receipt to genesys.outbound.ready):
 *   { id, channel, type: "Receipt", status, direction: "Outbound", reason? }
 */
export function transformStatusToReceipt(event: any): any | null {
    const genesysStatus = WHATSAPP_TO_GENESYS_STATUS[event.status];
    if (!genesysStatus) {
        return null; // Unknown status — skip
    }

    const receipt: any = {
        id: randomUUID(),
        channel: {
            platform: 'Open',
            type: 'Private',
            messageId: event.messageId || event.wamid, // Use genesys message ID instead of wamid
            from: {
                id: event.waId || event.wa_id,
                idType: 'Phone'
            },
            time: new Date(parseInt(event.timestamp) * 1000).toISOString()
        },
        type: 'Receipt',
        status: genesysStatus,
        direction: 'Outbound'
    };

    if (event.status === 'failed' && event.reason) {
        receipt.reason = event.reason;
    }

    return receipt;
}

// ─── 3. Agent Widget Message: Widget → Agent Ready ──────────────────────────

/**
 * Transform an Agent Widget message into the expected "Agent Ready" format.
 * 
 * Input (from agent-widget via outbound.agent.widget.msg):
 *   { tenantId, conversationId, text, ... }
 * 
 * Output (to outbound.agent.ready.msg):
 *   { tenantId, conversationId, message, timestamp, source: 'agent-widget' }
 */
export function transformAgentMessage(body: any): any {
    const timestamp = body.timestamp || new Date().toISOString();

    return {
        tenantId: body.tenantId,
        conversationId: body.conversationId,
        communicationId: body.communicationId,
        message: body.text || body.message,
        mediaUrl: body.mediaUrl,
        mediaType: body.mediaType,
        integrationId: body.integrationId,
        timestamp,
        source: 'agent-widget',
        originalPayload: body
    };
}


