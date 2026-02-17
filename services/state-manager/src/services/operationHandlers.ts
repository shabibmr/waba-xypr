import { randomUUID } from 'crypto';
import mappingService from './mappingService';
import messageService from './messageService';
import lockService from './lockService';
import { rabbitmqService } from './rabbitmq.service';
import logger from '../utils/logger';
import { validateE164, validateMediaUrl } from '../utils/validation';
import {
  InboundMessage,
  OutboundMessage,
  StatusUpdate,
  EnrichedInboundMessage,
  EnrichedOutboundMessage,
  GenesysStatusEvent,
  EnrichedGenesysStatusEvent,
  MessageDirection,
  MessageStatus,
  DLQReason,
  ConversationStatus,
  ConversationCorrelation
} from '../types';

// Genesys status values that map to DB message statuses
const GENESYS_STATUS_TO_DB: Partial<Record<string, MessageStatus>> = {
  delivered: MessageStatus.DELIVERED,
  read: MessageStatus.READ,
  published: MessageStatus.PUBLISHED,
  failed: MessageStatus.FAILED,
};

// ==================== Operation 1: Inbound Identity Resolution ====================

export async function handleInboundMessage(msg: InboundMessage): Promise<void> {
  const startTime = Date.now();
  const { wa_id, wamid, contact_name, phone_number_id, display_phone_number, media_url, message_text } = msg;

  logger.info('Processing inbound message', {
    operation: 'inbound_identity_resolution',
    wa_id,
    wamid
  });

  if (!validateE164(wa_id)) {
    logger.error('Invalid wa_id format', { operation: 'inbound_identity_resolution', wa_id, wamid });
    await rabbitmqService.sendToDLQ(msg, DLQReason.INVALID_PAYLOAD, `Invalid wa_id format: ${wa_id}`);
    return;
  }

  if (!validateMediaUrl(media_url)) {
    logger.error('Invalid media URL', { operation: 'inbound_identity_resolution', wa_id, wamid, media_url });
    await rabbitmqService.sendToDLQ(msg, DLQReason.INVALID_MEDIA_URL, `Invalid media URL: ${media_url}`);
    return;
  }

  try {
    // 1. Acquire distributed lock
    const lockAcquired = await lockService.withLockRetry(wa_id);
    if (!lockAcquired) {
      logger.error('Failed to acquire lock', {
        operation: 'inbound_identity_resolution',
        wa_id,
        wamid
      });
      await rabbitmqService.sendToDLQ(msg, DLQReason.LOCK_TIMEOUT, 'Failed to acquire lock after retries');
      return;
    }

    try {
      // 2. Create or update mapping
      const { mapping, isNew } = await mappingService.createMappingForInbound({
        wa_id,
        wamid,
        contact_name,
        phone_number_id,
        display_phone_number
      }, msg.tenantId);

      // 3. Track inbound message (idempotent)
      await messageService.trackMessage({
        mapping_id: mapping.id,
        wamid,
        direction: MessageDirection.INBOUND,
        status: MessageStatus.RECEIVED,
        media_url,
        metadata: message_text ? { text: message_text } : undefined,
        tenantId: msg.tenantId
      });

      // 4. Publish to inbound-processed queue
      const enrichedMessage: EnrichedInboundMessage = {
        ...msg,
        mapping_id: mapping.id,
        conversation_id: mapping.conversation_id,
        is_new_conversation: isNew && !mapping.conversation_id
      };

      logger.info('Publishing enriched inbound message', { payload: JSON.stringify(enrichedMessage, null, 2) });

      await rabbitmqService.publishToInboundProcessed(enrichedMessage);

      // 5. Emit real-time event to agent portal
      await rabbitmqService.publishAgentPortalEvent('new_message', msg.tenantId, {
        conversationId: mapping.conversation_id,
        messageId: wamid,
        from: wa_id,
        from_name: contact_name,
        message: message_text,
        media_url,
        timestamp: new Date().toISOString(),
        isNewConversation: isNew && !mapping.conversation_id
      });

      logger.info('Inbound message processed successfully', {
        operation: 'inbound_identity_resolution',
        wa_id,
        wamid,
        mapping_id: mapping.id,
        conversation_id: mapping.conversation_id,
        is_new: isNew,
        duration_ms: Date.now() - startTime
      });

    } finally {
      // 5. Release lock
      await lockService.releaseLock(wa_id);
    }

  } catch (error: any) {
    logger.error('Inbound processing failed', {
      operation: 'inbound_identity_resolution',
      wa_id,
      wamid,
      error: error.message,
      stack: error.stack
    });
    throw error; // RabbitMQ will requeue
  }
}

// ==================== Operation 2: Outbound Identity Resolution ====================

export async function handleOutboundMessage(msg: OutboundMessage): Promise<void> {
  const startTime = Date.now();
  const { conversation_id, genesys_message_id, message_text, media, tenantId, timestamp } = msg;

  logger.info('Processing outbound message', {
    operation: 'outbound_identity_resolution',
    conversation_id,
    genesys_message_id
  });

  if (media && media.url && !validateMediaUrl(media.url)) {
    logger.error('Invalid media URL', { operation: 'outbound_identity_resolution', conversation_id, genesys_message_id, media_url: media.url });
    await rabbitmqService.sendToDLQ(msg, DLQReason.INVALID_MEDIA_URL, `Invalid media URL: ${media.url}`);
    return;
  }

  try {
    // 1. Lookup mapping by conversation_id
    const mapping = await mappingService.getMappingByConversationId(conversation_id, tenantId);

    if (!mapping) {
      logger.error('No active mapping found', {
        operation: 'outbound_identity_resolution',
        conversation_id
      });
      await rabbitmqService.sendToDLQ(
        msg,
        DLQReason.MAPPING_NOT_FOUND,
        `No active mapping for conversation_id=${conversation_id}`
      );
      return;
    }

    // 2. Validate mapping status
    if (mapping.status !== ConversationStatus.ACTIVE) {
      logger.warn('Mapping not active', {
        operation: 'outbound_identity_resolution',
        conversation_id,
        status: mapping.status
      });
      await rabbitmqService.sendToDLQ(
        msg,
        mapping.status === ConversationStatus.EXPIRED
          ? DLQReason.MAPPING_STATUS_EXPIRED
          : DLQReason.MAPPING_STATUS_CLOSED,
        `Mapping status is ${mapping.status}`
      );
      return;
    }

    // 3. Track outbound message
    const { messageId: trackedMessageId } = await messageService.trackMessage({
      mapping_id: mapping.id,
      genesys_message_id,
      direction: MessageDirection.OUTBOUND,
      status: MessageStatus.QUEUED,
      media_url: media && media.url ? media.url : undefined,
      metadata: message_text ? { text: message_text } : undefined,
      tenantId
    });

    // 4. Update activity timestamp with the tracked message UUID
    await mappingService.updateActivity(mapping.id, trackedMessageId, tenantId);

    // Guard: phoneNumberId must be present for outbound-transformer delivery
    if (!mapping.phone_number_id) {
      logger.error('No phone_number_id on mapping', {
        operation: 'outbound_identity_resolution',
        conversation_id
      });
      await rabbitmqService.sendToDLQ(
        msg,
        DLQReason.MISSING_PHONE_NUMBER_ID,
        `No phone_number_id on mapping for conversation_id=${conversation_id}`
      );
      return;
    }

    // 5. Publish to outbound-processed queue — shape matches outbound-transformer InputMessage
    const tsEpoch = timestamp
      ? Math.floor(new Date(timestamp).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    const enrichedMessage: EnrichedOutboundMessage = {
      internalId: randomUUID(),
      tenantId,
      conversationId: conversation_id,
      genesysId: genesys_message_id,
      waId: mapping.wa_id,
      phoneNumberId: mapping.phone_number_id,
      timestamp: tsEpoch,
      type: 'message',
      payload: {
        text: message_text,
        ...(media ? {
          media: {
            url: media.url,
            mime_type: media.contentType,
            filename: media.filename,
          }
        } : {}),
      },
    };

    await rabbitmqService.publishToOutboundProcessed(enrichedMessage);

    // 6. Emit real-time event to agent portal
    await rabbitmqService.publishAgentPortalEvent('conversation_update', tenantId, {
      id: conversation_id,
      conversationId: conversation_id,
      lastMessage: message_text,
      lastMessageAt: new Date().toISOString(),
      direction: 'outbound'
    });

    logger.info('Outbound message processed successfully', {
      operation: 'outbound_identity_resolution',
      conversation_id,
      genesys_message_id,
      wa_id: mapping.wa_id,
      internalId: enrichedMessage.internalId,
      duration_ms: Date.now() - startTime
    });

  } catch (error: any) {
    logger.error('Outbound processing failed', {
      operation: 'outbound_identity_resolution',
      conversation_id,
      genesys_message_id,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// ==================== Operation 3: Status Update from WhatsApp ====================

export async function handleStatusUpdate(msg: StatusUpdate): Promise<void> {
  const { wamid, status, timestamp } = msg;

  logger.debug('Processing status update', {
    operation: 'status_update',
    wamid,
    status
  });

  try {
    const result = await messageService.updateStatus({
      wamid,
      new_status: status,
      timestamp: new Date(timestamp),
      tenantId: msg.tenantId
    });

    if (result.updated) {
      logger.info('Status updated', {
        operation: 'status_update',
        wamid,
        previous_status: result.previous_status,
        new_status: status
      });

      // 1. Get conversation details to enrich the status event
      const mapping = await messageService.getConversationByWamid(wamid, msg.tenantId);

      if (mapping && mapping.conversation_id) {
        // 2. Publish to inbound.status.evt for Genesys consumption
        await rabbitmqService.publishToInboundStatus({
          tenantId: msg.tenantId,
          conversationId: mapping.conversation_id,
          messageId: mapping.genesys_message_id || wamid, // Use genesys ID if available, else wamid
          whatsappMessageId: wamid,
          status: status,
          timestamp: new Date(timestamp).toISOString()
        });
      } else {
        logger.warn('Could not resolve conversation for status update', {
          operation: 'status_update',
          wamid,
          tenantId: msg.tenantId
        });
      }

      // Emit real-time status update to agent portal
      if (msg.tenantId) {
        await rabbitmqService.publishAgentPortalEvent('status_update', msg.tenantId, {
          messageId: wamid,
          status,
          timestamp: new Date(timestamp).toISOString()
        });
      }
    } else {
      logger.debug('Status not updated', {
        operation: 'status_update',
        wamid,
        status,
        reason: 'invalid_transition_or_stale'
      });
    }

  } catch (error: any) {
    logger.error('Status update failed', {
      operation: 'status_update',
      wamid,
      status,
      error: error.message
    });
    throw error;
  }
}

// ==================== Operation 4: Correlation Event ====================

export async function handleCorrelationEvent(msg: ConversationCorrelation): Promise<void> {
  const { conversation_id, communication_id, whatsapp_message_id, tenantId } = msg;

  logger.info('Processing correlation event', {
    operation: 'correlation_event',
    conversation_id,
    whatsapp_message_id,
    tenantId
  });

  try {
    const mapping = await mappingService.correlateConversation({
      conversation_id,
      communication_id,
      whatsapp_message_id
    }, tenantId);

    if (mapping) {
      logger.info('Correlation successful', {
        operation: 'correlation_event',
        mapping_id: mapping.id,
        wa_id: mapping.wa_id
      });

      // Emit conversation update event to agent portal
      await rabbitmqService.publishAgentPortalEvent('conversation_update', tenantId, {
        id: conversation_id,
        conversationId: conversation_id,
        waId: mapping.wa_id,
        status: 'active',
        correlated: true
      });
    } else {
      logger.warn('Correlation failed - mapping not found or already correlated', {
        operation: 'correlation_event',
        conversation_id
      });
    }
  } catch (error: any) {
    logger.error('Correlation event failed', {
      operation: 'correlation_event',
      error: error.message
    });
    throw error;
  }
}

// ==================== Operation 5: Genesys Status Event ====================

export async function handleGenesysStatusEvent(msg: GenesysStatusEvent): Promise<void> {
  const { tenantId, genesysId, originalMessageId, status, timestamp } = msg;

  logger.info('Processing Genesys status event', {
    operation: 'genesys_status_event',
    tenantId,
    genesysId,
    originalMessageId,
    status
  });

  // 1. Update DB status if this status maps to a tracked MessageStatus
  const dbStatus = GENESYS_STATUS_TO_DB[status];
  if (dbStatus) {
    const result = await messageService.updateStatus({
      genesys_message_id: originalMessageId,
      new_status: dbStatus,
      timestamp: new Date(timestamp),
      tenantId
    });

    if (result.updated) {
      logger.info('Message status updated from Genesys receipt', {
        operation: 'genesys_status_event',
        originalMessageId,
        previous_status: result.previous_status,
        new_status: dbStatus
      });
    }
  }

  // 2. Resolve conversation_id so genesys-api-service can call the receipts endpoint
  const mapping = await messageService.getConversationByGenesysMessageId(originalMessageId, tenantId);
  const conversation_id = mapping?.conversation_id ?? null;

  if (!conversation_id) {
    logger.warn('Could not resolve conversation_id for Genesys status event', {
      operation: 'genesys_status_event',
      genesysId,
      originalMessageId
    });
  }

  // 3. Publish enriched event to genesys-status-processed
  const enriched: EnrichedGenesysStatusEvent = {
    tenantId,
    genesysId,
    originalMessageId,
    status,
    timestamp,
    conversation_id
  };

  await rabbitmqService.publishToGenesysStatusProcessed(enriched);

  logger.info('Genesys status event forwarded to genesys-status-processed', {
    operation: 'genesys_status_event',
    tenantId,
    genesysId,
    conversation_id
  });
}

// ==================== Register All Consumers ====================

export async function registerOperationHandlers(): Promise<void> {
  logger.info('Registering operation handlers...');

  await rabbitmqService.consumeInbound(handleInboundMessage);
  await rabbitmqService.consumeOutbound(handleOutboundMessage);
  await rabbitmqService.consumeStatus(handleStatusUpdate);
  await rabbitmqService.consumeCorrelation(handleCorrelationEvent);
  await rabbitmqService.consumeGenesysStatus(handleGenesysStatusEvent);

  logger.info('All operation handlers registered', {
    handlers: ['inbound', 'outbound', 'status', 'correlation', 'genesys-status']
  });
}
