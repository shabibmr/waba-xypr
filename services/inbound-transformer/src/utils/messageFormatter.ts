/**
 * Message Formatting Utilities
 * Functions to format and transform messages between different formats
 */

const MEDIA_TYPES = ['image', 'document', 'audio', 'video', 'sticker'];

/**
 * Format message text based on Meta message type
 * @param {Object} metaMessage - Meta message object
 * @returns {string} Formatted message text
 */
export function formatMessageText(metaMessage: any): string {
    const { type, content } = metaMessage;

    // If media download failed upstream, surface the error
    if (content?.error) {
        return `[${type} unavailable — media download failed]`;
    }

    switch (type) {
        case 'text':
            return content.text;

        case 'image':
            return content.caption || '';

        case 'document':
            return content.caption || content.filename || '';

        case 'audio':
            return '';

        case 'video':
            return content.caption || '';

        case 'sticker':
            return '';

        case 'location':
            return `[Location: ${content.name || 'Shared location'}]\nAddress: ${content.address || 'N/A'}\nCoordinates: ${content.latitude}, ${content.longitude}`;

        default:
            return `[Unsupported message type: ${type}]`;
    }
}

/**
 * Build Genesys content attachment array from media message
 * Returns null if no media URL is present
 * @param {Object} metaMessage - Meta message object
 * @returns {Array|null} Genesys content array or null
 */
export function buildAttachmentContent(metaMessage: any): any[] | null {
    const { type, content } = metaMessage;

    if (!MEDIA_TYPES.includes(type) || !content?.mediaUrl) {
        return null;
    }

    const filename = content.filename
        || `${type}.${(content.mimeType || '').split('/')[1] || 'bin'}`;

    return [
        {
            contentType: 'Attachment',
            attachment: {
                mediaType: content.mimeType || 'application/octet-stream',
                url: content.mediaUrl,
                filename
            }
        }
    ];
}

/**
 * Transform Meta message format to Genesys Open Messaging format
 * @param {Object} metaMessage - Meta message object
 * @param {string} conversationId - Genesys conversation ID
 * @param {boolean} isNew - Whether this is a new conversation
 * @returns {Object} Genesys-formatted message
 */
export function transformToGenesysFormat(metaMessage: any, conversationId: string, isNew: boolean): any {
    const attachmentContent = buildAttachmentContent(metaMessage);

    const baseMessage: any = {
        channel: {
            platform: 'Open',
            type: 'Private',
            messageId: metaMessage.messageId,
            time: new Date(parseInt(metaMessage.timestamp) * 1000).toISOString()
        },
        direction: 'Inbound',
        type: attachmentContent ? 'Structured' : 'Text',
        text: formatMessageText(metaMessage),
        metadata: {
            whatsappMessageId: metaMessage.messageId,
            whatsappPhone: metaMessage.from,
            phoneNumberId: metaMessage.metadata.phoneNumberId
        }
    };

    if (attachmentContent) {
        baseMessage.content = attachmentContent;
    }

    const fromField = {
        nickname: metaMessage.contactName,
        id: metaMessage.from
    };

    if (isNew) {
        return {
            ...baseMessage,
            from: {
                ...fromField,
                idType: 'Phone'
            },
            to: {
                id: metaMessage.metadata.displayPhoneNumber,
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
