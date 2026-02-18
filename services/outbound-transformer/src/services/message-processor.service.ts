/**
 * Message Processor Service - Rewritten per FRD
 * Reads from new enriched InputMessage schema (no external lookups needed)
 * Transforms via transformer service, dispatches via dispatcher service
 */

import { InputMessage } from '../types/messages';
import { transformMessage } from './transformer.service';
import { publishToQueue } from './dispatcher.service';
import config from '../config';

/**
 * Process a validated InputMessage:
 * 1. Transform to WhatsApp format with metadata envelope
 * 2. Publish to outbound.ready.msg queue.
 */
export async function processOutboundMessage(message: InputMessage): Promise<void> {
  console.log(`Processing outbound message: ${message.internalId} [tenant=${message.tenantId}]`);

  // Transform to WhatsApp format (may return single or array for audio+text)
  const transformed = transformMessage(message);

  // Dispatch (handles single and array)
  await publishToQueue(config.rabbitmq.outputQueue, transformed);

  console.log(`Message dispatched: ${message.internalId}`);
}
