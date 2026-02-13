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

class TenantConnectionFactory {
    private connectionPools: Map<string, Pool> = new Map();

    /**
     * Retrieves a database connection pool for a specific tenant.
     * If a pool exists, it returns the cached instance.
     * Otherwise, it fetches credentials and creates a new pool.
     */
    async getConnection(tenantId: string): Promise<Pool> {
        if (this.connectionPools.has(tenantId)) {
            return this.connectionPools.get(tenantId)!;
        }

        logger.debug('Initializing new DB connection pool', { tenantId });

        try {
            const credentials = await this.fetchTenantCredentials(tenantId);
            const newPool = this.createPool(credentials);

            // Handle pool errors
            newPool.on('error', (err) => {
                logger.error('Unexpected error on tenant DB client', { tenantId, error: err });
            });

            this.connectionPools.set(tenantId, newPool);
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
        const pool = this.connectionPools.get(tenantId);
        if (pool) {
            await pool.end();
            this.connectionPools.delete(tenantId);
            logger.info('Closed tenant DB connection pool', { tenantId });
        }
    }

    /**
     * Closes all connection pools (e.g., on shutdown).
     */
    async closeAll(): Promise<void> {
        const promises = Array.from(this.connectionPools.values()).map(pool => pool.end());
        await Promise.all(promises);
        this.connectionPools.clear();
        logger.info('Closed all tenant DB connection pools');
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
