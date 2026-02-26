// import pool from '../config/database'; // DEPRECATED for multi-tenancy
import tenantConnectionFactory from './tenantConnectionFactory';
import redisClient from '../config/redis';
import logger from '../utils/logger';
import { ConversationMapping, ConversationStatus } from '../types';

const { KEYS } = require('../../../../shared/constants');

class MappingService {

    // Helper: get the correct cache key based on whether tenantId is available
    private getWaKey(wa_id: string, tenantId?: string): string {
        return tenantId ? KEYS.tenantMappingWa(tenantId, wa_id) : KEYS.mappingWa(wa_id);
    }

    private getConvKey(conversation_id: string, tenantId?: string): string {
        return tenantId ? KEYS.tenantMappingConv(tenantId, conversation_id) : KEYS.mappingConv(conversation_id);
    }

    private getCacheTTL(): number {
        return KEYS.TTL.MAPPING;
    }

    // ==================== Inbound: Create mapping with NULL conversation_id ====================

    async createMappingForInbound(
        data: {
            wa_id: string;
            wamid: string;
            contact_name?: string;
            phone_number_id?: string;
            display_phone_number?: string;
        },
        tenantId: string
    ): Promise<{ mapping: ConversationMapping; isNew: boolean }> {

        const { wa_id, wamid, contact_name, phone_number_id, display_phone_number } = data;

        logger.debug('Creating/updating mapping for inbound', {
            operation: 'create_mapping_inbound',
            wa_id,
            wamid
        });

        const pool = await tenantConnectionFactory.getConnection(tenantId);

        // Idempotent INSERT with ON CONFLICT
        const result = await pool.query<ConversationMapping & { is_insert: boolean }>(
            `INSERT INTO conversation_mappings (
        wa_id, last_message_id, contact_name, phone_number_id,
        display_phone_number, status, last_activity_at
      ) VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP)
      ON CONFLICT (wa_id) WHERE status = 'active'
      DO UPDATE SET
        last_message_id = EXCLUDED.last_message_id,
        last_activity_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP,
        contact_name = COALESCE(EXCLUDED.contact_name, conversation_mappings.contact_name)
      RETURNING *, (xmax = 0) AS is_insert`,
            [wa_id, wamid, contact_name, phone_number_id, display_phone_number]
        );

        const mapping = result.rows[0];
        const isNew = mapping.is_insert;

        logger.info(isNew ? 'New mapping created' : 'Existing mapping updated', {
            operation: 'create_mapping_inbound',
            wa_id,
            mapping_id: mapping.id,
            conversation_id: mapping.conversation_id,
            is_new: isNew
        });

        // Cache with consistent TTL
        await this.cacheMapping(mapping, tenantId);

        return { mapping, isNew };
    }

    // ==================== Correlation: Set conversation_id after Genesys creates conversation ====================

    async correlateConversation(
        data: {
            conversation_id: string;
            communication_id: string;
            whatsapp_message_id: string; // wamid
        },
        tenantId: string
    ): Promise<ConversationMapping | null> {

        const { conversation_id, communication_id, whatsapp_message_id } = data;

        logger.info('Correlating conversation', {
            operation: 'correlate_conversation',
            conversation_id,
            communication_id,
            whatsapp_message_id
        });

        const pool = await tenantConnectionFactory.getConnection(tenantId);

        // Update conversation_id and/or communication_id when needed
        // (handles closed/reopened conversations and late-arriving communicationId)
        const result = await pool.query<ConversationMapping>(
            `UPDATE conversation_mappings
       SET conversation_id = $1,
           communication_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE last_message_id = $3
         AND (conversation_id IS DISTINCT FROM $1 OR communication_id IS DISTINCT FROM $2)
       RETURNING *`,
            [conversation_id, communication_id, whatsapp_message_id]
        );

        if (result.rows.length === 0) {
            logger.warn('Conversation already correlated or message not found', {
                operation: 'correlate_conversation',
                conversation_id,
                whatsapp_message_id
            });
            return null;
        }

        const mapping = result.rows[0];

        logger.info('Conversation correlated successfully', {
            operation: 'correlate_conversation',
            wa_id: mapping.wa_id,
            conversation_id,
            communication_id,
            mapping_id: mapping.id
        });

        // Invalidate all possible cache keys to clear stale data
        // (including 'default' tenant cache that may have been created before tenant was resolved)
        await this.invalidateAllCacheKeys(mapping.wa_id, conversation_id);

        // Update cache with both keys for the correct tenant
        await this.cacheMapping(mapping, tenantId);

        return mapping;
    }

    // ==================== Lookup: Cache-first patterns ====================

    async getMappingByWaId(wa_id: string, tenantId: string): Promise<ConversationMapping | null> {
        const cacheKey = this.getWaKey(wa_id, tenantId);

        // Try cache first
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            // Refresh TTL on activity
            await redisClient.expire(cacheKey, this.getCacheTTL());
            logger.debug('Cache hit', {
                operation: 'get_mapping_by_wa_id',
                wa_id,
                cache_hit: true
            });
            return JSON.parse(cached);
        }

        // Database fallback
        logger.debug('Cache miss, querying DB', {
            operation: 'get_mapping_by_wa_id',
            wa_id,
            cache_hit: false
        });

        const pool = await tenantConnectionFactory.getConnection(tenantId);

        const result = await pool.query<ConversationMapping>(
            `SELECT * FROM conversation_mappings
       WHERE wa_id = $1 AND status = 'active'
       ORDER BY last_activity_at DESC
       LIMIT 1`,
            [wa_id]
        );

        if (result.rows.length === 0) {
            logger.debug('No active mapping found', {
                operation: 'get_mapping_by_wa_id',
                wa_id
            });
            return null;
        }

        const mapping = result.rows[0];

        // Populate cache
        await this.cacheMapping(mapping, tenantId);

        return mapping;
    }

    async getMappingByConversationId(conversation_id: string, tenantId: string): Promise<ConversationMapping | null> {
        const cacheKey = this.getConvKey(conversation_id, tenantId);

        const cached = await redisClient.get(cacheKey);
        if (cached) {
            // Refresh TTL on activity
            await redisClient.expire(cacheKey, this.getCacheTTL());
            logger.debug('Cache hit', {
                operation: 'get_mapping_by_conv_id',
                conversation_id,
                cache_hit: true
            });
            // print communicationId from cache
            logger.debug('Cache hit', {
                communication_id: JSON.parse(cached).communication_id
            });
            return JSON.parse(cached);
        }

        logger.debug('Cache miss, querying DB', {
            operation: 'get_mapping_by_conv_id',
            conversation_id,
            cache_hit: false
        });

        const pool = await tenantConnectionFactory.getConnection(tenantId);

        const result = await pool.query<ConversationMapping>(
            `SELECT * FROM conversation_mappings
       WHERE conversation_id = $1 AND status = 'active'`,
            [conversation_id]
        );

        if (result.rows.length === 0) {
            logger.debug('No active mapping found', {
                operation: 'get_mapping_by_conv_id',
                conversation_id
            });
            return null;
        }

        const mapping = result.rows[0];
        await this.cacheMapping(mapping, tenantId);

        return mapping;
    }

    // ==================== Partial Update (e.g. communicationId) ====================

    async updateConversationMapping(
        conversation_id: string,
        updates: { communicationId?: string },
        tenantId: string
    ): Promise<ConversationMapping | null> {

        if (!updates.communicationId) {
            logger.warn('No updatable fields provided', { operation: 'update_conversation_mapping', conversation_id });
            return null;
        }

        const pool = await tenantConnectionFactory.getConnection(tenantId);

        const result = await pool.query<ConversationMapping>(
            `UPDATE conversation_mappings
             SET communication_id = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE conversation_id = $2 AND status = 'active'
             RETURNING *`,
            [updates.communicationId, conversation_id]
        );

        if (result.rows.length === 0) {
            logger.warn('No active mapping found for update', { operation: 'update_conversation_mapping', conversation_id });
            return null;
        }

        const mapping = result.rows[0];

        logger.info('Conversation mapping updated', {
            operation: 'update_conversation_mapping',
            conversation_id,
            communication_id: updates.communicationId,
            mapping_id: mapping.id
        });

        // Invalidate and re-cache
        await this.invalidateAllCacheKeys(mapping.wa_id, conversation_id);
        await this.cacheMapping(mapping, tenantId);

        return mapping;
    }

    // ==================== Activity Tracking ====================

    async updateActivity(mapping_id: string, message_id: string, tenantId: string): Promise<void> {
        const pool = await tenantConnectionFactory.getConnection(tenantId);
        await pool.query(
            `UPDATE conversation_mappings
       SET last_activity_at = CURRENT_TIMESTAMP,
           last_message_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
            [message_id, mapping_id]
        );

        logger.debug('Activity timestamp updated', {
            operation: 'update_activity',
            mapping_id,
            message_id
        });
    }

    // ==================== Caching ====================

    async cacheMapping(mapping: ConversationMapping, tenantId?: string): Promise<void> {
        const ttl = this.getCacheTTL();

        const cacheData = {
            id: mapping.id,
            wa_id: mapping.wa_id,
            conversation_id: mapping.conversation_id,
            communication_id: mapping.communication_id,
            contact_name: mapping.contact_name,
            phone_number_id: mapping.phone_number_id,
            display_phone_number: mapping.display_phone_number,
            status: mapping.status,
            last_activity_at: mapping.last_activity_at,
            last_message_id: mapping.last_message_id
        };

        // Cache by wa_id (tenant-scoped if tenantId available)
        await redisClient.setEx(
            this.getWaKey(mapping.wa_id, tenantId),
            ttl,
            JSON.stringify(cacheData)
        );

        // Cache by conversation_id (if set)
        if (mapping.conversation_id) {
            await redisClient.setEx(
                this.getConvKey(mapping.conversation_id, tenantId),
                ttl,
                JSON.stringify(cacheData)
            );
        }

        logger.debug('Mapping cached', {
            operation: 'cache_mapping',
            wa_id: mapping.wa_id,
            conversation_id: mapping.conversation_id,
            ttl
        });
    }

    async invalidateCache(wa_id: string, conversation_id?: string, tenantId?: string): Promise<void> {
        await redisClient.del(this.getWaKey(wa_id, tenantId));

        if (conversation_id) {
            await redisClient.del(this.getConvKey(conversation_id, tenantId));
        }

        logger.debug('Cache invalidated', {
            operation: 'invalidate_cache',
            wa_id,
            conversation_id
        });
    }

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
            } else {
                logger.debug('No cache keys found to invalidate', {
                    operation: 'invalidate_all_cache_keys',
                    wa_id,
                    conversation_id
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

    formatMapping(mapping: ConversationMapping) {
        return {
            waId: mapping.wa_id,
            conversationId: mapping.conversation_id,
            contactName: mapping.contact_name,
            phoneNumberId: mapping.phone_number_id,
            displayPhoneNumber: mapping.display_phone_number,
            communicationId: mapping.communication_id,
            status: mapping.status,
            lastActivityAt: mapping.last_activity_at,
            isNew: !mapping.conversation_id,
            internalId: mapping.id
        };
    }
}

export default new MappingService();
