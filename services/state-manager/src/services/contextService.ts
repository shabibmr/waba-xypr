import pool from '../config/database';

class ContextService {
    async updateContext(conversationId: string, context: any) {
        await pool.query(
            `INSERT INTO conversation_context (conversation_id, context)
       VALUES ($1, $2)
       ON CONFLICT (conversation_id) 
       DO UPDATE SET context = $2, updated_at = CURRENT_TIMESTAMP`,
            [conversationId, JSON.stringify(context)]
        );

        return { success: true };
    }

    async getContext(conversationId: string) {
        const result = await pool.query(
            'SELECT context FROM conversation_context WHERE conversation_id = $1',
            [conversationId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0].context;
    }
}

export default new ContextService();
