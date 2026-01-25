const pool = require('../config/database');

class StatsController {
    async getStats(req, res) {
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
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async healthCheck(req, res) {
        try {
            await pool.query('SELECT 1');
            res.json({
                status: 'healthy',
                database: 'connected',
                redis: 'state-manager-redis-check-skipped' // Simplified check
            });
        } catch (error) {
            res.status(503).json({
                status: 'unhealthy',
                error: error.message
            });
        }
    }
}

module.exports = new StatsController();
