import pool from '../config/database.js';
import redisClient from '../config/redis.js';
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import { KEYS } from '../../../shared/constants.js';

class MappingService {
    async getMapping(waId: string) {
        const cacheKey = KEYS.mappingWa(waId);
        const cached = await redisClient.get(cacheKey);

        if (cached) {
            return { ...JSON.parse(cached), isNew: false };
        }

        const result = await pool.query(
            'SELECT * FROM conversation_mappings WHERE wa_id = $1',
            [waId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const mapping = result.rows[0];
        await this.cacheMapping(mapping);

        return this.formatMapping(mapping);
    }

    async createOrUpdateMapping(data: any) {
        const { waId, contactName, phoneNumberId, displayPhoneNumber } = data;
        const existing = await this.getMapping(waId);

        if (existing) {
            await pool.query(
                `UPDATE conversation_mappings 
         SET contact_name = COALESCE($2, contact_name),
             updated_at = CURRENT_TIMESTAMP
         WHERE wa_id = $1`,
                [waId, contactName]
            );

            const updated = { ...existing, contactName: contactName || existing.contactName };
            // Update cache
            await this.cacheMapping({
                wa_id: waId,
                conversation_id: existing.conversationId,
                contact_name: updated.contactName,
                phone_number_id: phoneNumberId || existing.phoneNumberId,
                display_phone_number: displayPhoneNumber || existing.displayPhoneNumber
            });

            return { ...updated, isNew: false };
        }

        const conversationId = `whatsapp-${uuidv4()}`;
        const result = await pool.query(
            `INSERT INTO conversation_mappings 
       (wa_id, conversation_id, contact_name, phone_number_id, display_phone_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [waId, conversationId, contactName, phoneNumberId, displayPhoneNumber]
        );

        const mapping = result.rows[0];
        await this.cacheMapping(mapping);

        return { ...this.formatMapping(mapping), isNew: true };
    }

    async getMappingByConversationId(conversationId: string) {
        const cacheKey = KEYS.mappingConv(conversationId);
        const cached = await redisClient.get(cacheKey);

        if (cached) {
            return JSON.parse(cached);
        }

        const result = await pool.query(
            'SELECT * FROM conversation_mappings WHERE conversation_id = $1',
            [conversationId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const mapping = result.rows[0];
        await this.cacheMapping(mapping);

        return this.formatMapping(mapping);
    }

    async cacheMapping(mapping: any) {
        const cacheData = this.formatMapping(mapping);
        const ttl = 3600;

        await redisClient.setEx(KEYS.mappingWa(mapping.wa_id), ttl, JSON.stringify(cacheData));
        await redisClient.setEx(KEYS.mappingConv(mapping.conversation_id), ttl, JSON.stringify(cacheData));
    }

    formatMapping(mapping: any) {
        return {
            waId: mapping.wa_id,
            conversationId: mapping.conversation_id,
            contactName: mapping.contact_name,
            phoneNumberId: mapping.phone_number_id,
            displayPhoneNumber: mapping.display_phone_number
        };
    }
}

export default new MappingService();
