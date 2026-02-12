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
  MessageDirection,
  MessageStatus,
  DLQReason,
  ConversationStatus
} from '../types';

// ==================== Operation 1: Inbound Identity Resolution ====================

export async function handleInboundMessage(msg: InboundMessage): Promise<void> {
  const startTime = Date.now();
  const { wa_id, wamid, contact_name, phone_number_id, display_phone_number, media_url } = msg;

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
      });

      // 3. Track inbound message (idempotent)
      await messageService.trackMessage({
        mapping_id: mapping.id,
        wamid,
        direction: MessageDirection.INBOUND,
        status: MessageStatus.RECEIVED,
        media_url
      });

      // 4. Publish to inbound-processed queue
      const enrichedMessage: EnrichedInboundMessage = {
        ...msg,
        mapping_id: mapping.id,
        conversation_id: mapping.conversation_id,
        is_new_conversation: isNew && !mapping.conversation_id
      };

      await rabbitmqService.publishToInboundProcessed(enrichedMessage);

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
  const { conversation_id, genesys_message_id, message_text, media_url } = msg;

  logger.info('Processing outbound message', {
    operation: 'outbound_identity_resolution',
    conversation_id,
    genesys_message_id
  });

  if (!validateMediaUrl(media_url)) {
    logger.error('Invalid media URL', { operation: 'outbound_identity_resolution', conversation_id, genesys_message_id, media_url });
    await rabbitmqService.sendToDLQ(msg, DLQReason.INVALID_MEDIA_URL, `Invalid media URL: ${media_url}`);
    return;
  }

  try {
    // 1. Lookup mapping by conversation_id
    const mapping = await mappingService.getMappingByConversationId(conversation_id);

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
    await messageService.trackMessage({
      mapping_id: mapping.id,
      genesys_message_id,
      direction: MessageDirection.OUTBOUND,
      status: MessageStatus.QUEUED,
      media_url
    });

    // 4. Update activity timestamp
    await mappingService.updateActivity(mapping.id, genesys_message_id);

    // 5. Publish to outbound-processed queue
    const enrichedMessage: EnrichedOutboundMessage = {
      ...msg,
      wa_id: mapping.wa_id,
      mapping_id: mapping.id
    };

    await rabbitmqService.publishToOutboundProcessed(enrichedMessage);

    logger.info('Outbound message processed successfully', {
      operation: 'outbound_identity_resolution',
      conversation_id,
      genesys_message_id,
      wa_id: mapping.wa_id,
      mapping_id: mapping.id,
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
      timestamp: new Date(timestamp)
    });

    if (result.updated) {
      logger.info('Status updated', {
        operation: 'status_update',
        wamid,
        previous_status: result.previous_status,
        new_status: status
      });
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

// ==================== Register All Consumers ====================

export async function registerOperationHandlers(): Promise<void> {
  logger.info('Registering operation handlers...');

  await rabbitmqService.consumeInbound(handleInboundMessage);
  await rabbitmqService.consumeOutbound(handleOutboundMessage);
  await rabbitmqService.consumeStatus(handleStatusUpdate);

  logger.info('All operation handlers registered', {
    handlers: ['inbound', 'outbound', 'status']
  });
}
