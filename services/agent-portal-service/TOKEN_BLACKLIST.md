# Token Blacklist Implementation

Redis-based token blacklist for immediate token revocation on logout.

## Overview

The token blacklist provides immediate token invalidation, preventing revoked tokens from being used even if they haven't expired yet. This is a critical security feature for logout functionality.

## Architecture

### Components

1. **Redis Storage**: Blacklisted tokens stored in Redis with automatic expiration
2. **Middleware Integration**: Authentication middleware checks blacklist before accepting tokens
3. **Multi-token Support**: Efficient batch blacklisting for "logout all devices"

### Storage Strategy

```
Key Pattern: blacklist:token:{JWT_TOKEN}
Value: '1' (simple flag)
TTL: Matches token's natural expiry time
```

**Why TTL matching?**
- No need to store expired tokens
- Automatic cleanup by Redis
- Memory efficient

## How It Works

### Single Logout Flow

```
User clicks Logout
    ↓
Frontend calls POST /api/agents/auth/logout
    ↓
Backend:
1. Decode token to get expiry
2. Add token to Redis blacklist (TTL = time until expiry)
3. Mark session as inactive in database
    ↓
Token is now immediately invalid
```

### Logout All Devices Flow

```
User clicks "Logout All Devices"
    ↓
Frontend calls POST /api/agents/auth/logout-all
    ↓
Backend:
1. Fetch all active sessions from database
2. Extract access tokens from sessions
3. Add all tokens to Redis blacklist in batch
4. Mark all sessions as inactive
    ↓
All tokens are now immediately invalid
```

### Token Validation Flow

```
API Request with Bearer token
    ↓
Authenticate Middleware:
1. Verify JWT signature
2. Check if token is blacklisted ← NEW
3. Check user exists and is active
    ↓
Allow/Deny request
```

## Implementation Details

### tokenBlacklist Service

**Location**: `src/services/tokenBlacklist.js`

**Key Methods:**

```javascript
// Add single token
await tokenBlacklist.addToken(token, expirySeconds);

// Check if blacklisted
const isBlacklisted = await tokenBlacklist.isBlacklisted(token);

// Add multiple tokens (logout all)
await tokenBlacklist.addTokens([
  { token: 'jwt1...', expirySeconds: 3600 },
  { token: 'jwt2...', expirySeconds: 3500 }
]);

// Get statistics
const stats = await tokenBlacklist.getStats();
// { blacklistedTokens: 42, prefix: 'blacklist:token:' }
```

### Middleware Integration

**Location**: `src/middleware/authenticate.js`

```javascript
// After JWT verification
const isBlacklisted = await tokenBlacklist.isBlacklisted(token);
if (isBlacklisted) {
    return res.status(401).json({ error: 'Token has been revoked' });
}
```

**Error Handling:**
- If Redis is down, fail open (allow request)
- Log error for monitoring
- Prevents Redis outage from blocking all requests

### Database Sessions

Sessions are tracked in `genesys_user_sessions` table:

```sql
CREATE TABLE genesys_user_sessions (
    session_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Why both Redis and Database?**
- Redis: Fast blacklist lookups (sub-millisecond)
- Database: Audit trail and session management
- Redis auto-expires, database persists for history

## Security Features

### Immediate Revocation

Traditional JWT problem:
```
User logs out → Token still valid until expiry
Attacker with stolen token → Can use for up to 1 hour
```

With blacklist:
```
User logs out → Token blacklisted immediately
Attacker with stolen token → 401 Unauthorized
```

### Multi-Device Protection

```
Device 1: Login at 10:00 AM
Device 2: Login at 11:00 AM
Device 3: Login at 12:00 PM

User on Device 1: "Logout All Devices"
    ↓
All 3 tokens blacklisted immediately
All devices must re-login
```

### Token Rotation on Refresh

When tokens are refreshed:
1. Old access token is automatically invalidated (new one issued)
2. Old refresh token can optionally be blacklisted
3. Prevents token reuse attacks

## Performance Considerations

### Redis Memory Usage

Typical token size: ~500 bytes
Average blacklist size: 1000 tokens
Memory usage: ~500 KB

**Scaling:**
- 1M tokens = ~500 MB
- Redis cluster if needed
- TTL ensures automatic cleanup

### Latency

Redis operations:
- `EXISTS` check: < 1ms
- `SETEX` (add): < 1ms
- Multi-token batch: < 5ms for 100 tokens

**Impact on API requests:**
- Adds ~1ms to authentication
- Negligible compared to database queries

### Batch Operations

For "logout all devices" with many sessions:

```javascript
// Efficient: Single pipeline
const multi = redis.multi();
tokens.forEach(t => multi.setEx(key, ttl, '1'));
await multi.exec(); // Single round-trip

// Inefficient: Multiple round-trips
for (const token of tokens) {
    await redis.setEx(key, ttl, '1'); // N round-trips
}
```

## Configuration

### Environment Variables

```bash
# Redis connection
REDIS_URL=redis://localhost:6379

# JWT settings (from config)
JWT_SECRET=your_secret_key
```

### Redis Configuration

**Reconnection Strategy:**
```javascript
reconnectStrategy: (retries) => {
    const delay = Math.min(retries * 50, 2000);
    return delay; // Exponential backoff, max 2s
}
```

**Max Retries:** 3 per request

## Monitoring

### Key Metrics

1. **Blacklist Size**: Number of currently blacklisted tokens
2. **Hit Rate**: Percentage of auth requests hitting blacklisted tokens
3. **Redis Availability**: Uptime and error rate
4. **Latency**: p50, p95, p99 for blacklist checks

### Health Check

```javascript
// Check Redis connectivity and blacklist stats
GET /api/admin/health/blacklist

Response:
{
  "redis": "connected",
  "blacklistedTokens": 42,
  "uptime": "5d 3h 24m"
}
```

### Logging

All blacklist operations are logged:

```javascript
logger.info('Token added to blacklist', {
    tokenPrefix: 'eyJhbGci...',
    expirySeconds: 3600,
    userId: 'uuid'
});

logger.warn('Blacklisted token used', {
    userId: 'uuid',
    path: '/api/profile',
    ip: '192.168.1.1'
});
```

## Testing

### Unit Tests

```javascript
// Test blacklist add
test('should add token to blacklist', async () => {
    await tokenBlacklist.addToken('test-token', 3600);
    const isBlacklisted = await tokenBlacklist.isBlacklisted('test-token');
    expect(isBlacklisted).toBe(true);
});

// Test blacklist expiry
test('should auto-expire blacklisted tokens', async () => {
    await tokenBlacklist.addToken('test-token', 1); // 1 second TTL
    await sleep(1500);
    const isBlacklisted = await tokenBlacklist.isBlacklisted('test-token');
    expect(isBlacklisted).toBe(false);
});

// Test batch blacklist
test('should blacklist multiple tokens', async () => {
    const tokens = [
        { token: 'token1', expirySeconds: 3600 },
        { token: 'token2', expirySeconds: 3600 }
    ];
    await tokenBlacklist.addTokens(tokens);
    expect(await tokenBlacklist.isBlacklisted('token1')).toBe(true);
    expect(await tokenBlacklist.isBlacklisted('token2')).toBe(true);
});
```

### Integration Tests

```javascript
// Test logout flow
test('should blacklist token on logout', async () => {
    // Login
    const { token } = await login();

    // Verify token works
    const res1 = await request.get('/api/profile')
        .set('Authorization', `Bearer ${token}`);
    expect(res1.status).toBe(200);

    // Logout
    await request.post('/api/agents/auth/logout')
        .set('Authorization', `Bearer ${token}`);

    // Verify token is blacklisted
    const res2 = await request.get('/api/profile')
        .set('Authorization', `Bearer ${token}`);
    expect(res2.status).toBe(401);
    expect(res2.body.error).toBe('Token has been revoked');
});
```

## Troubleshooting

### Token not getting blacklisted

**Check:**
1. Redis connection: `docker logs whatsapp-redis`
2. Token format: Ensure it's the full JWT, not just part
3. Expiry calculation: Verify token hasn't already expired

### Redis connection errors

**Solutions:**
1. Check Redis is running: `docker ps | grep redis`
2. Verify REDIS_URL in .env
3. Check network connectivity
4. Review reconnection strategy logs

### High memory usage

**Investigation:**
```bash
# Connect to Redis
docker exec -it whatsapp-redis redis-cli

# Check number of blacklisted tokens
KEYS blacklist:token:* | wc -l

# Check memory usage
INFO memory

# Check key TTLs
TTL blacklist:token:{TOKEN}
```

**Solutions:**
- Reduce token expiry time (shorter tokens = less blacklist retention)
- Implement token rotation more aggressively
- Use Redis eviction policies

### Performance degradation

**Check:**
1. Redis latency: `redis-cli --latency`
2. Network latency: Is Redis on same host/network?
3. Key count: Too many blacklisted tokens?
4. Redis version: Ensure modern version (6.0+)

## Best Practices

1. **Always blacklist on logout** - Don't rely on token expiry alone
2. **Use batch operations** - For logout all devices
3. **Set appropriate TTLs** - Match token expiry
4. **Monitor Redis health** - Alert on connection failures
5. **Fail open gracefully** - Allow requests if Redis is down
6. **Log blacklist hits** - Detect potential attacks
7. **Regular cleanup** - Redis handles it, but monitor memory
8. **Use connection pooling** - For high-traffic scenarios

## Future Enhancements

- [ ] Token family tracking (detect token reuse)
- [ ] Anomaly detection (unusual blacklist patterns)
- [ ] Geographic blacklisting (block by region)
- [ ] Token fingerprinting (bind to device)
- [ ] Blacklist analytics dashboard
- [ ] Redis Sentinel for high availability
- [ ] Multi-region Redis replication
