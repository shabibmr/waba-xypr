// import pool from '../config/database'; // DEPRECATED for multi-tenancy
import tenantConnectionFactory from './tenantConnectionFactory';
import redisClient from '../config/redis';
import logger from '../utils/logger';
import { ConversationMapping, ConversationStatus } from '../types';

const { KEYS } = require('../../../../shared/constants');

class MappingService {

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

        // Cache with 24h TTL
        await this.cacheMapping(mapping);

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

        // Idempotent UPDATE - only if conversation_id is NULL
        const result = await pool.query<ConversationMapping>(
            `UPDATE conversation_mappings
       SET conversation_id = $1,
           communication_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE last_message_id = $3
         AND conversation_id IS NULL
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

        // Update cache with both keys
        await this.cacheMapping(mapping);

        return mapping;
    }

    // ==================== Lookup: Cache-first patterns ====================

    async getMappingByWaId(wa_id: string, tenantId: string): Promise<ConversationMapping | null> {
        const cacheKey = KEYS.mappingWa(wa_id);

        // Try cache first
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            // Refresh TTL on activity (FRD §6.2)
            await redisClient.expire(cacheKey, 86400);
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
        await this.cacheMapping(mapping);

        return mapping;
    }

    async getMappingByConversationId(conversation_id: string, tenantId: string): Promise<ConversationMapping | null> {
        const cacheKey = KEYS.mappingConv(conversation_id);

        const cached = await redisClient.get(cacheKey);
        if (cached) {
            // Refresh TTL on activity (FRD §6.2)
            await redisClient.expire(cacheKey, 86400);
            logger.debug('Cache hit', {
                operation: 'get_mapping_by_conv_id',
                conversation_id,
                cache_hit: true
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
        await this.cacheMapping(mapping);

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

    async cacheMapping(mapping: ConversationMapping): Promise<void> {
        const ttl = 86400; // 24 hours (FRD spec)

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

        // Cache by wa_id
        await redisClient.setEx(
            KEYS.mappingWa(mapping.wa_id),
            ttl,
            JSON.stringify(cacheData)
        );

        // Cache by conversation_id (if set)
        if (mapping.conversation_id) {
            await redisClient.setEx(
                KEYS.mappingConv(mapping.conversation_id),
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

    async invalidateCache(wa_id: string, conversation_id?: string): Promise<void> {
        await redisClient.del(KEYS.mappingWa(wa_id));

        if (conversation_id) {
            await redisClient.del(KEYS.mappingConv(conversation_id));
        }

        logger.debug('Cache invalidated', {
            operation: 'invalidate_cache',
            wa_id,
            conversation_id
        });
    }

    // ==================== Legacy Methods (backward compatibility for HTTP API) ====================

    async getMapping(waId: string) {
        // Default method now requires tenantId context - using default env for legacy calls
        const defaultTenantId = 'default';
        const mapping = await this.getMappingByWaId(waId, defaultTenantId);
        if (!mapping) return null;

        return { ...this.formatMapping(mapping), isNew: false };
    }

    async createOrUpdateMapping(data: any) {
        // Default method now requires tenantId context - using default env for legacy calls
        const defaultTenantId = 'default';
        const { waId, contactName, phoneNumberId, displayPhoneNumber } = data;

        const { mapping, isNew } = await this.createMappingForInbound({
            wa_id: waId,
            wamid: data.wamid || `http-${Date.now()}`,
            contact_name: contactName,
            phone_number_id: phoneNumberId,
            display_phone_number: displayPhoneNumber
        }, defaultTenantId);

        return { ...this.formatMapping(mapping), isNew };
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
