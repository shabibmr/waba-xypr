import pool from '../config/database';
import tenantConnectionFactory from './tenantConnectionFactory';
import logger from '../utils/logger';

class ContextService {
    async updateContext(conversationId: string, context: any, tenantId?: string) {
        try {
            const db = tenantId ? await tenantConnectionFactory.getConnection(tenantId) : pool;

            await db.query(
                `INSERT INTO conversation_context (conversation_id, context)
       VALUES ($1, $2)
       ON CONFLICT (conversation_id) 
       DO UPDATE SET context = $2, updated_at = CURRENT_TIMESTAMP`,
                [conversationId, JSON.stringify(context)]
            );

            logger.info('Context updated', { conversationId });
            return { success: true };
        } catch (error: any) {
            logger.error('Failed to update context', { conversationId, error: error.message });
            throw error;
        }
    }

    async getContext(conversationId: string, tenantId?: string) {
        try {
            const db = tenantId ? await tenantConnectionFactory.getConnection(tenantId) : pool;

            const result = await db.query(
                'SELECT context FROM conversation_context WHERE conversation_id = $1',
                [conversationId]
            );

            if (result.rows.length === 0) {
                logger.debug('No context found', { conversationId });
                return null;
            }

            return result.rows[0].context;
        } catch (error: any) {
            logger.error('Failed to get context', { conversationId, error: error.message });
            throw error;
        }
    }
}

export default new ContextService();
