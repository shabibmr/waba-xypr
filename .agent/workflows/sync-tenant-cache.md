---
description: Fix stale Redis cache data for a specific organization/tenant
---
# Sync Tenant Cache

This workflow forces a cache invalidation and rebuild for a specific tenant.

1. First, check the current cache keys for the tenant in Redis:
   ```bash
   # Replace <tenant_id> with the actual ID
   docker exec -it whatsapp-redis redis-cli KEYS "*tenant:*<tenant_id>*"
   ```

2. If you need to forcefully flush the cache for a tenant, delete those keys:
   ```bash
   # Use with caution: this clears the cache for the specified tenant
   docker exec -it whatsapp-redis redis-cli --eval "return redis.call('del', unpack(redis.call('keys', ARGV[1])))" 0 "*tenant:*<tenant_id>*"
   ```

3. Tail the `tenant-service` logs to observe the cache miss and rebuild on the next request:
   ```bash
   docker logs -f whatsapp-tenant-service --tail 50
   ```
