/**
 * Shared RabbitMQ Queue Names
 * Central source of truth for all message queues
 */

module.exports = {
    // Inbound (WhatsApp -> Genesys)
    INBOUND_WHATSAPP_MESSAGES: 'inbound-whatsapp-messages', // Standardized name
    INBOUND_TRANSFORMER_WORK: 'inbound-transformer-work', // Internal work queue

    // Outbound (Genesys -> WhatsApp)
    OUTBOUND_GENESYS_MESSAGES: 'outbound-genesys-messages',
    OUTBOUND_PROCESSED: 'outbound-processed',               // State Manager -> Outbound Transformer
    OUTBOUND_READY: 'outbound-ready',                       // Outbound Transformer -> WhatsApp API Service
    OUTBOUND_TRANSFORMER_DLQ: 'outbound-transformer-dlq',   // DLQ for failed transformations

    // Status Updates
    WHATSAPP_STATUS_UPDATES: 'whatsapp-status-updates',
    GENESYS_STATUS_UPDATES: 'genesys-status-updates',

    // Genesys API Service queues
    INBOUND_ENRICHED: 'inbound.enriched',   // State Manager -> Inbound Transformer
    GENESYS_OUTBOUND_READY: 'genesys.outbound.ready', // Inbound Transformer -> Genesys API
    CORRELATION_EVENTS: 'correlation-events',
    GENESYS_API_DLQ: 'genesys-api.dlq',
    GENESYS_STATUS_PROCESSED: 'genesys-status-processed', // State Manager -> Genesys API Service (receipt events)

    // System Events
    TENANT_EVENTS: 'tenant-events',
    ERROR_EVENTS: 'error-events'
};
