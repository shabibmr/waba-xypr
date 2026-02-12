import pool from '../config/database';
import redisClient from '../config/redis';
import logger from '../utils/logger';

const KEYS = require('../../../../shared/constants/keys');

export async function runExpiryJob(): Promise<void> {
  const startTime = Date.now();
  const ttlHours = parseInt(process.env.CONVERSATION_TTL_HOURS || '24');

  logger.info('Starting expiry job', { operation: 'expiry_job', ttl_hours: ttlHours });

  try {
    const result = await pool.query(
      `SELECT id, wa_id, conversation_id
       FROM conversation_mappings
       WHERE status = 'active'
         AND last_activity_at < NOW() - ($1 * INTERVAL '1 hour')
       LIMIT 1000`,
      [ttlHours]
    );

    const expired = result.rows;

    if (expired.length === 0) {
      logger.info('No conversations to expire');
      return;
    }

    const ids = expired.map((m: any) => m.id);
    await pool.query(
      `UPDATE conversation_mappings
       SET status = 'expired', updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1::uuid[])`,
      [ids]
    );

    for (const mapping of expired) {
      await redisClient.del(KEYS.mappingWa(mapping.wa_id));
      if (mapping.conversation_id) {
        await redisClient.del(KEYS.mappingConv(mapping.conversation_id));
      }
    }

    logger.info('Expiry job completed', {
      operation: 'expiry_job',
      expired_count: expired.length,
      duration_ms: Date.now() - startTime
    });

  } catch (error: any) {
    logger.error('Expiry job failed', {
      operation: 'expiry_job',
      error: error.message
    });
  }
}

export function startExpiryJob(): void {
  const intervalMinutes = parseInt(process.env.EXPIRY_JOB_INTERVAL_MINUTES || '5');
  const intervalMs = intervalMinutes * 60 * 1000;

  setInterval(runExpiryJob, intervalMs);
  logger.info('Expiry job scheduled', { interval_minutes: intervalMinutes });
}
