/**
 * Genesys Formatter Utils
 * Transform functions for Genesys Open Messaging types:
 *   1. Outbound Message (Genesys → internal)
 *   2. Inbound Receipt (Genesys Published/Failed)
 *   3. Outbound Event (Genesys Typing/Disconnect/Receipt)
 */

const GENESYS_EVENT_STATUS: { [key: string]: string } = {
    'Published': 'sent',
    'Failed': 'failed',
    'Delivery': 'delivered',
    'Read': 'read',
    'Typing': 'typing',
    'Disconnect': 'disconnect',
    'Receipt': 'receipt' // Generic receipt type if status is missing
};

// ─── 1. Outbound Message: Genesys → Internal format ─────────────────────────

/**
 * Transform a Genesys Open Messaging outbound message into an internal
 * normalized payload for the outbound pipeline (→ outbound-transformer → WhatsApp).
 *
 * Input (from genesys-webhook via om.outbound.msg):
 *   Genesys Open Messaging outbound body (type: Text/Structured, direction: Outbound)
 *
 * Output (to outbound.ready.msg or outbound.genesys.msg):
 *   { tenantId, conversation_id, genesys_message_id, message_text, media?, timestamp }
 */
export function transformOutboundMessage(body: any, tenantId: string): any {
    const channel = body.channel || {};
    const text: string | undefined = body.text;
    const content: any[] = body.content || [];
    const conversationId: string = body.conversationId || body.conversation?.id || channel.id;
    const timestamp: string = channel.time || new Date().toISOString();

    // Detect attachment
    let media: any = null;
    const attachments = content.filter((c: any) => c.contentType === 'Attachment');
    if (attachments.length > 0) {
        const att = attachments[0];
        const attData = att.attachment || att;
        const mediaUrl = attData.url || attData.mediaUrl;
        if (mediaUrl) {
            media = {
                url: mediaUrl,
                contentType: attData.mediaType || attData.mimeType,
                filename: attData.filename
            };
        }
    }

    return {
        tenantId,
        conversation_id: conversationId,
        genesys_message_id: body.id,
        message_text: text,
        media: media ?? undefined,
        timestamp
    };
}

// ─── 2. Inbound Receipt: Genesys Published/Failed → Internal Status ─────────

/**
 * Transform a Genesys Inbound Receipt (Published/Failed) into an internal
 * status update payload.
 *
 * Input (from genesys-webhook, direction: Inbound, type: Receipt):
 *   { id, channel, type: "Receipt", status: "Published"|"Failed", reasons? }
 *
 * Output (to genesys.status updates):
 *   { tenantId, genesysId, originalMessageId, status, isFinalReceipt, timestamp, reasons? }
 */
export function transformInboundReceipt(body: any, tenantId: string): any {
    const channel = body.channel || {};
    const rawStatus: string = body.status || 'unknown';
    const mappedStatus = GENESYS_EVENT_STATUS[rawStatus] || rawStatus.toLowerCase();
    const timestamp: string = channel.time || new Date().toISOString();

    const payload: any = {
        tenantId,
        genesysId: body.id,
        originalMessageId: channel.messageId,
        status: mappedStatus,
        isFinalReceipt: body.isFinalReceipt ?? true,
        timestamp
    };

    if (rawStatus === 'Failed' && body.reasons) {
        payload.reasons = body.reasons;
    }

    return payload;
}

// ─── 3. Outbound Event: Genesys Typing/Disconnect/Receipt → Internal Event ──

/**
 * Transform a Genesys outbound event (Typing, Disconnect, Receipt) into
 * an internal event payload for agent portal and state updates.
 *
 * Input (from genesys-webhook via om.outbound.evt):
 *   { id, channel, type: "Receipt"|"Typing"|"Disconnect", status?, direction: "Outbound" }
 *
 * Output:
 *   { tenantId, genesysId, originalMessageId, status, eventType, timestamp }
 */
export function transformOutboundEvent(body: any, tenantId: string): any {
    const channel = body.channel || {};
    const type: string = body.type;
    const rawStatus: string | undefined = body.status;
    const timestamp: string = channel.time || new Date().toISOString();

    const mappedStatus = rawStatus
        ? (GENESYS_EVENT_STATUS[rawStatus] || rawStatus.toLowerCase())
        : (GENESYS_EVENT_STATUS[type] || type.toLowerCase());

    return {
        tenantId,
        genesysId: body.id,
        originalMessageId: channel.messageId,
        status: mappedStatus,
        eventType: type.toLowerCase(),
        timestamp
    };
}
