// ==================== Database Models ====================

export interface ConversationMapping {
  id: string; // UUID
  wa_id: string;
  conversation_id: string | null; // NULL until Genesys correlation
  communication_id: string | null;
  last_message_id: string | null;
  contact_name: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  status: ConversationStatus;
  last_activity_at: Date;
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any>;
}

export interface MessageTracking {
  id: string; // UUID
  mapping_id: string; // UUID FK to conversation_mappings
  wamid: string; // WhatsApp message ID (unique)
  genesys_message_id: string | null;
  direction: MessageDirection;
  status: MessageStatus;
  media_url: string | null;
  created_at: Date;
  updated_at: Date;
  delivered_at: Date | null;
  metadata?: Record<string, any>;
}

// ==================== Enums ====================

export enum ConversationStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
  EXPIRED = 'expired'
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND'
}

export enum MessageStatus {
  // Outbound statuses
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',

  // Inbound statuses
  RECEIVED = 'received',
  PROCESSED = 'processed',

  // Terminal status
  FAILED = 'failed'
}

// ==================== State Machine ====================

export const MESSAGE_STATE_TRANSITIONS: Record<MessageStatus, MessageStatus[]> = {
  [MessageStatus.QUEUED]: [MessageStatus.SENT, MessageStatus.FAILED],
  [MessageStatus.SENT]: [MessageStatus.DELIVERED, MessageStatus.FAILED],
  [MessageStatus.DELIVERED]: [MessageStatus.READ, MessageStatus.FAILED],
  [MessageStatus.READ]: [], // terminal
  [MessageStatus.RECEIVED]: [MessageStatus.PROCESSED, MessageStatus.FAILED],
  [MessageStatus.PROCESSED]: [], // terminal
  [MessageStatus.FAILED]: [] // terminal
};

export function isValidStateTransition(currentStatus: MessageStatus, newStatus: MessageStatus): boolean {
  if (currentStatus === newStatus) {
    return true; // Idempotent update
  }
  return MESSAGE_STATE_TRANSITIONS[currentStatus].includes(newStatus);
}

// ==================== Queue Payloads ====================

export interface InboundMessage {
  wa_id: string;
  wamid: string;
  message_text?: string;
  contact_name?: string;
  timestamp: string; // ISO 8601
  media_url?: string;
  phone_number_id?: string;
  display_phone_number?: string;
  tenantId: string; // Added for multi-tenancy
}

export interface OutboundMessage {
  conversation_id: string;
  genesys_message_id: string;
  message_text?: string;
  media?: {
    url: string;
    contentType: string;
    filename?: string;
  };
  tenantId: string; // Required for routing
}

export interface StatusUpdate {
  wamid: string;
  status: MessageStatus;
  timestamp: string; // ISO 8601
  tenantId?: string; // Optional for legacy support, but recommended
}

export interface ConversationCorrelation {
  conversation_id: string;
  communication_id: string;
  whatsapp_message_id: string; // wamid
  tenantId: string; // Required
}

export interface GenesysStatusEvent {
  tenantId: string;
  genesysId: string;           // Genesys event ID (body.id from webhook)
  originalMessageId: string;   // channel.messageId — the Genesys message being receipted
  status: string;              // 'delivered' | 'read' | 'typing' | 'disconnect'
  timestamp: string;           // ISO 8601
}

export interface EnrichedGenesysStatusEvent extends GenesysStatusEvent {
  conversation_id: string | null; // resolved by state-manager via message_tracking JOIN
}

// ==================== Enriched Payloads ====================

export interface EnrichedInboundMessage extends InboundMessage {
  mapping_id: string;
  conversation_id: string | null;
  is_new_conversation: boolean;
}

export interface EnrichedOutboundMessage extends OutboundMessage {
  wa_id: string;
  mapping_id: string;
}

// ==================== DLQ ====================

export enum DLQReason {
  LOCK_TIMEOUT = 'lock_timeout',
  MAPPING_NOT_FOUND = 'mapping_not_found',
  INVALID_PAYLOAD = 'invalid_payload',
  STATE_VIOLATION = 'state_violation',
  MAPPING_STATUS_EXPIRED = 'mapping_status_expired',
  MAPPING_STATUS_CLOSED = 'mapping_status_closed',
  DATABASE_ERROR = 'database_error',
  INVALID_MEDIA_URL = 'invalid_media_url'
}

export interface DLQMessage<T = any> {
  original_payload: T;
  reason: DLQReason;
  error_message?: string;
  retry_count: number;
  timestamp: string;
}

// ==================== API Responses ====================

export interface MappingResponse {
  waId: string;
  conversationId: string | null;
  contactName: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  communicationId: string | null;
  lastActivityAt: string;
  status: ConversationStatus;
  isNew: boolean;
  internalId: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: {
      status: 'ok' | 'error';
      latency_ms?: number;
      error?: string;
    };
    redis: {
      status: 'ok' | 'error';
      latency_ms?: number;
      error?: string;
    };
    rabbitmq?: {
      status: 'ok' | 'error';
      queue_depth?: number;
      error?: string;
    };
  };
  uptime_seconds?: number;
}
