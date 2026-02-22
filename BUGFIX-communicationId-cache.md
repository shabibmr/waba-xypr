# Bug Fix: communicationId NULL due to Stale Cache

## Problem

When the agent-widget loads, `communicationId` was showing as `null` even though it existed in the database.

### Root Cause

1. **Initial mapping creation**: When a WhatsApp customer first sends a message, a mapping is created with `communication_id = NULL`
2. **Cache population**: The mapping gets cached under multiple tenant keys:
   - `tenant:{actualTenantId}:mapping:conv:{conversationId}`
   - `tenant:default:mapping:conv:{conversationId}` (created when tenant resolution fails)
3. **Correlation event**: When Genesys creates the conversation, the correlation event:
   - Updates database: Sets `communication_id = <participant.id>`
   - Updates cache: Only for the actual tenant key
   - **BUG**: Doesn't invalidate the `tenant:default` cache key
4. **Widget loads**: When widget tries to resolve tenant, it:
   - Calls conversation endpoint without tenant ID
   - Gets served the stale `tenant:default` cache with `communication_id = null`
   - Can't extract integrationId, so falls back to `'default'` tenant
   - Creates a circular dependency

## Solution

### Files Modified

#### 1. `services/state-manager/src/config/redis.ts`
**Added:** `keys()` method to RedisWrapper class
```typescript
async keys(pattern: string): Promise<string[]> {
    try {
      if (!this.client || !this.connected) {
        logger.warn('Redis unavailable, skipping keys lookup', { pattern });
        return [];
      }
      return await this.client.keys(pattern);
    } catch (error: any) {
      logger.warn('Redis KEYS failed', { pattern, error: error.message });
      return [];
    }
  }
```

#### 2. `services/state-manager/src/services/mappingService.ts`

**Added:** `invalidateAllCacheKeys()` method
```typescript
/**
 * Invalidate all possible cache keys for a conversation across all tenants.
 * This is needed when correlation updates the database to clear stale cached data
 * from the 'default' tenant or other tenant namespaces.
 */
async invalidateAllCacheKeys(wa_id: string, conversation_id: string): Promise<void> {
    // Find and delete all cache keys matching this conversation_id
    const convPattern = `*:mapping:conv:${conversation_id}`;
    const waPattern = `*:mapping:wa:${wa_id}`;

    try {
        // Get all matching keys
        const convKeys = await redisClient.keys(convPattern);
        const waKeys = await redisClient.keys(waPattern);

        const allKeys = [...convKeys, ...waKeys];

        if (allKeys.length > 0) {
            await redisClient.del(allKeys);
            logger.info('Invalidated all cache keys for conversation', {
                operation: 'invalidate_all_cache_keys',
                wa_id,
                conversation_id,
                keys_deleted: allKeys.length,
                keys: allKeys
            });
        }
    } catch (error: any) {
        logger.error('Failed to invalidate all cache keys', {
            operation: 'invalidate_all_cache_keys',
            wa_id,
            conversation_id,
            error: error.message
        });
        // Don't throw - cache invalidation failure shouldn't break correlation
    }
}
```

**Modified:** `correlateConversation()` method
```typescript
// Invalidate all possible cache keys to clear stale data
// (including 'default' tenant cache that may have been created before tenant was resolved)
await this.invalidateAllCacheKeys(mapping.wa_id, conversation_id);

// Update cache with both keys for the correct tenant
await this.cacheMapping(mapping, tenantId);
```

## How It Works

### Before Fix
1. Correlation updates DB + caches with actual tenant key
2. Stale `tenant:default` cache remains
3. Widget fetches with `default` tenant → gets stale cache
4. `communicationId = null` ❌

### After Fix
1. Correlation updates DB
2. **Invalidates ALL cache keys** (including `tenant:default`)
3. Caches with actual tenant key
4. Widget fetches with `default` tenant → cache miss → reads from DB
5. `communicationId = <correct-value>` ✅

## Testing

### Manual Test
1. Send a WhatsApp message to create new conversation
2. Wait for Genesys conversation creation
3. Check logs for: `Invalidated all cache keys for conversation`
4. Reload agent-widget
5. Verify `communicationId` is present

### Verify Cache Invalidation
```bash
# Before correlation
docker exec whatsapp-redis redis-cli KEYS "*:mapping:conv:*"

# After correlation (should show actual tenant key only, no 'default')
docker exec whatsapp-redis redis-cli KEYS "*:mapping:conv:{conversationId}"
```

### Check Logs
```bash
docker logs whatsapp-state-manager | grep "invalidate_all_cache_keys"
```

Expected output:
```json
{
  "level": "INFO",
  "message": "Invalidated all cache keys for conversation",
  "operation": "invalidate_all_cache_keys",
  "keys_deleted": 2,
  "keys": [
    "tenant:default:mapping:conv:abc-123",
    "tenant:default:mapping:wa:+1234567890"
  ]
}
```

## Deployment

1. ✅ Code changes committed
2. ✅ TypeScript compilation verified
3. ✅ State-manager restarted
4. **Next:** Test with real conversation flow
5. **Next:** Monitor logs for cache invalidation

## Notes

- Cache invalidation uses Redis `KEYS` command which can be slow on large datasets
- Consider using `SCAN` for production if this becomes a performance issue
- Error in cache invalidation won't break correlation (fail-safe)
- Logs include all deleted keys for debugging

## Related Files

- `services/agent-widget/src/services/widget.service.js` - Tenant resolution logic
- `services/agent-portal-service/src/routes/widgetRoutes.js` - Proxies to state-manager
- `services/state-manager/src/services/mappingService.ts` - Cache management
- `services/state-manager/src/config/redis.ts` - Redis wrapper

## Date
2026-02-22

## Author
Claude Code Assistant
