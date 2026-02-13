/**
 * Outbound Transformer Message Types
 * Per FRD Section 3.1 (Input) and Section 3.2 (Output)
 */

// --- Input Message (from state-manager via outbound-processed queue) ---

export interface MediaPayload {
  url: string;
  mime_type: string;
  filename?: string;
}

export interface InputPayload {
  text?: string;
  media?: MediaPayload;
}

export interface InputMessage {
  internalId: string;
  tenantId: string;
  conversationId: string;
  genesysId: string;
  waId: string;
  phoneNumberId: string;
  timestamp: number;
  type: 'message';
  payload: InputPayload;
}

// --- Output Message (to outbound-ready queue or HTTP dispatch) ---

export interface OutputMetadata {
  tenantId: string;
  phoneNumberId: string;
  internalId: string;
  correlationId: string;
}

export type WhatsAppMessageType = 'text' | 'image' | 'video' | 'document' | 'audio';

export interface WabaPayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: WhatsAppMessageType;
  text?: { body: string };
  image?: { link: string; caption?: string };
  video?: { link: string; caption?: string };
  document?: { link: string; filename?: string; caption?: string };
  audio?: { link: string };
}

export interface OutputMessage {
  metadata: OutputMetadata;
  wabaPayload: WabaPayload;
}

// --- DLQ Message ---

export interface DlqMessage {
  original_message: unknown;
  error_details: {
    error_type: string;
    error_message: string;
    stack_trace?: string;
    retry_count: number;
    first_attempt_timestamp: number;
    last_attempt_timestamp: number;
  };
  metadata: {
    tenant_id: string;
    internal_id: string;
    dlq_timestamp: number;
    service: string;
    service_version: string;
  };
}

// --- Error Classification ---

export type ErrorCategory = 'client' | 'validation' | 'transient' | 'configuration';

export interface ClassifiedError {
  category: ErrorCategory;
  retryable: boolean;
}
