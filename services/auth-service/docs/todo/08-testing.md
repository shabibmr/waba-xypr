# Phase 08 — Testing

**Depends on:** 06-api-layer (must implement before writing tests)
**Blocks:** Nothing
**MVP Critical:** Partial (unit tests for core flows are MVP; integration and load tests are post-MVP)

---

## Gap Analysis

### Current State
- `tests/unit/services/tokenService.test.js` — 11 unit tests for basic cache hit/miss logic
- `tests/api/auth.api.test.js` — 9 API tests for old route paths (`GET /auth/token`, `POST /auth/refresh`, `GET /auth/info`)
- `tests/mocks/redis.mock.js` — basic in-memory Redis mock (no TTL simulation, no Lua script support)
- `tests/fixtures/auth.js` — fixture data for token and OAuth responses
- **All existing tests will break** after the refactor (old route paths and old service structure)
- No tests for: distributed locking, request collapsing, degraded mode, JWT validation, multi-region, error classes

### FRD Requirements (Section 10)
- Unit tests: token service cache hit/miss, OAuth retry, JWT validation, lock behavior, degraded mode
- Integration tests: full token flow with real Redis (testcontainers or local), mock Tenant Service (nock)
- Load tests: request collapsing under 100 concurrent requests
- Edge case tests: clock skew, token expiring during request, Redis failure mid-request

---

## Tasks

### TASK-08-01: Update Redis mock for new API
**Priority:** MVP
**File:** `tests/mocks/redis.mock.js` (update existing)

**Description:** Extend the existing mock to support `set()` with options object `{ NX, EX }`, `eval()` for Lua scripts, and TTL simulation.

```javascript
// tests/mocks/redis.mock.js (replace existing)
class RedisMock {
  constructor() {
    this._store = new Map();        // key → { value, expiresAt }
    this.isOpen = true;
  }

  async connect() { this.isOpen = true; }
  async quit()    { this.isOpen = false; }
  async ping()    { return 'PONG'; }

  async get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, options = {}) {
    // Support both old-style varargs and new options object
    const nx = options.NX;
    const ex = options.EX;

    if (nx && this._store.has(key)) {
      const entry = this._store.get(key);
      if (!entry.expiresAt || Date.now() <= entry.expiresAt) {
        return null;  // Key exists and not expired
      }
    }

    const expiresAt = ex ? Date.now() + ex * 1000 : null;
    this._store.set(key, { value, expiresAt });
    return 'OK';
  }

  async setEx(key, seconds, value) {
    const expiresAt = Date.now() + seconds * 1000;
    this._store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(key) {
    const existed = this._store.has(key);
    this._store.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key) {
    const entry = this._store.get(key);
    if (!entry) return 0;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return 0;
    }
    return 1;
  }

  // Simplified Lua eval — only supports the lock release script pattern
  async eval(script, options) {
    const { keys, arguments: args } = options;
    const key = keys[0];
    const expectedValue = args[0];
    const entry = this._store.get(key);
    if (entry && entry.value === expectedValue) {
      this._store.delete(key);
      return 1;
    }
    return 0;
  }

  async flushAll() {
    this._store.clear();
    return 'OK';
  }

  // Test helper: advance time by ms (adjust stored expiries)
  advanceTime(ms) {
    for (const [key, entry] of this._store) {
      if (entry.expiresAt) {
        entry.expiresAt -= ms;
        if (entry.expiresAt <= Date.now()) {
          this._store.delete(key);
        }
      }
    }
  }

  on() { return this; }   // Event emitter stub
}

module.exports = { RedisMock };
```

---

### TASK-08-02: Unit tests — token cache repository
**Priority:** MVP
**File:** `tests/unit/repositories/token-cache.repository.test.js`

Key test cases:
- `get()` returns `null` on cache miss
- `get()` returns cached token on hit
- `get()` returns `null` for expired token
- `set()` stores with correct TTL (expiresIn - 60s buffer)
- `set()` is a no-op when TTL <= 0 (short-lived token)
- `delete()` removes the key
- Redis error in `get()` → returns `null` (not throws)
- Redis key pattern is `auth:token:{provider}:{tenantId}`

---

### TASK-08-03: Unit tests — distributed lock repository
**Priority:** MVP
**File:** `tests/unit/repositories/lock.repository.test.js`

Key test cases:
- First `acquire()` returns `{ acquired: true }`
- Second `acquire()` for same key returns `{ acquired: false }` (NX behavior)
- `release()` with correct `lockValue` deletes the key
- `release()` with wrong `lockValue` does NOT delete the key
- Redis error in `acquire()` returns `{ acquired: false }` (graceful degradation)

---

### TASK-08-04: Unit tests — Genesys token service
**Priority:** MVP
**File:** `tests/unit/services/token/genesys-token.service.test.js`

Key test cases:
- Cache hit → returns immediately, no credential fetch
- Cache miss → acquires lock → fetches credentials → OAuth exchange → caches → returns
- `forceRefresh: true` → skips cache check
- Lock not acquired → waits for cache population → returns cached token
- Lock not acquired, cache not populated after wait → acquires lock on retry → fetches fresh
- Redis unhealthy → degraded mode → no lock, no cache, direct fetch
- Degraded mode rate limit exceeded → throws `CacheError`
- OAuth 401 → throws `OAuthError(OAUTH_INVALID_GRANT)` → lock released
- Lock is ALWAYS released in finally block (verify with mock assertion)
- Secret zeroization: `credentials.clientSecret` is `'\0...'` after `_fetchAndCache()`

---

### TASK-08-05: Unit tests — WhatsApp token service
**Priority:** MVP
**File:** `tests/unit/services/token/whatsapp-token.service.test.js`

Key test cases:
- Cache hit → returns immediately
- Cache miss → fetches credentials → caches → returns
- `expiresAt` present → uses actual expiry minus buffer for TTL
- No `expiresAt` → uses default 24h TTL
- TTL <= 0 → no cache write (token not cached), still returns
- Degraded mode → direct fetch, no cache

---

### TASK-08-06: Unit tests — JWT validator service
**Priority:** MVP
**File:** `tests/unit/services/jwt/jwt-validator.service.test.js`

Key test cases:
- Valid RS256 JWT → `{ isValid: true, userId, orgId, roles }`
- Expired JWT → `{ isValid: false, error: 'JWT has expired' }` (does not throw)
- Invalid signature → `{ isValid: false, error: 'JWT signature verification failed' }`
- Malformed JWT (not 3 parts) → `{ isValid: false, error: 'Invalid JWT format...' }`
- Missing `kid` in header → `{ isValid: false, error: 'Missing kid...' }`
- Missing `sub` claim → `{ isValid: false, error: 'Missing required claim: sub' }`
- JWKS fetch failure → throws `AuthServiceError(JWKS_FETCH_FAILED)` (propagated to 503)
- Clock skew ±30 seconds → valid (via `clockTolerance: 30` in `jwt.verify`)

**Test setup:** Use `jsonwebtoken` to generate test JWTs with RSA key pair in test setup. Mock `jwks-rsa` to return the test public key.

---

### TASK-08-07: Unit tests — credential fetcher service
**Priority:** MVP
**File:** `tests/unit/services/credentials/credential-fetcher.service.test.js`

Key test cases (use `nock` to mock Tenant Service HTTP):
- 200 → returns credentials object
- 404 → throws `AuthServiceError(CREDENTIALS_NOT_FOUND, 404)`, no retry
- 400 → throws `AuthServiceError(INVALID_REQUEST, 400)`, no retry
- 503 twice then 200 → retries, returns credentials on 3rd attempt
- 3 consecutive 503s → throws after max retries

---

### TASK-08-08: Update API endpoint tests
**Priority:** MVP
**File:** `tests/api/auth.api.test.js` (replace existing)

**Description:** Rewrite API tests to use new route paths and request/response shapes.

Key test cases:
- `POST /api/v1/token` — cache hit → 200 with `{ accessToken, expiresIn, tokenType, source: 'cache' }`
- `POST /api/v1/token` — missing `tenantId` → 400 `INVALID_REQUEST`
- `POST /api/v1/token` — invalid `type` → 400 `INVALID_REQUEST`
- `POST /api/v1/token` — missing auth header → 401
- `POST /api/v1/token` — tenant not found → 404 `CREDENTIALS_NOT_FOUND`
- `POST /api/v1/validate/jwt` — valid JWT → 200 `{ isValid: true, userId, ... }`
- `POST /api/v1/validate/jwt` — invalid JWT → 200 `{ isValid: false, error }`
- `POST /api/v1/validate/jwt` — JWKS unreachable → 503
- `GET /api/v1/health` — all healthy → 200 `{ status: 'healthy' }`
- `GET /api/v1/health` — Redis down → 200 `{ status: 'degraded' }`
- Old routes (`GET /auth/token`) → 404

---

### TASK-08-09: Integration test — full token flow with Redis
**Priority:** Post-MVP
**File:** `tests/integration/token-flow.test.js`

**Description:** Test the full token flow using a real Redis instance (can use `docker run redis` or `ioredis-mock` for CI).

Key scenarios (use `nock` for Tenant Service and Genesys OAuth):
- First request (cache miss) → fetches → caches → returns `source: 'fresh'`
- Second request → returns `source: 'cache'` (no HTTP calls)
- `forceRefresh: true` → fetches fresh even though cache is populated

---

### TASK-08-10: Load test — request collapsing
**Priority:** Post-MVP
**File:** `tests/load/request-collapsing.test.js`

**Description:** Verify that 100 concurrent requests for the same tenant result in ≤2 Genesys OAuth calls (1 if perfect, 2 if lock timeout occurs).

```javascript
// Approach: use nock with delay, fire 100 concurrent requests, count interceptor calls
it('collapses concurrent requests into single OAuth call', async () => {
  nock('https://login.aps1.pure.cloud')
    .post('/oauth/token')
    .delay(500)
    .reply(200, { access_token: 'token-abc', token_type: 'Bearer', expires_in: 86400 });

  const requests = Array.from({ length: 100 }, () =>
    request(app)
      .post('/api/v1/token')
      .set('Authorization', `Bearer ${testSecret}`)
      .send({ tenantId: 'test-tenant', type: 'genesys' })
  );

  const results = await Promise.all(requests);

  // All should succeed
  expect(results.every(r => r.status === 200)).toBe(true);
  expect(results.every(r => r.body.accessToken === 'token-abc')).toBe(true);

  // Nock should have been called at most 2 times
  // (1 is ideal; 2 happens if lock timeout causes second fetch)
  expect(nock.pendingMocks().length).toBeGreaterThanOrEqual(98);
});
```

---

### TASK-08-11: Update jest.config.js test paths
**Priority:** MVP
**Description:** Current `jest.config.js` uses `**/tests/**/*.test.js` pattern. After restructuring unit tests into subdirectories, verify this still matches.

Check that coverage threshold (80%) is still achievable and sensible after new service files are added.
