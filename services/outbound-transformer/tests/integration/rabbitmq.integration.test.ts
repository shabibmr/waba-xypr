/**
 * Integration Tests for RabbitMQ Consumer
 * Tests end-to-end message flow with mocked dependencies
 */

import { startMessageConsumer, getChannel } from '../../../src/services/rabbitmq.service';
import { validateInputMessage } from '../../../src/services/validator.service';
import { processOutboundMessage } from '../../../src/services/message-processor.service';
import { ConsumeMessage, Channel } from 'amqplib';
import { validTextMessage, invalidMessage_InvalidUUID } from '../../fixtures/messages';

// Mock dependencies
jest.mock('amqplib');
jest.mock('../../../src/services/message-processor.service');
jest.mock('../../../src/services/dispatcher.service');
jest.mock('../../../src/config', () => ({
    default: {
        rabbitmq: {
            url: 'amqp://localhost',
            inputQueue: 'outbound-processed',
            outputQueue: 'outbound-ready',
            dlqQueue: 'outbound-transformer-dlq',
            exchange: 'outbound.exchange',
            prefetch: 10,
        },
        services: {
            stateManager: 'http://state-manager:3005',
            tenantService: 'http://tenant-service:3007',
            whatsappService: 'http://whatsapp-api-service:3008',
        },
        behavior: {
            unsupportedMime: 'reject',
            audioText: 'separate_message',
        },
        retry: {
            maxRetries: 3,
        },
        pipelineMode: false,
        serviceVersion: '1.0.0',
    },
}));

const mockProcessMessage = processOutboundMessage as jest.MockedFunction<typeof processOutboundMessage>;

describe('RabbitMQ Integration Tests', () => {
    let mockChannel: jest.Mocked<Channel>;
    let mockConnection: any;
    let consumeCallback: ((msg: ConsumeMessage | null) => Promise<void>) | null = null;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock channel
        mockChannel = {
            assertQueue: jest.fn().mockResolvedValue({}),
            prefetch: jest.fn(),
            consume: jest.fn().mockImplementation((queue, callback) => {
                consumeCallback = callback;
                return Promise.resolve({});
            }),
            ack: jest.fn(),
            nack: jest.fn(),
            assertExchange: jest.fn().mockResolvedValue({}),
            bindQueue: jest.fn().mockResolvedValue({}),
            sendToQueue: jest.fn(),
            publish: jest.fn().mockReturnValue(true),
        } as any;

        // Create mock connection
        mockConnection = {
            createChannel: jest.fn().mockResolvedValue(mockChannel),
            on: jest.fn(),
        };

        // Mock amqplib.connect
        const amqp = require('amqplib');
        amqp.connect = jest.fn().mockResolvedValue(mockConnection);
    });

    describe('Message Processing Flow', () => {
        it('should consume, validate, process, and ACK valid message', async () => {
            mockProcessMessage.mockResolvedValue();

            // Start consumer
            await startMessageConsumer();

            // Simulate receiving a valid message
            const mockMessage: ConsumeMessage = {
                content: Buffer.from(JSON.stringify(validTextMessage)),
                properties: { headers: {} },
                fields: {} as any,
            };

            // Invoke consume callback
            if (consumeCallback) {
                await consumeCallback(mockMessage);
            }

            // Verify message was processed
            expect(mockProcessMessage).toHaveBeenCalledWith(validTextMessage);
            expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
            expect(mockChannel.nack).not.toHaveBeenCalled();
        });

        it('should ACK invalid JSON without retrying', async () => {
            await startMessageConsumer();

            const mockMessage: ConsumeMessage = {
                content: Buffer.from('invalid json {{{'),
                properties: { headers: {} },
                fields: {} as any,
            };

            if (consumeCallback) {
                await consumeCallback(mockMessage);
            }

            expect(mockProcessMessage).not.toHaveBeenCalled();
            expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
            expect(mockChannel.nack).not.toHaveBeenCalled();
        });

        it('should ACK and route to DLQ on validation failure', async () => {
            await startMessageConsumer();

            const mockMessage: ConsumeMessage = {
                content: Buffer.from(JSON.stringify(invalidMessage_InvalidUUID)),
                properties: { headers: {} },
                fields: {} as any,
            };

            if (consumeCallback) {
                await consumeCallback(mockMessage);
            }

            expect(mockProcessMessage).not.toHaveBeenCalled();
            expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
                'outbound-transformer-dlq',
                expect.any(Buffer),
                expect.objectContaining({
                    persistent: true,
                    contentType: 'application/json',
                })
            );
            expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
        });

        it('should NACK and retry transient errors', async () => {
            mockProcessMessage.mockRejectedValue(new Error('timeout'));

            await startMessageConsumer();

            const mockMessage: ConsumeMessage = {
                content: Buffer.from(JSON.stringify(validTextMessage)),
                properties: { headers: {} },
                fields: {} as any,
            };

            if (consumeCallback) {
                await consumeCallback(mockMessage);
            }

            // Wait for setTimeout to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, true);
            expect(mockChannel.ack).not.toHaveBeenCalled();
        });

        it('should route to DLQ after max retries exceeded', async () => {
            mockProcessMessage.mockRejectedValue(new Error('persistent failure'));

            await startMessageConsumer();

            const mockMessage: ConsumeMessage = {
                content: Buffer.from(JSON.stringify(validTextMessage)),
                properties: { headers: { 'x-retry-count': 3 } }, // Already at max retries
                fields: {} as any,
            };

            if (consumeCallback) {
                await consumeCallback(mockMessage);
            }

            expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
                'outbound-transformer-dlq',
                expect.any(Buffer),
                expect.any(Object)
            );
            expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
            expect(mockChannel.nack).not.toHaveBeenCalled();
        });

        it('should ACK non-retryable errors immediately', async () => {
            mockProcessMessage.mockRejectedValue(new Error('Validation failed: invalid field'));

            await startMessageConsumer();

            const mockMessage: ConsumeMessage = {
                content: Buffer.from(JSON.stringify(validTextMessage)),
                properties: { headers: {} },
                fields: {} as any,
            };

            if (consumeCallback) {
                await consumeCallback(mockMessage);
            }

            expect(mockChannel.sendToQueue).toHaveBeenCalled(); // Sent to DLQ
            expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
            expect(mockChannel.nack).not.toHaveBeenCalled();
        });
    });

    describe('Queue Setup', () => {
        it('should assert all required queues on startup', async () => {
            await startMessageConsumer();

            expect(mockChannel.assertQueue).toHaveBeenCalledWith('outbound-processed', { durable: true });
            expect(mockChannel.assertQueue).toHaveBeenCalledWith('outbound-transformer-dlq', { durable: true });
            expect(mockChannel.assertQueue).toHaveBeenCalledWith('outbound-ready', { durable: true });
        });

        it('should set prefetch count', async () => {
            await startMessageConsumer();

            expect(mockChannel.prefetch).toHaveBeenCalledWith(10);
        });

        it('should assert exchange and binding', async () => {
            await startMessageConsumer();

            expect(mockChannel.assertExchange).toHaveBeenCalledWith('outbound.exchange', 'topic', { durable: true });
            expect(mockChannel.bindQueue).toHaveBeenCalledWith(
                'outbound-ready',
                'outbound.exchange',
                'outbound.ready.*'
            );
        });
    });
});
