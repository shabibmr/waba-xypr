# Task 07 — Health Check Improvements

**Priority**: LOW
**Depends on**: Task 01
**Blocks**: nothing

---

## 07-A: Fix Status Field When RabbitMQ Disconnected

**Gap ref**: G16

**Current**: Returns `{ status: 'healthy', rabbitmq: 'disconnected' }` even when RabbitMQ is disconnected. This means the service appears healthy to load balancers and orchestrators when it cannot actually process messages.

**Required**: Return HTTP 503 when RabbitMQ is disconnected:

```typescript
export function healthCheck(req: Request, res: Response): void {
    const channel = getChannel();
    const isHealthy = !!channel;

    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'degraded',
        service: 'inbound-transformer',
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        rabbitmq: channel ? 'connected' : 'disconnected'
    });
}
```

**Acceptance criteria**:
- `GET /health` returns HTTP 200 when consumer is running.
- `GET /health` returns HTTP 503 when RabbitMQ is disconnected (verifiable by stopping RabbitMQ container).

---

## 07-B: Add Service Metadata to Health Response

Add the following fields to the health response for observability:

| Field | Value |
|-------|-------|
| `service` | `"inbound-transformer"` |
| `version` | `process.env.npm_package_version` |
| `uptime` | `process.uptime()` seconds |
| `queue` | queue name being consumed |

No external HTTP calls needed — just expose internal state.
