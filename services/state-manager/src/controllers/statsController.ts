import { Request, Response } from 'express';
import pool from '../config/database.js';

class StatsController {
    async getStats(req: Request, res: Response) {
        try {
            const mappingsCount = await pool.query('SELECT COUNT(*) FROM conversation_mappings');
            const messagesCount = await pool.query('SELECT COUNT(*) FROM message_tracking');
            const activeConversations = await pool.query(
                "SELECT COUNT(*) FROM conversation_mappings WHERE status = 'active'"
            );

            res.json({
                totalMappings: parseInt(mappingsCount.rows[0].count),
                totalMessages: parseInt(messagesCount.rows[0].count),
                activeConversations: parseInt(activeConversations.rows[0].count)
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async healthCheck(req: Request, res: Response) {
        try {
            await pool.query('SELECT 1');
            res.json({
                status: 'healthy',
                database: 'connected',
                redis: 'state-manager-redis-check-skipped' // Simplified check
            });
        } catch (error: any) {
            res.status(503).json({
                status: 'unhealthy',
                error: error.message
            });
        }
    }
}

export default new StatsController();
