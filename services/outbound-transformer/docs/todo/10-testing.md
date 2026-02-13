# Phase 10: Test Suite

**Priority:** High | **Depends on:** All previous phases (tests should cover implemented features)
**FRD Refs:** Section 9.3

---

## Gap Summary

The existing test suite is **non-functional**:
1. Tests don't import or test actual source code
2. `jest.config.js` matches `.test.js` but source is TypeScript -- no `ts-jest` configured
3. Test setup has wrong env vars (`PORT=3008`, wrong service URLs, wrong env key names)
4. Unit tests only validate fixture data structure
5. API tests create inline mock Express apps instead of testing the real app
6. 80% coverage threshold configured but actual coverage is 0%

---

## Current State

| Issue | Detail |
|-------|--------|
| `tests/unit/services/transformer.test.js` | Tests fixture shape, never imports `transformer.service.ts` |
| `tests/api/transform.api.test.js` | Creates inline Express app, never imports real routes |
| `tests/setup.js` | `PORT=3008` (wrong, should be 3003), `STATE_MANAGER_URL` (wrong key name) |
| `jest.config.js` | No `ts-jest` transform, matches `.test.js` only |
| Coverage | 0% on all source files |

## Expected State (FRD Section 9.3)

10 specific test cases + comprehensive unit and integration tests:
1. Text message transformation
2. Image with caption
3. Document without filename (auto-generated)
4. Audio + text → two separate messages
5. Unsupported MIME type rejection
6. Internal URL → signed URL generation
7. Private IP URL rejection
8. Idempotency duplicate detection
9. Max retries → DLQ routing
10. Text exceeds max length
11. Empty message (no text or media) rejection

---

## Tasks

### T10.1 - Fix Jest Configuration for TypeScript
- Option A: Install `ts-jest` and configure transform
  ```
  npm install -D ts-jest
  ```
  Update `jest.config.js`:
  ```javascript
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  testMatch: ['**/tests/**/*.test.ts'],
  ```
- Option B: Use `@swc/jest` for faster test execution
- Rename existing `.test.js` files to `.test.ts` or create new `.test.ts` files

### T10.2 - Fix Test Setup
- Update `tests/setup.ts`:
  - `PORT=3003`
  - `STATE_SERVICE_URL` (correct key name)
  - `WHATSAPP_API_URL=http://localhost:3008` (correct port)
  - Add `REDIS_HOST`, `REDIS_PORT`
  - Add `UNSUPPORTED_MIME_BEHAVIOR`, `AUDIO_TEXT_BEHAVIOR`

### T10.3 - Create Test Fixtures for New Schema
- Update `tests/fixtures/messages.ts`:
  - Valid `InputMessage` fixture matching FRD Section 3.1
  - Text-only message
  - Image + caption message
  - Video message
  - Document message (with and without filename)
  - Audio + text message
  - Invalid messages (missing fields, bad UUID, etc.)

### T10.4 - Write Validator Unit Tests
- `tests/unit/services/validator.test.ts`
- Test cases:
  - Valid complete message → passes
  - Missing each required field individually → specific error
  - Invalid UUID format → error
  - Invalid waId format → error
  - Invalid phoneNumberId → error
  - Timestamp out of range → error
  - Type !== 'message' → error
  - Empty payload → error
  - Text too long (>4096) → error
  - Text empty after trim → error
  - Media missing url → error
  - Media missing mime_type → error

### T10.5 - Write Transformer Unit Tests
- `tests/unit/services/transformer.test.ts`
- Test cases from FRD:
  1. **Text message:** input with `payload.text` → output with `metadata` + `wabaPayload.text`
  2. **Image with caption:** input with `payload.media` (image/jpeg) + `payload.text` → `wabaPayload.image` with caption
  3. **Document without filename:** input with PDF media, no filename → auto-extracted from URL
  4. **Audio + text (separate_message mode):** → returns array of 2 messages
  5. **Audio + text (discard_text mode):** → returns audio only
  6. **Caption truncation:** 2000-char text on image → truncated to 1024
  7. **Unsupported MIME (reject):** → throws error
  8. **Unsupported MIME (convert_to_document):** → maps to document type
  9. **Text trimming:** leading/trailing whitespace removed
  10. **MIME type mapping:** verify all 19 MIME types map correctly

### T10.6 - Write MIME Type Mapping Tests
- `tests/unit/config/mime-types.test.ts`
- Test all 19 MIME types from FRD Appendix A
- Test case-insensitive matching
- Test unsupported type returns null

### T10.7 - Write URL Validation Tests
- `tests/unit/utils/url.test.ts`
- Test cases:
  - Valid HTTPS URL → passes
  - HTTP URL → rejected
  - No scheme → rejected
  - Private IP (10.x, 172.16.x, 192.168.x, 127.x) → rejected
  - Localhost → rejected
  - Internal storage URL detected
  - URL > 2048 chars → rejected
  - Malformed URL → rejected

### T10.8 - Write Idempotency Tests
- `tests/unit/services/idempotency.test.ts`
- Mock Redis
- Test cases:
  - New message → not duplicate, marked as processing
  - Same internalId again → duplicate detected, returns true
  - Redis unavailable → returns false (process anyway), logs error
  - Mark completed → updates Redis value

### T10.9 - Write DLQ Routing Tests
- `tests/unit/services/dlq.test.ts`
- Test cases:
  - After max retries → message sent to DLQ with correct format
  - DLQ message contains original message, error details, metadata
  - Non-retryable error → immediate DLQ (skip retries)
  - DLQ publish failure → logged (doesn't throw)

### T10.10 - Write Integration Tests
- `tests/integration/pipeline.test.ts`
- Test full flow: consume from queue → validate → transform → dispatch
- Mock external dependencies (Redis, RabbitMQ, downstream service)
- Test happy path (text and media)
- Test error paths (invalid message, duplicate, transform failure)

### T10.11 - Remove/Rewrite Broken Tests
- Delete or completely rewrite:
  - `tests/unit/services/transformer.test.js` (doesn't test real code)
  - `tests/api/transform.api.test.js` (doesn't test real app)

---

## Acceptance Criteria

- [ ] Jest configured for TypeScript (ts-jest or swc)
- [ ] Test setup uses correct env vars
- [ ] All 10 FRD test cases covered
- [ ] Validator unit tests: 12+ test cases
- [ ] Transformer unit tests: 10+ test cases
- [ ] URL validation tests: 8+ test cases
- [ ] Idempotency tests: 4+ test cases
- [ ] DLQ tests: 4+ test cases
- [ ] Coverage threshold met (80% branches/functions/lines)
- [ ] All tests pass with `npm test`
