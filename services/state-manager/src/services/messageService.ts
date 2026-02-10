import pool from '../config/database';

class MessageService {
    async trackMessage(data: any) {
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

    async updateStatus(messageId: string, status: string, genesysMessageId?: string) {
        let query = `UPDATE message_tracking 
       SET status = $1, delivered_at = CASE WHEN $1 = 'delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END`;

        const params: any[] = [status, messageId];
        let paramIndex = 3;

        if (genesysMessageId) {
            query += `, genesys_message_id = $${paramIndex}`;
            params.push(genesysMessageId);
            paramIndex++;
        }

        query += ` WHERE meta_message_id = $2 OR genesys_message_id = $2`;

        await pool.query(query, params);

        return { success: true };
    }

    async getMessagesByConversation(conversationId: string, limit = 50, offset = 0) {
        const result = await pool.query(
            `SELECT 
                conversation_id,
                meta_message_id,
                genesys_message_id,
                direction,
                status,
                metadata,
                created_at,
                delivered_at
             FROM message_tracking 
             WHERE conversation_id = $1 
             ORDER BY created_at ASC 
             LIMIT $2 OFFSET $3`,
            [conversationId, limit, offset]
        );

        // Transform to frontend format
        const messages = result.rows.map(row => ({
            id: row.meta_message_id || row.genesys_message_id,
            conversation_id: row.conversation_id,
            direction: row.direction,
            text: row.metadata?.text || row.metadata?.body?.text || row.metadata?.message || '',
            timestamp: row.created_at,
            status: row.status,
            delivered_at: row.delivered_at
        }));

        return {
            messages,
            total: result.rowCount,
            limit,
            offset
        };
    }
}

export default new MessageService();
