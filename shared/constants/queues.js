/**
 * Shared RabbitMQ Queue Names
 * Central source of truth for all message queues
 */

module.exports = {
    // Inbound (WhatsApp -> Genesys)
    INBOUND_WHATSAPP_MESSAGES: 'inbound.whatsapp.msg', // Standardized name
    INBOUND_TRANSFORMER_WORK: 'inbound.transformer.work.msg', // Internal work queue

    // Outbound (Genesys -> WhatsApp)
    OUTBOUND_GENESYS_MESSAGES: 'outbound.genesys.msg',
    OUTBOUND_PROCESSED: 'outbound.processed.msg',               // State Manager -> Outbound Transformer
    OUTBOUND_READY: 'outbound.ready.msg',                       // Outbound Transformer -> WhatsApp API Service
    OUTBOUND_TRANSFORMER_DLQ: 'outbound.transformer.dlq',   // DLQ for failed transformations
    WHATSAPP_API_DLQ: 'outbound.whatsapp.api.dlq',                   // DLQ for WhatsApp API Service
    STATE_MANAGER_DLQ: 'inbound.state.manager.dlq',                 // DLQ for State Manager failures

    // Routing Keys
    OUTBOUND_ROUTING_KEY: 'outbound.ready.msg',

    // Status Updates
    WHATSAPP_STATUS_UPDATES: 'inbound.whatsapp.status.evt',
    GENESYS_STATUS_UPDATES: 'outbound.genesys.status.evt',
    OUTBOUND_ACK_EVENTS: 'outbound.ack.evt',

    // Genesys API Service queues
    INBOUND_ENRICHED: 'inbound.enriched.msg',   // State Manager -> Inbound Transformer
    GENESYS_INBOUND_READY_MSG: 'genesys.inbound.ready.msg', // Inbound Transformer -> Genesys API
    INBOUND_STATUS_READY: 'inbound.status.ready',         // Inbound Transformer -> Genesys API (status receipts)
    CORRELATION_EVENTS: 'inbound.correlation.evt',
    GENESYS_API_DLQ: 'genesys.api.dlq',
    GENESYS_STATUS_PROCESSED: 'outbound.genesys.status.processed.evt', // State Manager -> Genesys API Service (receipt events)

    // Open Messaging — Inbound Transformer queues
    INBOUND_STATUS_EVENTS: 'inbound.status.evt',           // State Manager -> Inbound Transformer (WhatsApp status events)
    INBOUND_TRANSFORMER_DLQ: 'inbound.transformer.dlq',    // DLQ for inbound-transformer failures
    OM_OUTBOUND_MESSAGES: 'om.outbound.msg',                // Genesys Webhook -> Inbound Transformer (outbound msg transforms)
    OM_OUTBOUND_EVENTS: 'om.outbound.evt',                  // Genesys Webhook -> Inbound Transformer (outbound events)

    // System Events
    TENANT_EVENTS: 'tenant.evt',
    ERROR_EVENTS: 'error.evt',

    // Agent Portal Real-Time Events
    AGENT_PORTAL_EVENTS: 'outbound.agent.portal.evt',
    OUTBOUND_AGENT_WIDGET_MESSAGES: 'outbound.agent.widget.msg',
    OUTBOUND_AGENT_READY: 'outbound.agent.ready.msg'
};
