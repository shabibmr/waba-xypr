# Phase 02 — Redis Infrastructure

**Depends on:** 01-project-structure-foundation
**Blocks:** 03, 04, 05
**MVP Critical:** YES

---

## Gap Analysis

### Current State
- Redis client is created inline in `src/index.js` using the `redis` npm package (v4)
- No singleton pattern — if index.js is split, multiple connections would be created
- No health monitoring — no periodic ping to detect Redis going down
- No distributed lock implementation (the FRD's core request-collapsing mechanism)
- Token cache operations are scattered inline throughout route handlers
- Cache key patterns don't match FRD (`tenant:${tenantId}:whatsapp:token` vs `auth:token:whatsapp:{tenantId}`)
- No degraded mode detection

### FRD Requirements
- `repositories/redis.client.js` — Singleton Redis client with event handlers
- `repositories/token-cache.repository.js` — Token cache get/set using correct key patterns
- `repositories/lock.repository.js` — Distributed lock with SET NX EX + Lua release script
- Redis health monitor — periodic ping, tracks `isHealthy` state
- Degraded mode: when Redis is down, skip caching and use in-memory rate limiter

---

## Tasks

### TASK-02-01: Implement Redis singleton client
**Priority:** MVP
**File:** `src/repositories/redis.client.js`

**Description:** Extract Redis client into a singleton with proper event handling and reconnect logic.

```javascript
// src/repositories/redis.client.js
const { createClient } = require('redis');
const logger = require('../utils/logger');
const config = require('../config');

let instance = null;

function getRedisClient() {
  if (!instance) {
    instance = createClient({
      url: config.redis.url,
      database: config.redis.db,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) return new Error('Redis max retries exceeded');
          return Math.min(retries * 100, 3000);
        },
      },
    });

    instance.on('connect', () => {
      logger.info('Redis connected');
    });

    instance.on('error', (err) => {
      logger.error('Redis connection error', { error: err.message });
    });

    instance.on('reconnecting', () => {
      logger.warn('Redis reconnecting');
    });

    instance.on('end', () => {
      logger.warn('Redis connection closed');
    });
  }
  return instance;
}

async function connectRedis() {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}

module.exports = { getRedisClient, connectRedis };
```

**Acceptance:** `getRedisClient()` always returns the same instance. Calling it 10 times in a row does not open 10 connections. Event logs appear on connect/disconnect.

---

### TASK-02-02: Implement token cache repository
**Priority:** MVP
**File:** `src/repositories/token-cache.repository.js`

**Description:** Encapsulate all token cache operations. Uses correct key patterns from FRD Section 3.3.

```javascript
// src/repositories/token-cache.repository.js
const logger = require('../utils/logger');
const { RedisKeys, RedisTTL } = require('../utils/redis-keys');

class TokenCacheRepository {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  /**
   * Get a cached token. Returns null on miss or Redis error.
   */
  async get(provider, tenantId) {
    const key = RedisKeys.token(provider, tenantId);
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;

      const cached = JSON.parse(raw);

      // Check if token is expired (belt-and-suspenders beyond Redis TTL)
      if (Date.now() >= cached.expiresAt) {
        logger.debug('Token in cache is expired', { provider, tenantId });
        return null;
      }

      return {
        accessToken: cached.token,
        expiresIn: Math.floor((cached.expiresAt - Date.now()) / 1000),
        tokenType: 'Bearer',
        source: 'cache',
        cachedAt: new Date(cached.cachedAt),
        expiresAt: new Date(cached.expiresAt),
      };
    } catch (err) {
      logger.warn('Token cache get failed', { error: err.message, provider, tenantId });
      return null;
    }
  }

  /**
   * Store a token in cache. TTL is expiresIn minus safety buffer.
   * No-op (with warning) if TTL would be <= 0.
   */
  async set(provider, tenantId, token, expiresIn) {
    const ttl = expiresIn - RedisTTL.TOKEN_SAFETY_BUFFER;
    if (ttl <= 0) {
      logger.warn('Token TTL too short to cache', { provider, tenantId, expiresIn });
      return;
    }

    const key = RedisKeys.token(provider, tenantId);
    const now = Date.now();
    const payload = {
      token,
      expiresAt: now + expiresIn * 1000,
      cachedAt: now,
    };

    try {
      await this.redis.setEx(key, ttl, JSON.stringify(payload));
      logger.info('Token cached', {
        provider,
        tenantId,
        ttl,
        expiresAt: new Date(payload.expiresAt).toISOString(),
        tokenLength: token.length,  // safe — length is not sensitive
      });
    } catch (err) {
      logger.error('Token cache set failed', { error: err.message, provider, tenantId });
      // Non-critical — token is still valid, just not cached
    }
  }

  /**
   * Delete a cached token (for force-refresh).
   */
  async delete(provider, tenantId) {
    const key = RedisKeys.token(provider, tenantId);
    try {
      await this.redis.del(key);
      logger.info('Token cache cleared', { provider, tenantId });
    } catch (err) {
      logger.warn('Token cache delete failed', { error: err.message, provider, tenantId });
    }
  }
}

module.exports = { TokenCacheRepository };
```

**Acceptance:** `cache.get('genesys', 'tenant-1')` returns null on miss. After `cache.set(...)`, subsequent `cache.get(...)` returns the token. Redis key used is `auth:token:genesys:tenant-1`.

---

### TASK-02-03: Implement distributed lock repository
**Priority:** MVP
**File:** `src/repositories/lock.repository.js`

**Description:** Implement the request-collapsing lock using Redis SET NX EX. Uses a Lua script for safe release (only the lock owner can release it). See FRD Section 5.1 Step 2.

```javascript
// src/repositories/lock.repository.js
const { randomUUID } = require('crypto');
const logger = require('../utils/logger');
const { RedisKeys, RedisTTL } = require('../utils/redis-keys');

// Lua script: only delete if value matches (prevents releasing another owner's lock)
const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

class LockRepository {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  /**
   * Attempt to acquire a lock. Returns { acquired: bool, lockValue: string }.
   * lockValue must be passed to release().
   */
  async acquire(provider, tenantId) {
    const key = RedisKeys.lock(provider, tenantId);
    const lockValue = randomUUID();

    try {
      const result = await this.redis.set(key, lockValue, {
        NX: true,          // Only set if not exists
        EX: RedisTTL.LOCK_TTL,
      });

      const acquired = result === 'OK';
      if (acquired) {
        logger.debug('Lock acquired', { provider, tenantId });
      }
      return { acquired, lockValue };
    } catch (err) {
      logger.error('Lock acquisition error', { error: err.message, provider, tenantId });
      return { acquired: false, lockValue: null };
    }
  }

  /**
   * Release a lock. Only releases if current value matches lockValue.
   */
  async release(provider, tenantId, lockValue) {
    const key = RedisKeys.lock(provider, tenantId);
    try {
      await this.redis.eval(RELEASE_SCRIPT, { keys: [key], arguments: [lockValue] });
      logger.debug('Lock released', { provider, tenantId });
    } catch (err) {
      logger.error('Lock release error', { error: err.message, provider, tenantId });
      // Non-critical — lock will expire automatically after LOCK_TTL seconds
    }
  }
}

module.exports = { LockRepository };
```

**Acceptance:** Two concurrent `acquire()` calls for the same provider+tenantId: only one returns `acquired: true`. `release()` with wrong `lockValue` does NOT delete the lock.

---

### TASK-02-04: Implement Redis health monitor
**Priority:** MVP
**File:** `src/services/health/redis-health-monitor.js`

**Description:** Track Redis health state. Used by token services to decide whether to operate in normal or degraded mode. See FRD Section 6.2.

```javascript
// src/services/health/redis-health-monitor.js
const logger = require('../../utils/logger');

class RedisHealthMonitor {
  constructor(redisClient, checkIntervalMs = 5000) {
    this.redis = redisClient;
    this.isHealthy = true;
    this.lastCheck = null;
    this.checkIntervalMs = checkIntervalMs;
    this._timer = null;
  }

  async checkHealth() {
    try {
      await this.redis.ping();

      if (!this.isHealthy) {
        logger.info('Redis recovered — exiting degraded mode');
      }

      this.isHealthy = true;
      this.lastCheck = new Date();
      return true;
    } catch (err) {
      if (this.isHealthy) {
        logger.error('Redis became unhealthy — entering degraded mode', {
          error: err.message,
        });
      }
      this.isHealthy = false;
      this.lastCheck = new Date();
      return false;
    }
  }

  start() {
    this._timer = setInterval(() => this.checkHealth(), this.checkIntervalMs);
    // Unref so it doesn't prevent process exit in tests
    if (this._timer.unref) this._timer.unref();
    logger.info('Redis health monitor started', {
      intervalMs: this.checkIntervalMs,
    });
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  getStatus() {
    return {
      isHealthy: this.isHealthy,
      lastCheck: this.lastCheck,
    };
  }
}

module.exports = { RedisHealthMonitor };
```

**Acceptance:** After Redis is stopped, within 5-10 seconds `monitor.isHealthy` flips to `false`. After Redis is restarted, it flips back to `true`. `start()` does not block process exit (unref'd timer).

---

### TASK-02-05: Implement in-memory degraded mode rate limiter
**Priority:** MVP
**File:** `src/services/health/degraded-rate-limiter.js`

**Description:** When Redis is unavailable, apply per-tenant in-memory rate limiting to prevent hammering the OAuth provider. See FRD Section 6.2.

```javascript
// src/services/health/degraded-rate-limiter.js
const logger = require('../../utils/logger');

const MAX_REQUESTS_PER_MINUTE = 10;

class DegradedModeRateLimiter {
  constructor(maxRequestsPerMinute = MAX_REQUESTS_PER_MINUTE) {
    this.requests = new Map();  // key → timestamp[]
    this.maxRequestsPerMinute = maxRequestsPerMinute;
  }

  isAllowed(provider, tenantId) {
    const key = `${provider}:${tenantId}`;
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    const timestamps = (this.requests.get(key) || []).filter(ts => ts > oneMinuteAgo);

    if (timestamps.length >= this.maxRequestsPerMinute) {
      logger.warn('Degraded mode rate limit exceeded', {
        provider,
        tenantId,
        requests: timestamps.length,
        limit: this.maxRequestsPerMinute,
      });
      return false;
    }

    timestamps.push(now);
    this.requests.set(key, timestamps);
    return true;
  }

  // Call periodically or on GC to prevent memory growth
  prune() {
    const oneMinuteAgo = Date.now() - 60_000;
    for (const [key, timestamps] of this.requests) {
      const recent = timestamps.filter(ts => ts > oneMinuteAgo);
      if (recent.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recent);
      }
    }
  }
}

module.exports = { DegradedModeRateLimiter };
```

**Acceptance:** 11 calls within one minute for the same provider+tenantId: first 10 return `true`, 11th returns `false`. After 60 seconds, 10 more calls are allowed.
