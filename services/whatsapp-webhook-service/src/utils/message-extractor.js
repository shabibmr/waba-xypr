/**
 * Message content extractor
 * Extracts content from different WhatsApp message types
 */

/**
 * Extract message content based on message type
 * @param {Object} message - WhatsApp message object
 * @returns {Object} Extracted content
 */
function extractMessageContent(message) {
    switch (message.type) {
        case 'text':
            return { text: message.text.body };

        case 'image':
            return {
                mediaId: message.image.id,
                mimeType: message.image.mime_type,
                sha256: message.image.sha256,
                caption: message.image.caption
            };

        case 'document':
            return {
                mediaId: message.document.id,
                filename: message.document.filename,
                mimeType: message.document.mime_type,
                sha256: message.document.sha256,
                caption: message.document.caption
            };

        case 'audio':
            return {
                mediaId: message.audio.id,
                mimeType: message.audio.mime_type,
                sha256: message.audio.sha256
            };

        case 'video':
            return {
                mediaId: message.video.id,
                mimeType: message.video.mime_type,
                sha256: message.video.sha256,
                caption: message.video.caption
            };

        case 'sticker':
            return {
                mediaId: message.sticker.id,
                mimeType: message.sticker.mime_type,
                sha256: message.sticker.sha256
            };

        case 'location':
            return {
                latitude: message.location.latitude,
                longitude: message.location.longitude,
                name: message.location.name,
                address: message.location.address
            };

        case 'contacts':
            return {
                contacts: message.contacts
            };

        case 'interactive':
            return {
                interactiveType: message.interactive.type,
                buttonReply: message.interactive.button_reply,
                listReply: message.interactive.list_reply
            };

        case 'button':
            return {
                buttonText: message.button.text,
                buttonPayload: message.button.payload
            };

        default:
            return { raw: message };
    }
}

module.exports = { extractMessageContent };
