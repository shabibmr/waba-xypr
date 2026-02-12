# 05 — Security & Config

**Priority**: P6  
**Dependencies**: All previous tasks  
**Estimated Effort**: 2-3 hours

---

## Tasks

### 1. API Key Authentication

Create `src/middleware/auth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export function verifyApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.STATE_MANAGER_API_KEY;

  if (!expectedKey) {
    logger.warn('API_KEY not configured, skipping auth');
    return next();
  }

  if (apiKey !== expectedKey) {
    logger.warn('Invalid API key', { ip: req.ip });
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}
```

Apply in `src/index.ts`:
```typescript
import { verifyApiKey } from './middleware/auth';

app.use('/state', verifyApiKey, routes);
```

### 2. Validation Utilities

Create `src/utils/validation.ts`:

```typescript
import logger from './logger';

const ALLOWED_MEDIA_DOMAINS = [
  'minio.internal.company.com',
  's3.amazonaws.com'
];

export function validateE164(phone: string): boolean {
  const e164Pattern = /^\+?[1-9]\d{1,14}$/;
  return e164Pattern.test(phone);
}

export function validateMediaUrl(url: string | null | undefined): boolean {
  if (!url) return true;

  try {
    const parsed = new URL(url);
    
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      logger.warn('Invalid media URL scheme', { scheme: parsed.protocol });
      return false;
    }

    const valid = ALLOWED_MEDIA_DOMAINS.some(domain => 
      parsed.hostname.endsWith(domain)
    );

    if (!valid) {
      logger.warn('Media URL from untrusted domain', { hostname: parsed.hostname });
    }

    return valid;
  } catch {
    return false;
  }
}
```

Use in operation handlers.

### 3. Environment Config

Update `.env.example`:

```bash
# State Manager Config
PORT=3005
NODE_ENV=development
LOG_LEVEL=INFO

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=waba_mvp
DB_USER=postgres
DB_PASSWORD=postgres
DB_MAX_CONNECTIONS=50
DB_QUERY_TIMEOUT=30000

# Redis
REDIS_URL=redis://localhost:6379
REDIS_CONNECT_TIMEOUT=1000

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_HEARTBEAT=60
RABBITMQ_PREFETCH_COUNT=100

# Queues
INBOUND_QUEUE=inboundQueue
OUTBOUND_QUEUE=outboundQueue
STATUS_QUEUE=statusQueue
INBOUND_PROCESSED_QUEUE=inbound-processed
OUTBOUND_PROCESSED_QUEUE=outbound-processed
DLQ_NAME=state-manager-dlq

# Locking & Expiry
LOCK_TTL_SECONDS=5
LOCK_RETRY_COUNT=3
CONVERSATION_TTL_HOURS=24
EXPIRY_JOB_INTERVAL_MINUTES=5

# Security
STATE_MANAGER_API_KEY=your-secret-key-here
```

---

## Summary

All 5 task files created:
1. ✅ **01-foundation-database-types.md**
2. ✅ **02-infrastructure-rabbitmq-redis.md**  
3. ✅ **03-core-operations.md**
4. ✅ **04-api-lifecycle.md**
5. ✅ **05-security-config.md**

Execute in order for dependency resolution.
