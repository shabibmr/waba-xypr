/**
 * Webhook Processor Service
 * Handles processing of WhatsApp webhook events
 */

const rabbitMQService = require('./rabbitmq.service');
const tenantService = require('./tenant.service');
const { verifyMetaSignature } = require('../middleware/signature-verifier');
const { extractMessageContent } = require('../utils/message-extractor');
const Logger = require('../utils/logger');

class WebhookProcessorService {
    /**
     * Process webhook payload from Meta
     * @param {Object} body - Webhook request body
     * @param {Object} headers - Request headers
     */
    async processWebhook(body, headers) {
        try {
            const { entry } = body;

            if (!entry || entry.length === 0) {
                Logger.debug('Empty webhook payload received');
                return;
            }

            for (const item of entry) {
                const changes = item.changes || [];

                for (const change of changes) {
                    if (change.field !== 'messages') continue;

                    const value = change.value;
                    const phoneNumberId = value.metadata?.phone_number_id;

                    // Resolve tenant from phone number ID
                    const tenantId = await tenantService.getTenantFromPhoneNumberId(phoneNumberId);
                    if (!tenantId) {
                        Logger.error('Could not resolve tenant for phone number', null, { phoneNumberId });
                        continue;
                    }

                    const tenantLogger = Logger.forTenant(tenantId);

                    // Verify signature for this tenant
                    try {
                        const credentials = await tenantService.getTenantMetaCredentials(tenantId);
                        const { appSecret } = credentials;

                        const signature = headers['x-hub-signature-256'];
                        if (!verifyMetaSignature(signature, body, appSecret)) {
                            tenantLogger.error('Invalid webhook signature');
                            continue;
                        }
                    } catch (error) {
                        tenantLogger.error('Failed to verify signature', error);
                        continue;
                    }

                    // Process inbound messages
                    const messages = value.messages || [];
                    for (const message of messages) {
                        await this.processInboundMessage(message, value, tenantId);
                    }

                    // Process status updates
                    const statuses = value.statuses || [];
                    for (const status of statuses) {
                        await this.processStatusUpdate(status, tenantId);
                    }
                }
            }
        } catch (error) {
            Logger.error('Webhook processing error', error);
        }
    }

    /**
     * Process inbound message
     * @param {Object} message - WhatsApp message object
     * @param {Object} value - Webhook value object
     * @param {string} tenantId - Tenant ID
     */
    async processInboundMessage(message, value, tenantId) {
        const tenantLogger = Logger.forTenant(tenantId);

        try {
            const contact = value.contacts?.find(c => c.wa_id === message.from);

            const payload = {
                tenantId,
                messageId: message.id,
                from: message.from,
                contactName: contact?.profile?.name || 'Unknown',
                timestamp: message.timestamp,
                type: message.type,
                content: extractMessageContent(message),
                metadata: {
                    phoneNumberId: value.metadata.phone_number_id,
                    displayPhoneNumber: value.metadata.display_phone_number
                }
            };

            // Queue for transformation
            await rabbitMQService.publishInboundMessage(payload);

            tenantLogger.info('Queued inbound message', { messageId: message.id });
        } catch (error) {
            tenantLogger.error('Error processing message', error);
        }
    }

    /**
     * Process status update
     * @param {Object} status - Status update object
     * @param {string} tenantId - Tenant ID
     */
    async processStatusUpdate(status, tenantId) {
        const tenantLogger = Logger.forTenant(tenantId);

        try {
            const payload = {
                tenantId,
                messageId: status.id,
                recipientId: status.recipient_id,
                status: status.status,
                timestamp: status.timestamp,
                errors: status.errors || [],
                conversation: status.conversation || {}
            };

            // Queue for processing
            await rabbitMQService.publishStatusUpdate(payload);

            tenantLogger.info('Queued status update', {
                messageId: status.id,
                status: status.status
            });
        } catch (error) {
            tenantLogger.error('Error processing status', error);
        }
    }
}

// Export singleton instance
module.exports = new WebhookProcessorService();
