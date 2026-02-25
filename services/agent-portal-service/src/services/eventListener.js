const rabbitMQService = require('./rabbitmq.service');
const socketEmitter = require('./socketEmitter');
const config = require('../config');
const logger = require('../utils/logger');

// Queue name should be configured
const EVENT_QUEUE = config.rabbitmq.queues.agentPortalEvents || 'waba.agent-portal.events';

class EventListener {
    async start() {
        logger.info('Starting Event Listener...');

        await rabbitMQService.consume(EVENT_QUEUE, this.handleMessage.bind(this));
    }

    async handleMessage(payload) {
        try {
            const { type, data, tenantId } = payload;
            logger.debug('Received event', payload);
            if (!tenantId) {
                logger.warn('Received event without tenantId', { type });
                return;
            }

            switch (type) {
                case 'new_message':
                    socketEmitter.emitNewMessage(tenantId, data);
                    break;

                case 'conversation_update':
                    socketEmitter.emitConversationUpdate(tenantId, data);
                    break;

                case 'status_update':
                    // payload: { tenantId, messageId, status: 'sent'|'delivered'|'read', timestamp }
                    socketEmitter.emitStatusUpdate(tenantId, {
                        messageId: payload.messageId,
                        status: payload.status,
                        timestamp: payload.timestamp,
                    });
                    break;

                case 'metrics_update':
                    socketEmitter.emitMetricsUpdate(tenantId, data);
                    break;

                default:
                    logger.debug('Ignoring unknown event type', { type });
            }
        } catch (error) {
            logger.error('Error handling event message', error);
        }
    }
}

module.exports = new EventListener();
