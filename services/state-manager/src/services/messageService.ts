console.log('DEBUG: messageService.ts module loading');
import pool from '../config/database';
import tenantConnectionFactory from './tenantConnectionFactory';
import logger from '../utils/logger';
import {
  MessageTracking,
  MessageDirection,
  MessageStatus,
  isValidStateTransition,
  MESSAGE_STATE_TRANSITIONS
} from '../types';

class MessageService {

  // ==================== Idempotent Message Tracking ====================

  constructor() {
    logger.info('DEBUG: MessageService loaded with meta_message_id fix');
  }

  async trackMessage(data: {
    mapping_id: string;
    wamid?: string;
    genesys_message_id?: string;
    direction: MessageDirection;
    status: MessageStatus;
    media_url?: string;
    metadata?: Record<string, any>;
    tenantId?: string;
  }): Promise<{ messageId: string; created: boolean }> {

    const { mapping_id, wamid, genesys_message_id, direction, status, media_url, metadata, tenantId } = data;

    if (!wamid && !genesys_message_id) {
      throw new Error('Either wamid or genesys_message_id is required');
    }

    logger.debug('Tracking message', {
      operation: 'track_message',
      wamid,
      genesys_message_id,
      direction,
      status
    });

    const db = tenantId ? await tenantConnectionFactory.getConnection(tenantId) : pool;

    // Idempotent insert if wamid is provided
    if (wamid) {
      const result = await db.query<MessageTracking & { is_insert: boolean }>(
        `INSERT INTO message_tracking
         (mapping_id, meta_message_id, genesys_message_id, direction, status, media_url, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (meta_message_id) DO NOTHING
         RETURNING *, (xmax = 0) AS is_insert`,
        [mapping_id, wamid, genesys_message_id, direction, status, media_url, metadata ? JSON.stringify(metadata) : null]
      );

      if (result.rows.length === 0) {
        // Conflict occurred - message already tracked
        logger.warn('Duplicate wamid, message already tracked', {
          operation: 'track_message',
          wamid,
          direction
        });

        // Fetch existing message
        const existing = await db.query<MessageTracking>(
          'SELECT * FROM message_tracking WHERE meta_message_id = $1',
          [wamid]
        );

        return { messageId: existing.rows[0].id, created: false };
      }

      const message = result.rows[0];
      logger.info('Message tracked', {
        operation: 'track_message',
        message_id: message.id,
        wamid,
        direction,
        status,
        created: message.is_insert
      });

      return { messageId: message.id, created: message.is_insert };
    }

    // No wamid - simple insert (outbound without wamid)
    const result = await db.query<MessageTracking>(
      `INSERT INTO message_tracking
       (mapping_id, genesys_message_id, direction, status, media_url, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [mapping_id, genesys_message_id, direction, status, media_url, metadata ? JSON.stringify(metadata) : null]
    );

    logger.info('Message tracked (no wamid)', {
      operation: 'track_message',
      message_id: result.rows[0].id,
      genesys_message_id,
      direction,
      status
    });

    return { messageId: result.rows[0].id, created: true };
  }

  // ==================== Status Update with State Machine ====================

  async updateStatus(data: {
    wamid?: string;
    genesys_message_id?: string;
    new_status: MessageStatus;
    timestamp: Date;
    tenantId?: string;
  }): Promise<{ updated: boolean; previous_status?: MessageStatus }> {

    const { wamid, genesys_message_id, new_status, timestamp, tenantId } = data;

    logger.debug('Updating message status', {
      operation: 'update_status',
      wamid,
      genesys_message_id,
      new_status
    });

    const db = tenantId ? await tenantConnectionFactory.getConnection(tenantId) : pool;

    // 1. Fetch current message
    let query = 'SELECT * FROM message_tracking WHERE ';
    let params: any[];

    if (wamid) {
      query += 'meta_message_id = $1';
      params = [wamid];
    } else if (genesys_message_id) {
      query += 'genesys_message_id = $1';
      params = [genesys_message_id];
    } else {
      throw new Error('Either wamid or genesys_message_id is required');
    }

    const result = await db.query<MessageTracking>(query, params);

    if (result.rows.length === 0) {
      logger.warn('Status update for unknown message', {
        operation: 'update_status',
        wamid,
        genesys_message_id,
        new_status
      });
      return { updated: false };
    }

    const message = result.rows[0];
    const current_status = message.status as MessageStatus;

    // 2. Validate state transition
    if (!isValidStateTransition(current_status, new_status)) {
      logger.warn('Invalid state transition', {
        operation: 'update_status',
        wamid,
        current_status,
        new_status,
        valid_transitions: MESSAGE_STATE_TRANSITIONS[current_status]
      });
      return { updated: false, previous_status: current_status };
    }

    // 3. Check timestamp (prevent stale updates)
    if (new Date(timestamp) <= new Date(message.updated_at)) {
      logger.info('Ignoring stale status update', {
        operation: 'update_status',
        wamid,
        event_timestamp: timestamp,
        current_timestamp: message.updated_at
      });
      return { updated: false, previous_status: current_status };
    }

    // 4. Optimistic locking update
    const updateResult = await db.query(
      `UPDATE message_tracking
       SET status = $1, updated_at = $2
       WHERE id = $3 AND status = $4
       RETURNING *`,
      [new_status, timestamp, message.id, current_status]
    );

    if (updateResult.rows.length === 0) {
      logger.info('Status already updated (race condition)', {
        operation: 'update_status',
        wamid,
        message_id: message.id
      });
      return { updated: false, previous_status: current_status };
    }

    logger.info('Message status updated successfully', {
      operation: 'update_status',
      wamid,
      message_id: message.id,
      previous_status: current_status,
      new_status
    });

    return { updated: true, previous_status: current_status };
  }

  // ==================== Legacy Methods (backward compatibility for HTTP API) ====================

  async trackMessageLegacy(data: any) {
    const { wamid, mappingId, genesysMessageId, direction, status, mediaUrl } = data;

    const result = await this.trackMessage({
      mapping_id: mappingId,
      wamid,
      genesys_message_id: genesysMessageId || null,
      direction: direction || MessageDirection.INBOUND,
      status: status || MessageStatus.RECEIVED,
      media_url: mediaUrl || null
    });

    return {
      success: true,
      duplicate: !result.created,
      id: result.messageId
    };
  }

  async updateStatusLegacy(wamid: string, newStatus: string, genesysMessageId?: string, tenantId?: string) {
    const targetStatus = newStatus as MessageStatus;

    const db = tenantId ? await tenantConnectionFactory.getConnection(tenantId) : pool;

    // Fetch current to validate first
    const current = await db.query(
      'SELECT id, status FROM message_tracking WHERE meta_message_id = $1',
      [wamid]
    );

    if (current.rows.length === 0) {
      return { success: false, error: 'Message not found' };
    }

    const currentStatus = current.rows[0].status as MessageStatus;

    if (!isValidStateTransition(currentStatus, targetStatus)) {
      return { success: false, error: `Invalid transition from ${currentStatus} to ${targetStatus}` };
    }

    // Update with optional genesys_message_id
    let query = `UPDATE message_tracking
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP,
           delivered_at = CASE WHEN $1 = 'delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END`;

    const params: any[] = [newStatus, wamid];
    let paramIndex = 3;

    if (genesysMessageId) {
      query += `, genesys_message_id = $${paramIndex}`;
      params.push(genesysMessageId);
      paramIndex++;
    }

    query += ` WHERE meta_message_id = $2`;

    await db.query(query, params);

    logger.info('Message status updated (legacy)', { operation: 'updateStatusLegacy', wamid, status: newStatus });
    return { success: true };
  }

  async getMessagesByMappingId(mappingId: string, limit = 50, offset = 0, tenantId?: string) {
    const db = tenantId ? await tenantConnectionFactory.getConnection(tenantId) : pool;

    const [dataResult, countResult] = await Promise.all([
      db.query(
        `SELECT * FROM message_tracking
         WHERE mapping_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [mappingId, limit, offset]
      ),
      db.query(
        'SELECT COUNT(*)::int AS total FROM message_tracking WHERE mapping_id = $1',
        [mappingId]
      )
    ]);

    const messages = dataResult.rows.map((row: any) => ({
      id: row.id,
      wamid: row.meta_message_id,
      genesysMessageId: row.genesys_message_id,
      mappingId: row.mapping_id,
      direction: row.direction,
      status: row.status,
      mediaUrl: row.media_url,
      text: row.metadata?.text || row.metadata?.body?.text || row.metadata?.message || '',
      metadata: row.metadata || null,
      timestamp: row.created_at,
      deliveredAt: row.delivered_at
    }));

    return {
      messages,
      total: countResult.rows[0].total,
      limit,
      offset
    };
  }

  async getMessagesByConversation(conversationId: string, limit = 50, offset = 0, tenantId?: string) {
    const db = tenantId ? await tenantConnectionFactory.getConnection(tenantId) : pool;

    const mappingResult = await db.query(
      "SELECT id FROM conversation_mappings WHERE conversation_id = $1 AND status = 'active'",
      [conversationId]
    );

    if (mappingResult.rows.length === 0) {
      return { messages: [], total: 0, limit, offset };
    }

    const mapping_id = mappingResult.rows[0].id;
    return this.getMessagesByMappingId(mapping_id, limit, offset, tenantId);
  }

  async getMessageByWamid(wamid: string, tenantId?: string) {
    const db = tenantId ? await tenantConnectionFactory.getConnection(tenantId) : pool;

    const result = await db.query(
      'SELECT * FROM message_tracking WHERE meta_message_id = $1',
      [wamid]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async getConversationByGenesysMessageId(
    genesysMessageId: string,
    tenantId?: string
  ): Promise<{ conversation_id: string | null; mapping_id: string } | null> {
    const db = tenantId ? await tenantConnectionFactory.getConnection(tenantId) : pool;

    const result = await db.query(
      `SELECT cm.conversation_id, mt.mapping_id
       FROM message_tracking mt
       JOIN conversation_mappings cm ON cm.id = mt.mapping_id
       WHERE mt.genesys_message_id = $1
       LIMIT 1`,
      [genesysMessageId]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  async getConversationByWamid(
    wamid: string,
    tenantId?: string
  ): Promise<{ conversation_id: string | null; mapping_id: string; genesys_message_id: string | null; wa_id: string } | null> {
    const db = tenantId ? await tenantConnectionFactory.getConnection(tenantId) : pool;

    const result = await db.query(
      `SELECT cm.conversation_id, cm.wa_id, mt.mapping_id, mt.genesys_message_id
       FROM message_tracking mt
       JOIN conversation_mappings cm ON cm.id = mt.mapping_id
       WHERE mt.meta_message_id = $1
       LIMIT 1`,
      [wamid]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  /**
   * Update the WAMID on a tracked message by its Genesys ID.
   * This is called when whatsapp-api-service confirms delivery to Meta.
   */
  async updateWamid(genesys_message_id: string, wamid: string, tenantId?: string): Promise<boolean> {
    logger.debug('Updating WAMID for outbound message', {
      operation: 'update_wamid',
      genesys_message_id,
      wamid
    });

    const db = tenantId ? await tenantConnectionFactory.getConnection(tenantId) : pool;

    try {
      const result = await db.query(
        `UPDATE message_tracking
         SET meta_message_id = $1, updated_at = NOW()
         WHERE genesys_message_id = $2
         RETURNING *`,
        [wamid, genesys_message_id]
      );

      if (result.rows.length === 0) {
        logger.warn('Failed to update WAMID (message not found)', {
          operation: 'update_wamid',
          genesys_message_id,
          wamid
        });
        return false;
      }

      logger.info('WAMID updated successfully', {
        operation: 'update_wamid',
        genesys_message_id,
        wamid,
        message_id: result.rows[0].id
      });

      return true;
    } catch (error: any) {
      if (error.code === '23505') { // unique_violation
        logger.warn('WAMID already exists (duplicate ack)', {
          operation: 'update_wamid',
          genesys_message_id,
          wamid
        });
        return true; // Treat duplicate as success
      }
      throw error;
    }
  }
}

export default new MessageService();
