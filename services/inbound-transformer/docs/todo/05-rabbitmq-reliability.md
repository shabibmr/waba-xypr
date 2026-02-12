# Task 05 — RabbitMQ Consumer Reliability

**Priority**: MEDIUM
**Depends on**: Task 04-A (DLQ must exist before improving recovery logic)
**Blocks**: production stability

---

## 05-A: Add Connection-Level Event Handlers

**Gap ref**: G13

**Problem**: `startConsumer()` catches errors on initial connection only. Once connected, if RabbitMQ drops the connection (restart, network blip), the consumer stops silently with no reconnection attempt.

**Current code** (`src/consumers/inboundConsumer.ts`):
```typescript
} catch (error) {
    console.error('RabbitMQ consumer error:', error);
    setTimeout(startConsumer, rabbitConfig.connection.reconnectDelay);
}
```

This `catch` only fires if `amqp.connect()` itself throws (initial connection). It does not fire for mid-session drops.

**Required addition**:
```typescript
const connection: any = await amqp.connect(rabbitConfig.url);

connection.on('close', () => {
    console.error('RabbitMQ connection closed — reconnecting...');
    channel = null;
    setTimeout(startConsumer, rabbitConfig.connection.reconnectDelay);
});

connection.on('error', (err: Error) => {
    console.error('RabbitMQ connection error:', err.message);
    // 'close' event will follow; reconnect is handled there
});
```

**Acceptance criteria**:
- Restart the RabbitMQ container while the inbound-transformer is running.
- The transformer reconnects automatically and resumes consuming.

---

## 05-B: Channel-Level Error Recovery

**Problem**: If the RabbitMQ channel is closed (e.g. due to a nack on a non-existent queue or protocol error), `channel` becomes unusable but `connection` may still be alive. Subsequent `channel.ack()` / `channel.nack()` calls will throw silently.

**Required**: Add a `channel.on('close')` handler that re-creates the channel without tearing down the connection:
```typescript
channel.on('close', () => {
    console.warn('RabbitMQ channel closed — re-establishing...');
    channel = null;
    // Re-assert queues and restart consumer on existing connection
});
```

Alternatively, treat channel close the same as connection close (call `startConsumer` again). Keep it simple — just reconnect the full flow.

---

## 05-C: Graceful Shutdown

**Problem**: When the process receives SIGTERM (Docker stop, Kubernetes pod eviction), in-flight messages may be lost.

**Required**: Register shutdown hooks in `src/index.ts`:
```typescript
async function shutdown() {
    console.log('Shutting down gracefully...');
    if (channel) {
        await channel.close();
    }
    if (connection) {
        await connection.close();
    }
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

**Acceptance criteria**:
- `docker stop` of the container does not cause unacknowledged message loss.
- In-flight messages (currently being processed) are completed or nacked before the process exits.

---

## 05-D: Prefetch Tuning

**Current**: `prefetch: 1` (processes one message at a time).

This is safe but low-throughput. Once the service is stable, consider increasing to 5–10 and measuring latency. Keep as `1` for MVP until the other fixes are in place.

No code change required now — document as a future tuning item.
