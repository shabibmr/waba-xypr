// @ts-ignore
import logger from '../utils/logger';
// @ts-ignore
import rabbitMQService from './rabbitmq.service';
// @ts-ignore
import mediaService from './media.service';

// 03-C: Status mapping — Genesys status/type → internal lowercase status
const STATUS_MAP: Record<string, string> = {
    Delivered: 'delivered',
    Read: 'read',
    Typing: 'typing',
    Disconnect: 'disconnect',
    Receipt: 'delivered',
};

class GenesysHandlerService {

    /**
     * 02-A: Main entry point. Reads FRD Open Messaging schema fields.
     * Called after signature validation and echo/HealthCheck checks in the controller.
     */
    async processWebhookEvent(body: any, tenantId: string): Promise<void> {
        const eventClass = this.classifyEvent(body);

        if (eventClass === 'skip') {
            logger.info('Skipping non-outbound or unrecognised event', {
                tenantId,
                type: body.type,
                direction: body.direction
            });
            return;
        }

        if (eventClass === 'outbound_message') {
            await this.processOutboundMessage(body, tenantId);
        } else if (eventClass === 'status_event') {
            await this.processStatusEvent(body, tenantId);
        }
    }

    /**
     * 02-B: Classify Genesys Open Messaging event.
     * Only process Outbound direction.
     */
    classifyEvent(body: any): 'outbound_message' | 'status_event' | 'skip' {
        const { type, direction } = body;

        // Only Outbound events (from agent to customer) are processed here
        if (direction !== 'Outbound') {
            return 'skip';
        }

        if (type === 'Text' || type === 'Structured') {
            return 'outbound_message';
        }

        if (type === 'Receipt' || type === 'Typing' || type === 'Disconnect') {
            return 'status_event';
        }

        return 'skip';
    }

    /**
     * 02-A, 03-A: Process outbound message using FRD Open Messaging schema.
     * 04-I: Detect media from content[].contentType === "Attachment"
     * 04-J: Graceful degradation — media failure sets media: null, message still published
     */
    private async processOutboundMessage(body: any, tenantId: string): Promise<void> {
        const genesysId: string = body.id;
        const channel = body.channel || {};
        const text: string | undefined = body.text;
        const content: any[] = body.content || [];

        const toId: string = channel.to?.id;
        const toIdType: string = channel.to?.idType;
        const timestamp: string = channel.time || new Date().toISOString();

        // 04-I: Detect attachment from content[]
        let media: any = null;
        const attachments = content.filter((c: any) => c.contentType === 'Attachment');
        if (attachments.length > 0) {
            // 04-J: Wrap in try/catch — failure gracefully degrades to media: null
            try {
                const att = attachments[0];
                const attData = att.attachment || att;
                const mediaUrl = attData.url || attData.mediaUrl;
                if (mediaUrl) {
                    const storedUrl = await mediaService.uploadFromUrl(mediaUrl, tenantId);
                    media = {
                        url: storedUrl,
                        contentType: attData.mediaType || attData.mimeType,
                        filename: attData.filename
                    };
                }
            } catch (err: any) {
                logger.error('Media upload failed, proceeding with media: null', {
                    tenantId,
                    genesysId,
                    error: err.message
                });
                media = null;
            }
        }

        // 03-A: FRD-compliant outbound message payload
        const payload = {
            tenantId,
            genesysId,
            type: 'message',
            timestamp,
            payload: {
                text,
                to_id: toId,
                to_id_type: toIdType,
                media
            }
        };

        await rabbitMQService.publishOutboundMessage(payload);
        logger.info('Queued outbound message', { tenantId, genesysId, hasMedia: media !== null });
    }

    /**
     * 03-B/C: Process status event using FRD Open Messaging schema.
     */
    private async processStatusEvent(body: any, tenantId: string): Promise<void> {
        const genesysId: string = body.id;
        const channel = body.channel || {};
        const type: string = body.type;
        const rawStatus: string | undefined = body.status;

        const originalMessageId: string = channel.messageId;
        const timestamp: string = channel.time || new Date().toISOString();

        // Map Genesys status/type to internal lowercase status
        const mappedStatus = rawStatus
            ? (STATUS_MAP[rawStatus] || rawStatus.toLowerCase())
            : (STATUS_MAP[type] || type.toLowerCase());

        // 03-B: FRD-compliant status event payload
        const payload = {
            tenantId,
            genesysId,
            originalMessageId,
            status: mappedStatus,
            timestamp
        };

        await rabbitMQService.publishStatusEvent(payload);
        logger.info('Queued status event', { tenantId, genesysId, status: mappedStatus });
    }
}

export default new GenesysHandlerService();
