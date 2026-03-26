import { Pool, PoolConfig } from 'pg';
import logger from '../utils/logger';

// Mock Credential Service Response
interface TenantDBCredentials {
    host: string;
    port: number;
    database: string;
    user: string;
    password?: string;
}

interface PoolEntry {
    pool: Pool;
    createdAt: Date;
    lastAccessedAt: Date;
}

class TenantConnectionFactory {
    private connectionPools: Map<string, PoolEntry> = new Map();
    private readonly maxPoolAge = 3600000; // 1 hour in ms
    private readonly evictionInterval = 300000; // 5 minutes in ms
    private evictionTimer?: NodeJS.Timeout;

    constructor() {
        // Start background eviction job to prevent memory leaks
        this.startEvictionJob();
    }

    /**
     * Retrieves a database connection pool for a specific tenant.
     * If a pool exists and is not expired, it returns the cached instance.
     * Otherwise, it fetches credentials and creates a new pool.
     */
    async getConnection(tenantId: string): Promise<Pool> {
        const entry = this.connectionPools.get(tenantId);

        if (entry) {
            // Update last accessed time
            entry.lastAccessedAt = new Date();

            // Check if pool is expired
            const age = Date.now() - entry.createdAt.getTime();
            if (age > this.maxPoolAge) {
                logger.info('Tenant pool expired, recreating', { tenantId, ageMs: age });
                await this.closeConnection(tenantId);
            } else {
                return entry.pool;
            }
        }

        logger.debug('Initializing new DB connection pool', { tenantId });

        try {
            const credentials = await this.fetchTenantCredentials(tenantId);
            const newPool = this.createPool(credentials);

            // Handle pool errors
            newPool.on('error', (err) => {
                logger.error('Unexpected error on tenant DB client', { tenantId, error: err });
            });

            const poolEntry: PoolEntry = {
                pool: newPool,
                createdAt: new Date(),
                lastAccessedAt: new Date()
            };

            this.connectionPools.set(tenantId, poolEntry);
            logger.info('Created tenant connection pool', {
                tenantId,
                totalPools: this.connectionPools.size
            });

            return newPool;
        } catch (error: any) {
            logger.error('Failed to initialize tenant DB connection', { tenantId, error: error.message });
            throw error;
        }
    }

    /**
     * Closes a specific tenant's connection pool.
     */
    async closeConnection(tenantId: string): Promise<void> {
        const entry = this.connectionPools.get(tenantId);
        if (entry) {
            await entry.pool.end();
            this.connectionPools.delete(tenantId);
            logger.info('Closed tenant DB connection pool', { tenantId });
        }
    }

    /**
     * Closes all connection pools (e.g., on shutdown).
     */
    async closeAll(): Promise<void> {
        this.stopEvictionJob();
        const promises = Array.from(this.connectionPools.values()).map(entry => entry.pool.end());
        await Promise.all(promises);
        this.connectionPools.clear();
        logger.info('Closed all tenant DB connection pools');
    }

    /**
     * Start background job to evict idle and expired connection pools.
     * Prevents memory leaks from indefinite pool growth.
     */
    private startEvictionJob(): void {
        this.evictionTimer = setInterval(() => {
            this.evictStalePoolsSync();
        }, this.evictionInterval);

        logger.info('Connection pool eviction job started', {
            intervalMs: this.evictionInterval,
            maxAgeMs: this.maxPoolAge
        });
    }

    /**
     * Stop the eviction job (called during shutdown).
     */
    private stopEvictionJob(): void {
        if (this.evictionTimer) {
            clearInterval(this.evictionTimer);
            this.evictionTimer = undefined;
            logger.info('Connection pool eviction job stopped');
        }
    }

    /**
     * Evict connection pools that are idle or expired.
     * Synchronous wrapper for async eviction.
     */
    private evictStalePoolsSync(): void {
        this.evictStalePools().catch(err => {
            logger.error('Error in pool eviction job', { error: err.message });
        });
    }

    /**
     * Evict connection pools that are expired or idle for too long.
     */
    private async evictStalePools(): Promise<void> {
        const now = Date.now();
        const tenantsToEvict: string[] = [];

        for (const [tenantId, entry] of this.connectionPools.entries()) {
            const age = now - entry.createdAt.getTime();
            const idleTime = now - entry.lastAccessedAt.getTime();

            // Evict if pool is older than max age OR idle for more than 30 minutes
            if (age > this.maxPoolAge || idleTime > 1800000) {
                tenantsToEvict.push(tenantId);
            }
        }

        if (tenantsToEvict.length > 0) {
            logger.info('Evicting stale connection pools', {
                count: tenantsToEvict.length,
                tenants: tenantsToEvict,
                remainingPools: this.connectionPools.size - tenantsToEvict.length
            });

            for (const tenantId of tenantsToEvict) {
                await this.closeConnection(tenantId);
            }
        }
    }

    private createPool(creds: TenantDBCredentials): Pool {
        const config: PoolConfig = {
            host: creds.host,
            port: creds.port,
            database: creds.database,
            user: creds.user,
            password: creds.password,
            max: 10, // Default max connections per tenant
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        };
        return new Pool(config);
    }

    /**
     * STUB: Fetch credentials from Tenant Service.
     * In a real implementation, this would make an HTTP call to the Tenant Service.
     * For now, we return the default env vars or specific mock values.
     */
    private async fetchTenantCredentials(tenantId: string): Promise<TenantDBCredentials> {
        // TODO: Replace with actual Tenant Service API call
        // const response = await axios.get(`http://tenant-service/api/v1/tenants/${tenantId}/db-credentials`);

        // For MVP/Dev, we map all tenants to the primary DB but theoretically they could be different
        return {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'waba_mvp',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
        };
    }
}

export default new TenantConnectionFactory();
