/**
 * Transformer Service - Rewritten per FRD
 * Converts enriched InputMessage to OutputMessage with { metadata, wabaPayload } envelope
 */

import { InputMessage, OutputMessage, WabaPayload, WhatsAppMessageType } from '../types/messages';
import { getWhatsAppType } from '../config/mime-types';
import { extractFilenameFromUrl } from '../utils/url.utils';
import config from '../config';

const MAX_CAPTION_LENGTH = 1024;

/**
 * Build the metadata portion of the output message
 */
function buildMetadata(input: InputMessage) {
  return {
    tenantId: input.tenantId,
    phoneNumberId: input.phoneNumberId,
    internalId: input.internalId,
    correlationId: input.genesysId,
  };
}

/**
 * Transform a text-only message
 */
function transformText(input: InputMessage): OutputMessage {
  const text = input.payload.text!.trim();

  return {
    metadata: buildMetadata(input),
    wabaPayload: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.waId,
      type: 'text',
      text: { body: text },
    },
  };
}

/**
 * Transform a media message
 */
function transformMedia(input: InputMessage): OutputMessage | OutputMessage[] {
  const media = input.payload.media!;
  const waType = getWhatsAppType(media.mime_type);

  if (!waType) {
    return handleUnsupportedMime(input);
  }

  return buildMediaOutput(input, waType);
}

/**
 * Handle unsupported MIME types per UNSUPPORTED_MIME_BEHAVIOR config
 */
function handleUnsupportedMime(input: InputMessage): OutputMessage | OutputMessage[] {
  const behavior = config.behavior.unsupportedMime;
  const media = input.payload.media!;

  switch (behavior) {
    case 'convert_to_document':
      console.warn(`Unsupported MIME type "${media.mime_type}" converted to document for message ${input.internalId}`);
      return buildMediaOutput(input, 'document');

    case 'text_fallback':
      if (input.payload.text) {
        console.warn(`Unsupported MIME type "${media.mime_type}" dropped, sending text fallback for message ${input.internalId}`);
        return transformText(input);
      }
      // No text to fallback to - reject
      throw new Error(`Unsupported MIME type "${media.mime_type}" and no text for fallback`);

    case 'reject':
    default:
      throw new Error(`Unsupported MIME type: ${media.mime_type}`);
  }
}

/**
 * Build media output message with correct WhatsApp type, caption, and filename rules
 */
function buildMediaOutput(input: InputMessage, waType: WhatsAppMessageType): OutputMessage | OutputMessage[] {
  const media = input.payload.media!;
  const metadata = buildMetadata(input);

  // Audio + text special handling
  if (waType === 'audio' && input.payload.text) {
    return handleAudioWithText(input, media.url, metadata);
  }

  const wabaPayload: WabaPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: input.waId,
    type: waType,
  };

  // Build type-specific media object
  switch (waType) {
    case 'image': {
      const caption = truncateCaption(input.payload.text, input.internalId);
      wabaPayload.image = { link: media.url };
      if (caption) wabaPayload.image.caption = caption;
      break;
    }
    case 'video': {
      const caption = truncateCaption(input.payload.text, input.internalId);
      wabaPayload.video = { link: media.url };
      if (caption) wabaPayload.video.caption = caption;
      break;
    }
    case 'document': {
      const caption = truncateCaption(input.payload.text, input.internalId);
      const filename = media.filename || extractFilenameFromUrl(media.url) || 'document';
      wabaPayload.document = { link: media.url, filename };
      if (caption) wabaPayload.document.caption = caption;
      break;
    }
    case 'audio': {
      // Audio: no caption allowed by WhatsApp
      wabaPayload.audio = { link: media.url };
      break;
    }
  }

  return { metadata, wabaPayload };
}

/**
 * Handle audio message paired with text per AUDIO_TEXT_BEHAVIOR config
 */
function handleAudioWithText(
  input: InputMessage,
  audioUrl: string,
  metadata: OutputMessage['metadata']
): OutputMessage | OutputMessage[] {
  const behavior = config.behavior.audioText;

  switch (behavior) {
    case 'separate_message': {
      // Return array: audio first, then text
      const audioMsg: OutputMessage = {
        metadata,
        wabaPayload: {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: input.waId,
          type: 'audio',
          audio: { link: audioUrl },
        },
      };
      const textMsg = transformText(input);
      return [audioMsg, textMsg];
    }

    case 'discard_text':
      console.warn(`Audio+text: discarding text for message ${input.internalId}`);
      return {
        metadata,
        wabaPayload: {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: input.waId,
          type: 'audio',
          audio: { link: audioUrl },
        },
      };

    case 'text_only':
      console.warn(`Audio+text: sending text only for message ${input.internalId}`);
      return transformText(input);

    default: {
      // Default to separate_message
      const audioOut: OutputMessage = {
        metadata,
        wabaPayload: {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: input.waId,
          type: 'audio',
          audio: { link: audioUrl },
        },
      };
      return [audioOut, transformText(input)];
    }
  }
}

/**
 * Truncate caption to max allowed length with warning
 */
function truncateCaption(text: string | undefined, internalId: string): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > MAX_CAPTION_LENGTH) {
    console.warn(`Caption truncated from ${trimmed.length} to ${MAX_CAPTION_LENGTH} chars for message ${internalId}`);
    return trimmed.substring(0, MAX_CAPTION_LENGTH);
  }
  return trimmed;
}

/**
 * Main transformation entry point
 * Takes an InputMessage and returns one or more OutputMessages
 */
export function transformMessage(input: InputMessage): OutputMessage | OutputMessage[] {
  // Media messages (may or may not also have text)
  if (input.payload.media) {
    return transformMedia(input);
  }

  // Text-only messages
  if (input.payload.text) {
    return transformText(input);
  }

  // Should never reach here if validation passed
  throw new Error('Message has neither text nor media payload');
}
