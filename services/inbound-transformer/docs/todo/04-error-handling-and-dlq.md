# Task 04 — Error Handling, DLQ, and Retry Strategy

**Priority**: HIGH
**Depends on**: Task 01 (01-A queue fix must be in place so real messages flow)
**Blocks**: stable production operation

---

## 04-A: Configure Dead Letter Queue

**Gap ref**: G10

**Problem**: Any invalid or permanently-failing message is nacked with `requeue: true` and cycles back to the front of the queue indefinitely, blocking all subsequent messages.

**Required changes**:

1. **Create DLQ in `src/config/rabbitmq.ts`**:
```typescript
dlq: {
    exchange: 'inbound-transformer-dlx',
    queue: 'inbound-transformer-dead',
    options: { durable: true }
}
```

2. **Update queue assertion in `src/consumers/inboundConsumer.ts`**:
```typescript
// Assert DLX exchange
await channel.assertExchange(rabbitConfig.dlq.exchange, 'direct', { durable: true });
// Assert DLQ
await channel.assertQueue(rabbitConfig.dlq.queue, rabbitConfig.dlq.options);
await channel.bindQueue(rabbitConfig.dlq.queue, rabbitConfig.dlq.exchange, '');

// Assert main queue with dead-letter routing
await channel.assertQueue(rabbitConfig.queues.inbound.name, {
    durable: true,
    arguments: {
        'x-dead-letter-exchange': rabbitConfig.dlq.exchange
    }
});
```

3. **On max retries exceeded**, nack with `requeue: false` instead of `true` — the DLX will route the message to the DLQ automatically.

**Acceptance criteria**:
- A message that fails 3 times appears in `inbound-transformer-dead` queue in the RabbitMQ management UI.
- Valid messages behind it continue to be processed.

---

## 04-B: Exponential Backoff with Retry Counter

**Gap ref**: G11

**Problem**: On failure the consumer waits a fixed 5 000 ms before requeueing. There is no retry counter and no backoff progression.

**Approach**: Use message `headers` to track retry count.

**Implementation outline in `src/consumers/inboundConsumer.ts`**:

```typescript
const MAX_RETRIES = 3;

function getRetryCount(msg: ConsumeMessage): number {
    return (msg.properties.headers?.['x-retry-count'] as number) || 0;
}

// On error:
const retryCount = getRetryCount(msg);
if (retryCount >= MAX_RETRIES) {
    // Exhausted — send to DLQ
    channel.nack(msg, false, false);
} else {
    const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
    setTimeout(() => {
        // Re-publish with incremented counter
        channel.publish('', rabbitConfig.queues.inbound.name,
            msg.content,
            {
                persistent: true,
                headers: { 'x-retry-count': retryCount + 1 }
            }
        );
        channel.ack(msg); // ack original
    }, delay);
}
```

**Acceptance criteria**:
- Transient errors (e.g. state-manager temporarily down) are retried with increasing delays.
- Messages failing all 3 retries go to DLQ, not back to the main queue.

---

## 04-C: Custom Error Classes

**Gap ref**: G12 (logging context), G9

Create `src/errors/TransformerError.ts`:

```typescript
export class TransformerError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly messageId?: string,
        public readonly tenantId?: string
    ) {
        super(message);
        this.name = 'TransformerError';
    }
}

export class ValidationError extends TransformerError {
    constructor(message: string, messageId?: string) {
        super(message, 'VALIDATION_ERROR', messageId);
        this.name = 'ValidationError';
    }
}

export class DownstreamError extends TransformerError {
    constructor(message: string, code: string, messageId?: string, tenantId?: string) {
        super(message, code, messageId, tenantId);
        this.name = 'DownstreamError';
    }
}
```

**Usage**:
- `ValidationError` → ack + log, do not retry (bad message structure)
- `DownstreamError` → nack with retry (transient network failures)
- Other errors → nack with retry

---

## 04-D: Global Error Handler Middleware

**Gap ref**: G12

Create `src/middleware/errorHandler.ts` for the Express app:

```typescript
import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
    console.error(`[ERROR] ${err.name}: ${err.message}`);
    res.status(500).json({
        error: {
            message: err.message,
            code: (err as any).code || 'INTERNAL_ERROR'
        }
    });
}
```

Register in `src/index.ts` after all routes.

---

## 04-E: Handle Axios Errors from Downstream Services

**Gap ref**: covers stateService.ts and genesysService.ts

Both services throw raw Axios errors. Wrap axios calls to extract meaningful error messages:

```typescript
try {
    const response = await axios.post(...);
    return response.data;
} catch (error: any) {
    const status = error.response?.status;
    const message = error.response?.data?.error || error.message;
    throw new DownstreamError(
        `Service call failed [${status}]: ${message}`,
        'DOWNSTREAM_ERROR',
        messageId,
        tenantId
    );
}
```

Apply in: `src/services/stateService.ts`, `src/services/genesysService.ts`.
