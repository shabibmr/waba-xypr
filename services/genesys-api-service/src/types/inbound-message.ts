/**
 * TypeScript types for the inbound-processed queue message schema (T03)
 * Matches FRD Section 5.1 — Input Event Schema
 */

export interface InboundMessageMetadata {
    tenantId: string;
    whatsapp_message_id: string;
    timestamp: string;
    retryCount?: number;
    correlationId: string;
}

export interface InboundMessageChannel {
    platform: string;
    type: string;
    messageId: string;
    to?: { id: string };
    from: {
        nickname: string;
        id: string;
        idType: string;
        firstName?: string;
    };
    time: string;
}

export interface InboundMessageGenesysPayload {
    id: string;
    channel: InboundMessageChannel;
    type: string;
    text?: string;
    direction: 'Inbound';
}

export interface InboundMessage {
    metadata: InboundMessageMetadata;
    genesysPayload: InboundMessageGenesysPayload;
}
