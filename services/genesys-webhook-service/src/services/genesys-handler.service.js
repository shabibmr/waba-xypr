const logger = require('../utils/logger');
const rabbitMQService = require('./rabbitmq.service');
const tenantService = require('./tenant.service');
const stateService = require('./state.service');
const mediaService = require('./media.service');

class GenesysHandlerService {



    async processOutboundMessage(body) {
        const {
            eventType,
            conversationId,
            message,
            channel,
            metadata
        } = body;

        logger.info('Genesys outbound webhook received', { eventType });

        // Resolve tenant
        const tenantId = await tenantService.resolveTenant(conversationId, channel?.integrationId);
        if (!tenantId) {
            logger.error('Could not resolve tenant for conversation', { conversationId });
            return;
        }

        // Only process agent messages
        if (eventType === 'agent.message' || eventType === 'message.sent') {

            let finalMediaUrl = message.mediaUrl;

            // If message has mediaUrl, ensure it's on our MinIO
            if (message.mediaUrl) {
                // Check if it's already a MinIO URL to avoid re-uploading
                // Simple check: if it contains our bucket name
                const isInternal = message.mediaUrl.includes(config.minio.bucket);

                if (!isInternal) {
                    try {
                        logger.info('Uploading outbound media to MinIO...', { url: message.mediaUrl });
                        finalMediaUrl = await mediaService.uploadFromUrl(message.mediaUrl, tenantId);
                    } catch (err) {
                        logger.error('Failed to upload outbound media, sending original URL', err);
                        // Fallback to original URL so message doesn't fail completely
                    }
                }
            }

            const payload = {
                tenantId,
                conversationId,
                messageId: message.id,
                text: message.text,
                timestamp: message.timestamp || new Date().toISOString(),
                agentId: message.from?.id,
                agentName: message.from?.nickname,
                mediaType: message.mediaType,
                mediaUrl: finalMediaUrl,
                metadata: metadata || {}
            };

            await rabbitMQService.publishOutboundMessage(payload);
            logger.info('Queued outbound message', { tenantId, messageId: message.id });
        }
    }

    async processEvent(body) {
        const {
            eventType,
            conversationId,
            participant,
            timestamp
        } = body;

        logger.info('Genesys event received', { eventType });

        const tenantId = await tenantService.resolveTenant(conversationId);
        if (!tenantId) {
            logger.error('Could not resolve tenant for event', { conversationId });
            return;
        }

        const payload = {
            tenantId,
            eventType,
            conversationId,
            participant,
            timestamp: timestamp || new Date().toISOString()
        };

        // Queue event for processing
        await rabbitMQService.publishEvent(payload);
        logger.info('Queued event', { tenantId, eventType });

        // Handle specific events immediately if needed
        await this.handleConversationEvent(payload);
    }

    async handleConversationEvent(payload) {
        const { tenantId, eventType, conversationId, participant } = payload;

        try {
            switch (eventType) {
                case 'conversation.disconnected':
                    logger.info('Conversation ended', { tenantId, conversationId });
                    await stateService.updateConversationStatus(tenantId, conversationId, 'closed');
                    break;

                case 'agent.typing':
                    logger.info('Agent typing', { tenantId, participant: participant?.name });
                    break;

                case 'participant.joined':
                    logger.info('Participant joined', { tenantId, participant: participant?.name });
                    break;

                case 'participant.left':
                    logger.info('Participant left', { tenantId, participant: participant?.name });
                    break;

                case 'conversation.transferred':
                    logger.info('Conversation transferred', { tenantId });
                    break;

                default:
                    logger.debug('Unhandled event', { tenantId, eventType });
            }
        } catch (error) {
            logger.error('Event handling error', { tenantId, error: error.message });
        }
    }

    async processAgentState(body) {
        const { agentId, state } = body;
        logger.info('Agent state change', { agentId, state });
        // Add logic here to track agent availability if needed
    }
}

module.exports = new GenesysHandlerService();
