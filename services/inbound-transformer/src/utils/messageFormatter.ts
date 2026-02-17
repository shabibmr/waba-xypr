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
                mediaType: 'application/octet-stream',
                url: metaMessage.media_url,
                filename: 'attachment'
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
            messageId: event.wamid,
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
        message: body.text || body.message,
        media: body.media,
        timestamp,
        source: 'agent-widget',
        originalPayload: body
    };
}


