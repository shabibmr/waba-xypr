const socketService = require('./socketService');
const logger = require('../utils/logger');

/**
 * Socket Emitter Helper
 * Abstracts the logic of emitting events to specific targets
 */

const EVENTS = {
    NEW_MESSAGE: 'new_message',
    CONVERSATION_UPDATE: 'conversation_update',
    AGENT_STATUS_CHANGE: 'agent_status_change',
    STATUS_UPDATE: 'status_update',
    METRICS_UPDATE: 'metrics_update',
    TEMPLATE_STATUS_UPDATE: 'template_status_update',
};

class SocketEmitter {
    /**
     * Notify tenant of a new inbound message
     * @param {string} tenantId 
     * @param {object} message 
     */
    emitNewMessage(tenantId, message) {
        try {
            logger.info(`[SocketEmitter] Emitting NEW_MESSAGE to tenant: ${tenantId}`, { messageId: message.id });
            socketService.toTenant(tenantId, EVENTS.NEW_MESSAGE, message);
            logger.debug(`[SocketEmitter] Successfully emitted new_message to tenant ${tenantId}`, { messageId: message.id });
        } catch (error) {
            logger.error('Failed to emit new_message', { error: error.message, tenantId });
        }
    }

    /**
     * Notify tenant/user of conversation update
     * @param {string} tenantId 
     * @param {object} conversation 
     */
    emitConversationUpdate(tenantId, conversation) {
        try {
            logger.info(`[SocketEmitter] Emitting CONVERSATION_UPDATE to tenant: ${tenantId}`, { conversationId: conversation.id });
            socketService.toTenant(tenantId, EVENTS.CONVERSATION_UPDATE, conversation);
            logger.debug(`[SocketEmitter] Successfully emitted conversation_update to tenant ${tenantId}`, { conversationId: conversation.id });
        } catch (error) {
            logger.error('Failed to emit conversation_update', { error: error.message, tenantId });
        }
    }

    /**
     * Notify tenant of a message status update (sent/delivered/read)
     * @param {string} tenantId
     * @param {{ messageId: string, status: string, timestamp: string }} data
     */
    emitStatusUpdate(tenantId, data) {
        try {
            logger.info(`[SocketEmitter] Emitting STATUS_UPDATE to tenant: ${tenantId}`, { messageId: data.messageId, status: data.status });
            socketService.toTenant(tenantId, EVENTS.STATUS_UPDATE, data);
            logger.debug(`[SocketEmitter] Successfully emitted status_update to tenant ${tenantId}`, { messageId: data.messageId });
        } catch (error) {
            logger.error('Failed to emit status_update', { error: error.message, tenantId });
        }
    }

    /**
     * Notify tenant of a template status update (approved/rejected/paused)
     * @param {string} tenantId
     * @param {object} data - { metaTemplateId, name, status, qualityScore, rejectedReason }
     */
    emitTemplateStatusUpdate(tenantId, data) {
        try {
            logger.info(`[SocketEmitter] Emitting TEMPLATE_STATUS_UPDATE to tenant: ${tenantId}`, { templateId: data.metaTemplateId, status: data.status });
            socketService.toTenant(tenantId, EVENTS.TEMPLATE_STATUS_UPDATE, data);
        } catch (error) {
            logger.error('Failed to emit template_status_update', { error: error.message, tenantId });
        }
    }

    /**
     * Notify tenant of dashboard metrics update
     * @param {string} tenantId
     * @param {object} metrics
     */
    emitMetricsUpdate(tenantId, metrics) {
        try {
            socketService.toTenant(tenantId, EVENTS.METRICS_UPDATE, metrics);
            logger.debug(`Emitted metrics_update to tenant ${tenantId}`);
        } catch (error) {
            logger.error('Failed to emit metrics_update', { error: error.message, tenantId });
        }
    }
}

module.exports = new SocketEmitter();
