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
};

class SocketEmitter {
    /**
     * Notify tenant of a new inbound message
     * @param {string} tenantId 
     * @param {object} message 
     */
    emitNewMessage(tenantId, message) {
        try {
            socketService.toTenant(tenantId, EVENTS.NEW_MESSAGE, message);
            logger.debug(`Emitted new_message to tenant ${tenantId}`, { messageId: message.id });
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
            socketService.toTenant(tenantId, EVENTS.CONVERSATION_UPDATE, conversation);
            logger.debug(`Emitted conversation_update to tenant ${tenantId}`, { conversationId: conversation.id });
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
            socketService.toTenant(tenantId, EVENTS.STATUS_UPDATE, data);
            logger.debug(`Emitted status_update to tenant ${tenantId}`, { messageId: data.messageId, status: data.status });
        } catch (error) {
            logger.error('Failed to emit status_update', { error: error.message, tenantId });
        }
    }
}

module.exports = new SocketEmitter();
