/**
 * Message Formatting Utilities
 * Functions to format and transform messages between different formats
 */

/**
 * Format message text based on Meta message type
 * @param {Object} metaMessage - Meta message object
 * @returns {string} Formatted message text
 */
function formatMessageText(metaMessage) {
    const { type, content } = metaMessage;

    switch (type) {
        case 'text':
            return content.text;

        case 'image':
            return `[Image${content.caption ? `: ${content.caption}` : ''}]`;

        case 'document':
            return `[Document: ${content.filename || 'file'}]`;

        case 'audio':
            return '[Voice Message]';

        case 'video':
            return `[Video${content.caption ? `: ${content.caption}` : ''}]`;

        case 'location':
            return `[Location: ${content.name || 'Shared location'}]\nAddress: ${content.address || 'N/A'}\nCoordinates: ${content.latitude}, ${content.longitude}`;

        default:
            return `[Unsupported message type: ${type}]`;
    }
}

/**
 * Transform Meta message format to Genesys Open Messaging format
 * @param {Object} metaMessage - Meta message object
 * @param {string} conversationId - Genesys conversation ID
 * @param {boolean} isNew - Whether this is a new conversation
 * @returns {Object} Genesys-formatted message
 */
function transformToGenesysFormat(metaMessage, conversationId, isNew) {
    const baseMessage = {
        channel: {
            platform: 'Open',
            type: 'Private',
            messageId: metaMessage.messageId,
            time: new Date(parseInt(metaMessage.timestamp) * 1000).toISOString()
        },
        direction: 'Inbound',
        text: formatMessageText(metaMessage),
        metadata: {
            whatsappMessageId: metaMessage.messageId,
            whatsappPhone: metaMessage.from,
            phoneNumberId: metaMessage.metadata.phoneNumberId
        }
    };

    if (isNew) {
        return {
            ...baseMessage,
            type: 'Text',
            from: {
                nickname: metaMessage.contactName,
                id: metaMessage.from,
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
            conversationId
        };
    }
}

module.exports = {
    formatMessageText,
    transformToGenesysFormat
};
