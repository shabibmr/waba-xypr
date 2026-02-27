/**
 * Webhook Processor Service
 * Handles processing of WhatsApp webhook events
 */

const rabbitMQService = require('./rabbitmq.service');
const tenantService = require('./tenant.service');
const { verifyMetaSignature } = require('../middleware/signature-verifier');
const { extractMessageContent } = require('../utils/message-extractor');
const Logger = require('../utils/logger');
const mediaService = require('./media.service');
const { SignatureVerificationError, TenantResolutionError } = require('../utils/errors');

class WebhookProcessorService {
    /**
     * Process webhook payload from Meta
     * @param {Object} body - Webhook request body
     * @param {Object} headers - Request headers
     */
    /**
     * Process webhook payload from Meta
     * @param {Object} body - Webhook request body
     * @param {Object} headers - Request headers
     * @param {Buffer} [rawBody] - Raw request body buffer for signature verification
     */
    async processWebhook(body, headers, rawBody) {
        try {
            const { entry } = body;

            if (!entry || entry.length === 0) {
                Logger.debug('Empty webhook payload received');
                return;
            }

            for (const item of entry) {
                const changes = item.changes || [];

                for (const change of changes) {
                    // Handle template status updates
                    if (change.field === 'message_template_status_update') {
                        await this.processTemplateStatusUpdate(change.value);
                        continue;
                    }

                    if (change.field !== 'messages') continue;

                    const value = change.value;
                    const phoneNumberId = value.metadata?.phone_number_id;

                    // Resolve tenant from phone number ID
                    const tenantId = await tenantService.getTenantFromPhoneNumberId(phoneNumberId);
                    if (!tenantId) {
                        Logger.error('Could not resolve tenant for phone number', null, { phoneNumberId });
                        throw new TenantResolutionError(`Could not resolve tenant for phone number: ${phoneNumberId}`);
                    }

                    const tenantLogger = Logger.forTenant(tenantId);

                    // Verify signature for this tenant (skip in development)
                    if (process.env.NODE_ENV !== 'development') {
                        try {
                            const credentials = await tenantService.getTenantMetaCredentials(tenantId);
                            const { appSecret } = credentials;

                            const signature = headers['x-hub-signature-256'];
                            // Use rawBody if available, otherwise fall back to body object (less reliable)
                            if (!verifyMetaSignature(signature, rawBody || body, appSecret)) {
                                tenantLogger.error('Invalid webhook signature');
                                throw new SignatureVerificationError('Invalid webhook signature');
                            }
                        } catch (error) {
                            if (error.name === 'SignatureVerificationError') {
                                throw error; // Re-throw signature errors
                            }
                            tenantLogger.error('Failed to verify signature', error);
                            throw new SignatureVerificationError('Signature verification failed: ' + error.message);
                        }
                    } else {
                        tenantLogger.debug('Skipping signature verification (development mode)');
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

            let content = extractMessageContent(message);
            let message_text = content.text || content.body || null;
            let structuredMetadata = null;

            // Handle specific message types where text needs to be constructed or extracted
            if (message.type === 'interactive') {
                if (content.interactiveType === 'button_reply') {
                    message_text = content.buttonReply?.title || message_text;
                } else if (content.interactiveType === 'list_reply') {
                    message_text = content.listReply?.title || message_text;
                }
                structuredMetadata = {
                    type: 'interactive',
                    interactiveType: content.interactiveType,
                    buttonReply: content.buttonReply || null,
                    listReply: content.listReply || null
                };
            } else if (message.type === 'button') {
                message_text = content.buttonText || message_text;
                structuredMetadata = {
                    type: 'interactive',
                    interactiveType: 'quick_reply',
                    buttonReply: { title: content.buttonText, payload: content.buttonPayload }
                };
            } else if (message.type === 'location') {
                const locName = content.name ? `${content.name} ` : '';
                const locAddress = content.address ? `(${content.address}) ` : '';
                const mapsUrl = `https://maps.google.com/?q=${content.latitude},${content.longitude}`;
                message_text = `📍 Location: ${locName}${locAddress}${mapsUrl}`;
                structuredMetadata = {
                    type: 'location',
                    latitude: content.latitude,
                    longitude: content.longitude,
                    name: content.name || null,
                    address: content.address || null,
                    mapsUrl
                };
            } else if (message.type === 'contacts') {
                const contactNames = content.contacts?.map(c => c.name?.formatted_name).filter(Boolean).join(', ');
                message_text = `👤 Contact(s): ${contactNames || 'Shared Contacts'}`;
                structuredMetadata = {
                    type: 'contacts',
                    contacts: content.contacts
                };
            }

            // Handle Media Messages (Image, Document, Audio, Video, Sticker)
            if (content.mediaId) {
                try {
                    // Get credentials to download media
                    const credentials = await tenantService.getTenantMetaCredentials(tenantId);

                    if (!credentials.accessToken) {
                        throw new Error('Missing Meta access token for media download');
                    }

                    tenantLogger.debug('Downloading media from WhatsApp...', { mediaId: content.mediaId });

                    const mediaResult = await mediaService.saveMedia(
                        content.mediaId,
                        credentials.accessToken,
                        tenantId,
                        content.mimeType
                    );

                    // Enhance content with MinIO details
                    content = {
                        ...content,
                        mediaUrl: mediaResult.publicUrl,
                        storagePath: mediaResult.storagePath,
                        fileSize: mediaResult.fileSize
                    };

                } catch (mediaError) {
                    tenantLogger.error('Failed to download/upload media', mediaError);
                    // Flag the error in the content object so downstream knows media is missing
                    content = {
                        ...content,
                        mediaUrl: null,
                        error: 'Media download failed',
                        rawError: mediaError.message
                    };
                }
            }

            const payload = {
                tenantId,
                wamid: message.id,
                wa_id: message.from,
                contact_name: contact?.profile?.name || 'Unknown',
                timestamp: message.timestamp,
                message_text: message_text,
                media_url: content.mediaUrl || null,
                media_mime_type: content.mimeType || null,
                media_filename: content.filename || null,
                message_type: message.type,
                message_metadata: structuredMetadata,
                phone_number_id: value.metadata.phone_number_id,
                display_phone_number: value.metadata.display_phone_number
            };

            // Queue for transformation
            await rabbitMQService.publishInboundMessage(payload);

            tenantLogger.info('Queued inbound message', { wamid: message.id, hasMedia: !!content.mediaUrl });
        } catch (error) {
            tenantLogger.error('Error processing message', error);
        }
    }

    /**
     * Process template status update from Meta
     * @param {Object} value - Template status update value
     */
    async processTemplateStatusUpdate(value) {
        try {
            const payload = {
                metaTemplateId: value.message_template_id,
                name: value.message_template_name,
                status: value.event,  // APPROVED, REJECTED, PENDING_DELETION, etc.
                rejectedReason: value.reason || null,
                qualityScore: value.other_info?.quality_score || null
            };

            await rabbitMQService.publishTemplateStatusUpdate(payload);
            Logger.info('Queued template status update', { templateId: payload.metaTemplateId, status: payload.status });
        } catch (error) {
            Logger.error('Error processing template status update', error);
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
                wamid: status.id,
                recipientId: status.recipient_id,
                status: status.status,
                timestamp: status.timestamp,
                errors: status.errors || [],
                conversation: status.conversation || {}
            };

            // Queue for processing
            await rabbitMQService.publishStatusUpdate(payload);

            tenantLogger.info('Queued status update', {
                wamid: status.id,
                status: status.status
            });
        } catch (error) {
            tenantLogger.error('Error processing status', error);
        }
    }
}

// Export singleton instance
module.exports = new WebhookProcessorService();
