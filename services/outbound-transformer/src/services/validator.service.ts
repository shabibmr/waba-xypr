/**
 * Input Validation Service
 * Per FRD Section 5.1 - validates incoming messages from outbound-processed queue
 */

import { InputMessage } from '../types/messages';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WA_ID_REGEX = /^[1-9][0-9]{6,14}$/;
const PHONE_NUMBER_ID_REGEX = /^[0-9]+$/;
const MIN_TIMESTAMP = 1000000000;
const MAX_TIMESTAMP = 9999999999;
const MAX_TEXT_LENGTH = 4096;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateInputMessage(message: unknown): ValidationResult {
  const errors: string[] = [];

  if (!message || typeof message !== 'object') {
    return { valid: false, errors: ['Message must be a non-null object'] };
  }

  const msg = message as Record<string, unknown>;

  // Required string fields
  if (!msg.internalId || typeof msg.internalId !== 'string') {
    errors.push('internalId is required and must be a string');
  } else if (!UUID_V4_REGEX.test(msg.internalId as string)) {
    errors.push('internalId must be a valid UUID v4');
  }

  if (!msg.tenantId || typeof msg.tenantId !== 'string') {
    errors.push('tenantId is required and must be a string');
  } else if ((msg.tenantId as string).trim().length === 0) {
    errors.push('tenantId must be non-empty');
  }

  if (!msg.conversationId || typeof msg.conversationId !== 'string') {
    errors.push('conversationId is required and must be a string');
  } else if ((msg.conversationId as string).length < 1 || (msg.conversationId as string).length > 255) {
    errors.push('conversationId must be 1-255 characters');
  }

  if (!msg.genesysId || typeof msg.genesysId !== 'string') {
    errors.push('genesysId is required and must be a string');
  } else if ((msg.genesysId as string).length < 1 || (msg.genesysId as string).length > 255) {
    errors.push('genesysId must be 1-255 characters');
  }

  if (!msg.waId || typeof msg.waId !== 'string') {
    errors.push('waId is required and must be a string');
  } else if (!WA_ID_REGEX.test(msg.waId as string)) {
    errors.push('waId must match E.164 format without +: 7-15 digits starting with non-zero');
  }

  if (!msg.phoneNumberId || typeof msg.phoneNumberId !== 'string') {
    errors.push('phoneNumberId is required and must be a string');
  } else if (!PHONE_NUMBER_ID_REGEX.test(msg.phoneNumberId as string)) {
    errors.push('phoneNumberId must be a numeric string');
  }

  // Timestamp
  if (msg.timestamp === undefined || msg.timestamp === null) {
    errors.push('timestamp is required');
  } else if (typeof msg.timestamp !== 'number' || !Number.isFinite(msg.timestamp)) {
    errors.push('timestamp must be a finite number');
  } else if (msg.timestamp < MIN_TIMESTAMP || msg.timestamp > MAX_TIMESTAMP) {
    errors.push(`timestamp must be between ${MIN_TIMESTAMP} and ${MAX_TIMESTAMP} (Unix epoch seconds)`);
  }

  // Type
  if (msg.type !== 'message') {
    errors.push("type must be 'message'");
  }

  // Payload
  if (!msg.payload || typeof msg.payload !== 'object') {
    errors.push('payload is required and must be an object');
  } else {
    const payload = msg.payload as Record<string, unknown>;
    const hasText = payload.text !== undefined && payload.text !== null;
    const hasMedia = payload.media !== undefined && payload.media !== null;

    if (!hasText && !hasMedia) {
      errors.push('payload must contain at least text or media');
    }

    if (hasText) {
      if (typeof payload.text !== 'string') {
        errors.push('payload.text must be a string');
      } else {
        const trimmed = (payload.text as string).trim();
        if (trimmed.length === 0) {
          errors.push('payload.text must be non-empty after trimming');
        } else if (trimmed.length > MAX_TEXT_LENGTH) {
          errors.push(`payload.text must not exceed ${MAX_TEXT_LENGTH} characters`);
        }
      }
    }

    if (hasMedia) {
      if (typeof payload.media !== 'object') {
        errors.push('payload.media must be an object');
      } else {
        const media = payload.media as Record<string, unknown>;
        if (!media.url || typeof media.url !== 'string') {
          errors.push('payload.media.url is required and must be a string');
        }
        if (!media.mime_type || typeof media.mime_type !== 'string') {
          errors.push('payload.media.mime_type is required and must be a string');
        }
        if (media.filename !== undefined && typeof media.filename !== 'string') {
          errors.push('payload.media.filename must be a string if provided');
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
