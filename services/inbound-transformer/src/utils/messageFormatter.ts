/**
 * Message Formatting Utilities
 * Functions to format and transform messages between different formats
 */

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

    const baseMessage: any = {
        channel: {
            platform: 'Open',
            type: 'Private',
            messageId: metaMessage.wamid,
            time: new Date(parseInt(metaMessage.timestamp) * 1000).toISOString()
        },
        direction: 'Inbound',
        type: attachmentContent ? 'Structured' : 'Text',
        text: metaMessage.message_text || '',
        metadata: {
            whatsappMessageId: metaMessage.wamid,
            whatsappPhone: metaMessage.wa_id,
            phoneNumberId: metaMessage.phone_number_id
        }
    };

    if (attachmentContent) {
        baseMessage.content = attachmentContent;
    }

    const fromField = {
        nickname: metaMessage.contact_name,
        id: metaMessage.wa_id
    };

    if (isNew) {
        return {
            ...baseMessage,
            from: {
                ...fromField,
                idType: 'Phone'
            },
            to: {
                id: metaMessage.display_phone_number,
                idType: 'Phone'
            }
        };
    } else {
        return {
            ...baseMessage,
            conversationId,
            from: fromField
        };
    }
}
