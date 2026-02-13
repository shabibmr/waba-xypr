# Phase 11: Configuration & Environment Cleanup

**Priority:** Medium | **Depends on:** All feature phases (consolidation)
**FRD Refs:** Section 9.2

---

## Gap Summary

Several config values are missing, hardcoded, or have incorrect defaults. `.env.example` is incomplete. Some env vars referenced in code don't exist in example. The FRD lists ~30 environment variables; the current service has ~6.

---

## Current State

**.env.example has:**
- `PORT`, `NODE_ENV`, `RABBITMQ_URL`, `STATE_SERVICE_URL`, `META_ACCESS_TOKEN`, `META_APP_SECRET`

**Missing from .env.example but referenced in code:**
- `TENANT_SERVICE_URL`
- `WHATSAPP_API_URL`

**Missing entirely (FRD required):**
- Redis: `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `REDIS_PASSWORD`
- Queues: `QUEUE_INPUT`, `QUEUE_OUTPUT`, `QUEUE_DLQ`
- Storage: `STORAGE_TYPE`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `SIGNED_URL_EXPIRATION_SECONDS`
- Behavior: `UNSUPPORTED_MIME_BEHAVIOR`, `AUDIO_TEXT_BEHAVIOR`, `VALIDATE_URL_ACCESSIBILITY`, `ENFORCE_SESSION_WINDOW`
- Performance: `MAX_RETRIES`, `RABBITMQ_PREFETCH_COUNT`
- Pipeline: `PIPELINE_MODE_ENABLED`, `WHATSAPP_API_BASE_URL`
- Observability: `LOG_LEVEL`, `METRICS_PORT`, `HEALTH_CHECK_PORT`, `SERVICE_VERSION`
- Alerts: `ALERT_ON_DLQ`

**Hardcoded values that should be configurable:**
- `prefetch: 1` in config (should be 10 default, from env)
- Meta API version `v18.0` (should be env-configurable)

---

## Tasks

### T11.1 - Update src/config/index.ts
- Add all missing config sections:
  ```typescript
  export default {
    port: parseInt(process.env.PORT || '3003'),
    nodeEnv: process.env.NODE_ENV || 'development',
    serviceVersion: process.env.SERVICE_VERSION || '1.0.0',

    rabbitmq: {
      url: process.env.RABBITMQ_URL || 'amqp://localhost',
      inputQueue: process.env.QUEUE_INPUT || QUEUES.OUTBOUND_PROCESSED,
      outputQueue: process.env.QUEUE_OUTPUT || 'outbound-ready',
      dlqQueue: process.env.QUEUE_DLQ || 'outbound-transformer-dlq',
      prefetch: parseInt(process.env.RABBITMQ_PREFETCH_COUNT || '10'),
    },

    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
    },

    storage: {
      type: process.env.STORAGE_TYPE || 'minio',
      endpoint: process.env.STORAGE_ENDPOINT || '',
      accessKey: process.env.STORAGE_ACCESS_KEY || '',
      secretKey: process.env.STORAGE_SECRET_KEY || '',
      signedUrlExpiration: parseInt(process.env.SIGNED_URL_EXPIRATION_SECONDS || '600'),
      internalDomain: process.env.INTERNAL_STORAGE_DOMAIN || 'minio.internal',
    },

    services: {
      stateManager: process.env.STATE_SERVICE_URL || SERVICES.STATE_MANAGER.url,
      tenantService: process.env.TENANT_SERVICE_URL || SERVICES.TENANT_SERVICE.url,
      whatsappService: process.env.WHATSAPP_API_URL || SERVICES.WHATSAPP_API.url,
    },

    behavior: {
      unsupportedMime: process.env.UNSUPPORTED_MIME_BEHAVIOR || 'reject',
      audioText: process.env.AUDIO_TEXT_BEHAVIOR || 'separate_message',
      validateUrlAccessibility: process.env.VALIDATE_URL_ACCESSIBILITY === 'true',
      enforceSessionWindow: process.env.ENFORCE_SESSION_WINDOW === 'true',
    },

    pipeline: {
      enabled: process.env.PIPELINE_MODE_ENABLED === 'true',
      whatsappApiBaseUrl: process.env.WHATSAPP_API_BASE_URL || SERVICES.WHATSAPP_API.url,
    },

    performance: {
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    },

    observability: {
      logLevel: process.env.LOG_LEVEL || 'info',
      metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
    },

    idempotency: {
      ttlSeconds: parseInt(process.env.IDEMPOTENCY_TTL_SECONDS || '86400'),
    },

    alerts: {
      onDlq: process.env.ALERT_ON_DLQ === 'true',
    },
  };
  ```

### T11.2 - Update .env.example
- Include all env vars with documented defaults and descriptions:
  ```bash
  # Service
  PORT=3003
  NODE_ENV=development
  SERVICE_VERSION=1.0.0

  # RabbitMQ
  RABBITMQ_URL=amqp://guest:guest@localhost:5672
  RABBITMQ_PREFETCH_COUNT=10
  QUEUE_INPUT=outbound-processed
  QUEUE_OUTPUT=outbound-ready
  QUEUE_DLQ=outbound-transformer-dlq

  # Redis
  REDIS_HOST=localhost
  REDIS_PORT=6379
  REDIS_DB=0
  REDIS_PASSWORD=
  IDEMPOTENCY_TTL_SECONDS=86400

  # Storage (MinIO/S3)
  STORAGE_TYPE=minio
  STORAGE_ENDPOINT=http://localhost:9000
  STORAGE_ACCESS_KEY=minioadmin
  STORAGE_SECRET_KEY=minioadmin
  SIGNED_URL_EXPIRATION_SECONDS=600
  INTERNAL_STORAGE_DOMAIN=minio.internal

  # Internal Services
  STATE_SERVICE_URL=http://state-manager:3005
  TENANT_SERVICE_URL=http://tenant-service:3007
  WHATSAPP_API_URL=http://whatsapp-api-service:3008

  # Pipeline Mode (HTTP dispatch instead of queue)
  PIPELINE_MODE_ENABLED=false
  WHATSAPP_API_BASE_URL=http://whatsapp-api-service:3008

  # Behavior
  UNSUPPORTED_MIME_BEHAVIOR=reject
  AUDIO_TEXT_BEHAVIOR=separate_message
  VALIDATE_URL_ACCESSIBILITY=false

  # Performance
  MAX_RETRIES=3

  # Observability
  LOG_LEVEL=info
  METRICS_PORT=9090

  # Alerts
  ALERT_ON_DLQ=false
  ```

### T11.3 - Remove Unused Config
- Remove `meta.apiVersion` and `meta.appSecret` from config
  - Outbound transformer doesn't call Meta API directly
  - Access tokens are managed by downstream whatsapp-api-service

### T11.4 - Clean Up .env File
- Remove real `META_ACCESS_TOKEN` from `.env` (security risk if committed)
- Ensure `.env` is in `.gitignore`

---

## Acceptance Criteria

- [ ] All FRD-specified env vars present in config and `.env.example`
- [ ] Hardcoded values replaced with env-configurable defaults
- [ ] No secrets in `.env` committed to git
- [ ] Config uses shared constants for service URLs as fallbacks
- [ ] Unused config (meta.apiVersion, meta.appSecret) removed
