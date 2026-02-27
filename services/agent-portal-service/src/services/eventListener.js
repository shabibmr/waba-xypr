const rabbitMQService = require('./rabbitmq.service');
const socketEmitter = require('./socketEmitter');
const config = require('../config');
const logger = require('../utils/logger');
const Template = require('../models/Template');
const { QUEUES } = require('../../../../shared/constants');

// Queue name should be configured
const EVENT_QUEUE = config.rabbitmq.queues.agentPortalEvents || 'waba.agent-portal.events';
const TEMPLATE_STATUS_QUEUE = QUEUES.TEMPLATE_STATUS_UPDATES;

class EventListener {
    async start() {
        logger.info('Starting Event Listener...');

        await Promise.allSettled([
            rabbitMQService.consume(EVENT_QUEUE, this.handleMessage.bind(this)),
            rabbitMQService.consume(TEMPLATE_STATUS_QUEUE, this.handleTemplateStatusUpdate.bind(this))
        ]);
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
                    // data: { messageId, status: 'sent'|'delivered'|'read', timestamp }
                    socketEmitter.emitStatusUpdate(tenantId, {
                        messageId: data.messageId,
                        status: data.status,
                        timestamp: data.timestamp,
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

    async handleTemplateStatusUpdate(payload) {
        try {
            const { metaTemplateId, name, status, rejectedReason, qualityScore } = payload;
            logger.info('Processing template status update', { metaTemplateId, status });

            // Update template in DB
            const updated = await Template.updateStatus(metaTemplateId, status, rejectedReason, qualityScore);

            if (updated) {
                // Emit to tenant via Socket.IO
                socketEmitter.emitTemplateStatusUpdate(updated.tenant_id, {
                    metaTemplateId,
                    name: updated.name || name,
                    status,
                    qualityScore,
                    rejectedReason
                });
            }
        } catch (error) {
            logger.error('Error handling template status update', error);
        }
    }
}

module.exports = new EventListener();
