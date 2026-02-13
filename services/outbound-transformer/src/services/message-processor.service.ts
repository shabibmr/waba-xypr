/**
 * Message Processor Service - Rewritten per FRD
 * Reads from new enriched InputMessage schema (no external lookups needed)
 * Transforms via transformer service, dispatches via dispatcher service
 */

import { InputMessage } from '../types/messages';
import { transformMessage } from './transformer.service';
import { dispatch } from './dispatcher.service';

/**
 * Process a validated InputMessage:
 * 1. Transform to WhatsApp format with metadata envelope
 * 2. Dispatch to outbound-ready queue (or HTTP in pipeline mode)
 */
export async function processOutboundMessage(message: InputMessage): Promise<void> {
  console.log(`Processing outbound message: ${message.internalId} [tenant=${message.tenantId}]`);

  // Transform to WhatsApp format (may return single or array for audio+text)
  const transformed = transformMessage(message);

  // Dispatch (handles single and array)
  await dispatch(transformed);

  console.log(`Message dispatched: ${message.internalId}`);
}
