/**
 * MIME Type to WhatsApp Message Type Mapping
 * Per FRD Section 3.3 + Appendix A
 */

import { WhatsAppMessageType } from '../types/messages';

const MIME_TYPE_MAP: Record<string, WhatsAppMessageType> = {
  // Image types
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',

  // Video types
  'video/mp4': 'video',
  'video/3gpp': 'video',

  // Document types
  'application/pdf': 'document',
  'application/vnd.ms-powerpoint': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'text/plain': 'document',
  'text/csv': 'document',

  // Audio types
  'audio/aac': 'audio',
  'audio/mp4': 'audio',
  'audio/mpeg': 'audio',
  'audio/amr': 'audio',
  'audio/ogg': 'audio',
};

/**
 * Get WhatsApp message type from MIME type
 * @param mimeType - MIME type string (case-insensitive)
 * @returns WhatsApp message type or null if unsupported
 */
export function getWhatsAppType(mimeType: string): WhatsAppMessageType | null {
  return MIME_TYPE_MAP[mimeType.toLowerCase().trim()] || null;
}

/**
 * Check if a MIME type is supported
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return getWhatsAppType(mimeType) !== null;
}

export { MIME_TYPE_MAP };
