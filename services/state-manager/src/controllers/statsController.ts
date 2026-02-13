import { Request, Response } from 'express';
import tenantConnectionFactory from '../services/tenantConnectionFactory';
import pool from '../config/database';
import redisClient from '../config/redis';
import { rabbitmqService } from '../services/rabbitmq.service';

class StatsController {
    async getStats(req: Request, res: Response) {
        try {
            const tenantId = req.headers['x-tenant-id'] as string;
            if (!tenantId) {
                return res.status(400).json({ error: 'Tenant ID is required' });
            }

            const pool = await tenantConnectionFactory.getConnection(tenantId);

            const mappingsCount = await pool.query('SELECT COUNT(*) FROM conversation_mappings');
            const messagesCount = await pool.query('SELECT COUNT(*) FROM message_tracking');
            const activeConversations = await pool.query(
                "SELECT COUNT(*) FROM conversation_mappings WHERE status = 'active'"
            );

            res.json({
                totalMappings: parseInt(mappingsCount.rows[0].count),
                totalMessages: parseInt(messagesCount.rows[0].count),
                activeConversations: parseInt(activeConversations.rows[0].count),
                activeConversationsRaw: activeConversations.rows[0].count, // Debug
                tenantId
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    // Alias for agent-portal dashboard compatibility
    getStatsSummary = async (req: Request, res: Response) => {
        return this.getStats(req, res);
    }

    getMetrics = async (req: Request, res: Response) => {
        try {
            const tenantId = req.headers['x-tenant-id'] as string;
            if (!tenantId) {
                return res.status(400).json({ error: 'Tenant ID is required' });
            }

            const { from, to, metric, interval } = req.query;

            // Stub implementation for now
            res.json({
                metric,
                interval,
                from,
                to,
                data: []
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async healthCheck(req: Request, res: Response) {
        try {
            // DB check
            const dbStart = Date.now();
            await pool.query('SELECT 1');
            const dbLatency = Date.now() - dbStart;

            // Redis check
            let redisStatus = 'error';
            let redisLatency = 0;
            try {
                const redisStart = Date.now();
                await redisClient.ping();
                redisLatency = Date.now() - redisStart;
                redisStatus = 'ok';
            } catch { }

            // RabbitMQ check
            let rabbitStatus = 'error';
            let queueDepth = -1;
            try {
                if (rabbitmqService.isConnected()) {
                    rabbitStatus = 'ok';
                    queueDepth = await rabbitmqService.getQueueDepth(
                        process.env.INBOUND_QUEUE || 'inboundQueue'
                    );
                }
            } catch { }

            const status = (redisStatus === 'ok' && rabbitStatus === 'ok')
                ? 'healthy'
                : 'degraded';

            res.json({
                status,
                timestamp: new Date().toISOString(),
                checks: {
                    database: { status: 'ok', latency_ms: dbLatency },
                    redis: { status: redisStatus, latency_ms: redisLatency },
                    rabbitmq: { status: rabbitStatus, queue_depth: queueDepth }
                },
                uptime_seconds: process.uptime()
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
