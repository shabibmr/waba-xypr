# Phase 12: Cleanup & Miscellaneous

**Priority:** Low | **Depends on:** All other phases
**FRD Refs:** Various

---

## Gap Summary

Loose ends, dead code, unused utilities, security concerns, and minor FRD deviations.

---

## Tasks

### T12.1 - Remove Unused Code
- **`src/utils/signature.util.ts`**: `generateSignature()` is never imported anywhere. Remove unless planned for future use.
- **`src/services/tenant.service.ts`**: `getTenantWhatsAppCredentials()` is commented out in message-processor. Either integrate properly or remove.
- **`sendTemplateMessage()` in whatsapp.service.ts**: Throws "Deprecated". Remove dead function.
- **`src/controllers/transform.controller.ts`**: Labelled "for testing" -- decide if this HTTP endpoint stays in production or is development-only.

### T12.2 - Remove/Update Template Handling
- **`src/controllers/template.controller.ts`** and **`src/routes/template.routes.ts`**: Template sending is a separate feature not in the outbound transformer FRD. Options:
  - Keep as a separate feature outside FRD scope (document this)
  - Move to a separate service
  - Remove if whatsapp-api-service handles templates directly
- **`src/utils/template.util.ts`**: `extractTemplateComponents()` and `containsUrl()` -- only used by template detection in transformer. If template detection removed from transformer, these may be orphaned.

### T12.3 - Fix @ts-ignore Comments
- Multiple files have `// @ts-ignore` before imports. Fix the underlying type issues:
  - Shared constants are CommonJS (`module.exports`), TypeScript needs declaration files or `esModuleInterop`
  - Create type declarations for shared modules: `src/types/shared.d.ts`
  - Or configure `tsconfig.json` with `allowJs: true` + `esModuleInterop: true`

### T12.4 - Update Shared Constants
- Add to `shared/constants/queues.js`:
  ```javascript
  OUTBOUND_PROCESSED: 'outbound-processed',
  OUTBOUND_READY: 'outbound-ready',
  OUTBOUND_TRANSFORMER_DLQ: 'outbound-transformer-dlq',
  ```
- Add to `shared/constants/keys.js`:
  ```javascript
  idempotencyOutbound: (internalId) => `idempotency:outbound:${internalId}`,
  TTL: { ...existing, IDEMPOTENCY: 86400 }
  ```

### T12.5 - Security: Remove Secrets from .env
- `.env` contains real `META_ACCESS_TOKEN`. Even though `.env` shouldn't be committed, verify `.gitignore` includes it.
- `META_APP_SECRET` is a placeholder but still shouldn't be in tracked files.

### T12.6 - Update Dockerfile
- Health check in Dockerfile uses `wget`. Consider if this is sufficient or should use the enhanced health endpoint.
- Ensure Dockerfile copies any new config files (e.g., `mime-types.ts`).

### T12.7 - Update package.json
- Add new dependencies accumulated from all phases:
  - `ioredis` (Phase 4)
  - `pino` or `winston` (Phase 7)
  - `prom-client` (Phase 9)
  - `minio` or `@aws-sdk/client-s3` (Phase 5)
- Add/update scripts:
  - `"start": "node dist/index.js"`
  - `"dev": "nodemon --exec ts-node src/index.ts"`
  - `"build": "tsc"`
  - `"test": "jest --coverage"`
  - `"lint": "eslint src/"`

### T12.8 - Graceful Shutdown
- Handle `SIGTERM` and `SIGINT`:
  - Stop consuming from RabbitMQ (cancel consumer)
  - Wait for in-flight messages to complete (drain)
  - Close RabbitMQ connection
  - Close Redis connection
  - Close storage client
  - Exit process

---

## Acceptance Criteria

- [ ] No unused code remaining
- [ ] No `@ts-ignore` comments (proper type declarations)
- [ ] Shared constants updated with new queue and key patterns
- [ ] No secrets in tracked files
- [ ] Graceful shutdown implemented
- [ ] All new dependencies in package.json
