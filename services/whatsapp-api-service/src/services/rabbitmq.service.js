/**
 * RabbitMQ Consumer
 * Consumes from outbound-ready queue and delivers messages to Meta Graph API.
 *
 * Payload schema (OutputMessage from outbound-transformer):
 *   { metadata: { tenantId, phoneNumberId, internalId, correlationId }, wabaPayload: { ... } }
 *
 * Error handling:
 *   - Invalid JSON / schema      → DLQ, ACK
 *   - 4xx permanent (not 429)    → DLQ, ACK
 *   - 429 rate limited           → NACK, requeue
 *   - 5xx / timeout              → NACK, requeue (up to maxRetries, then DLQ)
 */
const amqp = require('amqplib');
const config = require('../config/config');
const Logger = require('../utils/logger');
const whatsappService = require('./whatsapp.service');

// HTTP status codes that should never be retried
const PERMANENT_FAILURE_STATUSES = new Set([400, 403, 404]);

let connection = null;
let channel = null;

async function routeToDlq(payload, reason) {
    try {
        if (!channel) return;
        channel.sendToQueue(
            config.rabbitmq.dlqQueue,
            Buffer.from(JSON.stringify({
                original: payload,
                reason,
                timestamp: new Date().toISOString()
            })),
            { persistent: true }
        );
    } catch (err) {
        Logger.error('Failed to route message to DLQ', err);
    }
}

async function processMessage(payload) {
    const { metadata, wabaPayload } = payload;

    if (!metadata?.tenantId || !metadata?.phoneNumberId || !wabaPayload) {
        const err = new Error('Invalid payload: missing metadata.tenantId, metadata.phoneNumberId, or wabaPayload');
        err.permanent = true;
        throw err;
    }

    const whatsappResult = await whatsappService.sendMessage(metadata.tenantId, metadata.phoneNumberId, wabaPayload);

    // Publish ACK back to state-manager for WAMID correlation
    if (whatsappResult.wamid && metadata.correlationId && channel) {
        const ackPayload = {
            tenantId: metadata.tenantId,
            correlationId: metadata.correlationId, // This maps to genesys_message_id
            wamid: whatsappResult.wamid,
            timestamp: new Date().toISOString()
        };
        channel.sendToQueue(
            config.rabbitmq.ackQueue || 'outbound.ack.evt',
            Buffer.from(JSON.stringify(ackPayload)),
            { persistent: true }
        );
        Logger.info('Published WAMID ACK to state-manager', { tenantId: metadata.tenantId, wamid: whatsappResult.wamid, correlationId: metadata.correlationId });
    }
}

async function startConsumer() {
    try {
        connection = await amqp.connect(config.rabbitmq.url);
        channel = await connection.createChannel();

        await channel.assertQueue(config.rabbitmq.inputQueue, { durable: true });
        await channel.assertQueue(config.rabbitmq.dlqQueue, { durable: true });

        // Ensure ACK queue is asserted
        const ackQueue = config.rabbitmq.ackQueue || 'outbound.ack.evt';
        await channel.assertQueue(ackQueue, { durable: true });

        channel.prefetch(config.rabbitmq.prefetch);

        Logger.info(`Consumer started: queue=${config.rabbitmq.inputQueue}`);

        channel.consume(config.rabbitmq.inputQueue, async (msg) => {
            if (!msg) return;

            const retryCount = msg.properties.headers?.['x-retry-count'] || 0;

            // Parse JSON
            let payload;
            try {
                payload = JSON.parse(msg.content.toString());
            } catch {
                Logger.error('Invalid JSON — routing to DLQ');
                await routeToDlq(msg.content.toString(), 'invalid_json');
                channel.ack(msg);
                return;
            }

            try {
                await processMessage(payload);
                channel.ack(msg);
                Logger.info('Message delivered to WhatsApp', {
                    tenantId: payload.metadata?.tenantId,
                    internalId: payload.metadata?.internalId,
                    to: payload.wabaPayload?.to
                });

            } catch (err) {
                const httpStatus = err.response?.status;
                const tenantId = payload.metadata?.tenantId;

                if (err.permanent || (httpStatus && PERMANENT_FAILURE_STATUSES.has(httpStatus))) {
                    Logger.error(`Permanent failure (${httpStatus || 'validation'}) — routing to DLQ`, { tenantId, error: err.message });
                    await routeToDlq(payload, `http_${httpStatus || 'validation'}`);
                    channel.ack(msg);

                } else if (httpStatus === 429) {
                    Logger.warn('Rate limited (429) — requeuing', { tenantId });
                    channel.nack(msg, false, true);

                } else if (retryCount >= config.rabbitmq.maxRetries - 1) {
                    Logger.error(`Max retries exceeded — routing to DLQ`, { tenantId, retryCount, error: err.message });
                    await routeToDlq(payload, `max_retries: ${err.message}`);
                    channel.ack(msg);

                } else {
                    Logger.warn(`Transient error (attempt ${retryCount + 1}/${config.rabbitmq.maxRetries}) — requeuing`, { tenantId, error: err.message });
                    const headers = msg.properties.headers || {};
                    headers['x-retry-count'] = retryCount + 1;

                    channel.ack(msg);
                    channel.sendToQueue(config.rabbitmq.inputQueue, msg.content, {
                        persistent: true,
                        headers
                    });
                }
            }
        });

        connection.on('close', () => {
            Logger.warn('RabbitMQ connection closed, reconnecting...');
            channel = null;
            setTimeout(startConsumer, config.rabbitmq.reconnectDelay);
        });

        connection.on('error', (err) => {
            Logger.error('RabbitMQ connection error', err);
        });

    } catch (err) {
        Logger.error('RabbitMQ startup failed, retrying...', err);
        setTimeout(startConsumer, config.rabbitmq.reconnectDelay);
    }
}

function isConnected() {
    return connection !== null && channel !== null;
}

module.exports = { startConsumer, isConnected };
