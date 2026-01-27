const pool = require('../config/database');

class MessageService {
    async trackMessage(data) {
        const { metaMessageId, genesysMessageId, conversationId, direction, status, timestamp, content, metadata } = data;

        // Combine timestamp, content, and any other metadata
        const storedMetadata = {
            timestamp,
            ...content,
            ...metadata
        };

        await pool.query(
            `INSERT INTO message_tracking 
       (conversation_id, meta_message_id, genesys_message_id, direction, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [conversationId, metaMessageId, genesysMessageId, direction, status || 'pending',
                JSON.stringify(storedMetadata)]
        );

        return { success: true };
    }

    async updateStatus(messageId, status) {
        await pool.query(
            `UPDATE message_tracking 
       SET status = $1, delivered_at = CASE WHEN $1 = 'delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END
       WHERE meta_message_id = $2 OR genesys_message_id = $2`,
            [status, messageId]
        );

        return { success: true };
    }
}

module.exports = new MessageService();
