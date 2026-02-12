# State Manager — Implementation Roadmap

## Created Task Lists (Dependency Order)

1. **[01-foundation-database-types.md](./01-foundation-database-types.md)** — P0 Blocking
   - Fix DB schema (UUID PKs, partial unique index, FK relationships)
   - Create type definitions (`types/index.ts`)
   - Add structured logger

2. **[02-infrastructure-rabbitmq-redis.md](./02-infrastructure-rabbitmq-redis.md)** — P0-P1
   - Implement RabbitMQ service (missing file)
   - Enhance Redis with graceful degradation
   - Implement distributed locking

3. **[03-core-operations.md](./03-core-operations.md)** — P1 Critical
   - Update `mappingService` (correlation, idempotent creates)
   - Update `messageService` (state machine validation)
   - Wire RabbitMQ consumers to business logic

4. **[04-api-lifecycle.md](./04-api-lifecycle.md)** — P3-P4
   - Add conversation correlation endpoint
   - Enhance health check (RabbitMQ, latency)
   - Implement expiry cron job

5. **[05-security-config.md](./05-security-config.md)** — P6
   - API key authentication middleware
   - Media URL & phone validation
   - Environment configuration

## Execution Order

Execute strictly in numeric order (01 → 05) due to dependencies.

## Logging Strategy

All tasks include comprehensive logging using structured JSON logger:
- **DEBUG**: Lock acquisition, cache operations, state validation
- **INFO**: Operation completion, mapping/message creation, queue publishing
- **WARN**: Duplicate messages, stale updates, Redis failures
- **ERROR**: DLQ routing, DB errors, invalid transitions
- **CRITICAL**: RabbitMQ disconnect, max retries exceeded

## Estimated Total Effort

**26-35 hours** of focused development work.
