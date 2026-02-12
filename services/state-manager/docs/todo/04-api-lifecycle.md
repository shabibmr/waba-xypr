# 04 — API Enhancements & Lifecycle

**Priority**: P3-P4  
**Dependencies**: 01-foundation, 02-infrastructure, 03-core-operations  
**Estimated Effort**: 4-6 hours

---

## Tasks

### 1. Add Conversation Correlation Endpoint

Create `POST /state/correlation` for Operation 5:

```typescript
// src/controllers/mappingController.ts (add method)

async correlateConversation(req: Request, res: Response) {
  try {
    const { conversation_id, communication_id, whatsapp_message_id } = req.body;
    
    const mapping = await mappingService.correlateConversation({
      conversation_id,
      communication_id,
      whatsapp_message_id
    });

    if (!mapping) {
      return res.status(409).json({ 
        error: 'Conversation already correlated or message not found' 
      });
    }

    res.json({ success: true, mapping });
  } catch (error: any) {
    logger.error('Correlation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
}
```

Add route in `src/routes/index.ts`:
```typescript
router.post('/correlation', mappingController.correlateConversation);
```

### 2. Enhance Health Check

Update `src/controllers/statsController.ts`:

```typescript
async healthCheck(req: Request, res: Response) {
  const startTime = Date.now();
  
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
    } catch {}

    // RabbitMQ check
    let rabbitStatus = 'error';
    let queueDepth = -1;
    try {
      if (rabbitmqService.isConnected()) {
        rabbitStatus = 'ok';
        queueDepth = await rabbitmqService.getQueueDepth('inboundQueue');
      }
    } catch {}

    const status = (dbStart && redisStatus === 'ok' && rabbitStatus === 'ok') 
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
```

### 3. Implement Expiry Cron

Create `src/cron/expiry.ts`:

```typescript
import pool from '../config/database';
import redisClient from '../config/redis';
import logger from '../utils/logger';

const { KEYS } = require('../../../../shared/constants');

export async function runExpiryJob(): Promise<void> {
  const startTime = Date.now();
  const ttlHours = parseInt(process.env.CONVERSATION_TTL_HOURS || '24');
  
  logger.info('Starting expiry job', { operation: 'expiry_job', ttl_hours: ttlHours });

  try {
    // Find expired conversations (batch)
    const result = await pool.query(
      `SELECT id, wa_id, conversation_id 
       FROM conversation_mappings
       WHERE status = 'active'
         AND last_activity_at < NOW() - INTERVAL '${ttlHours} hours'
       LIMIT 1000`
    );

    const expired = result.rows;

    if (expired.length === 0) {
      logger.info('No conversations to expire');
      return;
    }

    // Update status to expired
    const ids = expired.map(m => m.id);
    await pool.query(
      `UPDATE conversation_mappings
       SET status = 'expired', updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1::uuid[])`,
      [ids]
    );

    // Clear cache
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

// Start cron
export function startExpiryJob(): void {
  const intervalMinutes = parseInt(process.env.EXPIRY_JOB_INTERVAL_MINUTES || '5');
  const intervalMs = intervalMinutes * 60 * 1000;

  setInterval(runExpiryJob, intervalMs);
  logger.info('✓ Expiry job scheduled', { interval_minutes: intervalMinutes });
}
```

Wire in `src/index.ts`:
```typescript
import { startExpiryJob } from './cron/expiry';

// After RabbitMQ init
startExpiryJob();
```

---

## Verification

**Test correlation**:
```bash
curl -X POST http://localhost:3005/state/correlation \
  -H "Content-Type: application/json" \
  -d '{"conversation_id":"abc-123","communication_id":"comm-456","whatsapp_message_id":"wamid.test"}'
```

**Test expiry**:
```sql
-- Force old activity
UPDATE conversation_mappings SET last_activity_at = NOW() - INTERVAL '25 hours';
```

Wait 5 minutes, check logs for expiry job execution.
