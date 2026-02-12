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

    // Status Updates
    WHATSAPP_STATUS_UPDATES: 'whatsapp-status-updates',
    GENESYS_STATUS_UPDATES: 'genesys-status-updates',

    // Genesys API Service queues
    INBOUND_PROCESSED: 'inbound-processed',
    CORRELATION_EVENTS: 'correlation-events',
    GENESYS_API_DLQ: 'genesys-api.dlq',

    // System Events
    TENANT_EVENTS: 'tenant-events',
    ERROR_EVENTS: 'error-events'
};
