/**
 * Shared RabbitMQ Queue Names
 * Central source of truth for all message queues
 */

module.exports = {
    // Inbound (WhatsApp -> Genesys)
    INBOUND_WHATSAPP_MESSAGES: 'inbound-whatsapp-messages', // Standardized name

    // Outbound (Genesys -> WhatsApp)
    OUTBOUND_GENESYS_MESSAGES: 'outbound-genesys-messages',

    // Status Updates
    WHATSAPP_STATUS_UPDATES: 'whatsapp-status-updates',
    GENESYS_STATUS_UPDATES: 'genesys-status-updates',

    // System Events
    TENANT_EVENTS: 'tenant-events',
    ERROR_EVENTS: 'error-events'
};
