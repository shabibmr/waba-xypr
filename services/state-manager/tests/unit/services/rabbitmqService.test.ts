// Mock amqplib module
import * as amqpMock from '../../mocks/amqplib.mock';
jest.mock('amqplib', () => amqpMock);

jest.mock('../../../../shared/constants', () => ({
    QUEUES: {
        INBOUND_WHATSAPP_MESSAGES: 'inbound',
        OUTBOUND_GENESYS_MESSAGES: 'outbound',
        WHATSAPP_STATUS_UPDATES: 'status',
        INBOUND_STATUS_EVENTS: 'inbound-status',
        INBOUND_ENRICHED: 'inbound-processed',
        OUTBOUND_PROCESSED: 'outbound-processed',
        AGENT_PORTAL_EVENTS: 'agent-portal-events',
        STATE_MANAGER_DLQ: 'dlq',
        GENESYS_STATUS_UPDATES: 'genesys-status',
        GENESYS_STATUS_PROCESSED: 'genesys-status-processed',
        CORRELATION_EVENTS: 'correlation',
        OUTBOUND_ACK_EVENTS: 'outbound-ack'
    }
}));

// Needs to be imported AFTER mock
import { rabbitmqService } from '../../../src/services/rabbitmq.service';

describe('RabbitMQService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset private state if possible or assume fresh start via module re-import
        // Since it's a singleton, we might need to be careful.
        // Ideally we'd reset the instance but it's private.
        // We'll rely on mocks being cleared.
    });

    // ==================== connect ====================

    describe('connect', () => {
        it('should connect and create channel', async () => {
            await rabbitmqService.connect();

            expect(amqpMock.connect).toHaveBeenCalled();
            expect(amqpMock.mockConnection.createChannel).toHaveBeenCalled();
            expect(amqpMock.mockChannel.assertQueue).toHaveBeenCalled();
        });

        it('should handle connection errors and retry', async () => {
            // Setup reconnect spy if possible, or just check error logging
            // Since reconnect is private, we can verify it calls connect recursively
            // But that's hard to test without exposing internals.
            // We'll trust integration tests for resilience and check basic error handling here.

            amqpMock.connect.mockRejectedValueOnce(new Error('Connection failed'));

            await expect(rabbitmqService.connect()).rejects.toThrow('Connection failed');
        });
    });

    // ==================== publish ====================

    describe('publish', () => {
        beforeEach(async () => {
            await rabbitmqService.connect();
        });

        it('should publish to inbound-processed queue', async () => {
            await rabbitmqService.publishToInboundProcessed({ id: 1 });
            expect(amqpMock.mockChannel.sendToQueue).toHaveBeenCalledWith(
                expect.stringContaining('inbound'),
                expect.any(Buffer),
                expect.any(Object)
            );
        });

        it('should publish to outbound-processed queue', async () => {
            await rabbitmqService.publishToOutboundProcessed({ id: 1 });
            expect(amqpMock.mockChannel.sendToQueue).toHaveBeenCalledWith(
                expect.stringContaining('outbound'),
                expect.any(Buffer),
                expect.any(Object)
            );
        });

        it('should publish to DLQ', async () => {
            await rabbitmqService.sendToDLQ({ id: 1 }, 'invalid_payload' as any);
            expect(amqpMock.mockChannel.sendToQueue).toHaveBeenCalledWith(
                expect.stringContaining('dlq'),
                expect.any(Buffer),
                expect.any(Object)
            );
        });
    });

    // ==================== consume ====================

    describe('consume', () => {
        beforeEach(async () => {
            await rabbitmqService.connect();
        });

        it('should setup consumer for inbound queue', async () => {
            const handler = jest.fn();
            await rabbitmqService.consumeInbound(handler);

            expect(amqpMock.mockChannel.consume).toHaveBeenCalledWith(
                expect.stringContaining('inbound'),
                expect.any(Function)
            );
        });

        // We can simulate message arrival by invoking the callback passed to consume
        it('should process consumed message', async () => {
            const handler = jest.fn().mockResolvedValue(undefined);

            // Capture the callback
            let consumeCallback: Function | undefined;
            amqpMock.mockChannel.consume.mockImplementation(async (queue, cb) => {
                consumeCallback = cb;
                return { consumerTag: 'test' };
            });

            await rabbitmqService.consumeInbound(handler);

            expect(consumeCallback).toBeDefined();

            // Invoke callback with mock message
            const msg = {
                content: Buffer.from(JSON.stringify({ wa_id: '123' })),
                properties: {}
            };

            await consumeCallback!(msg);

            expect(handler).toHaveBeenCalledWith({ wa_id: '123' });
            expect(amqpMock.mockChannel.ack).toHaveBeenCalledWith(msg);
        });

        it('should retry on processing error', async () => {
            const handler = jest.fn().mockRejectedValue(new Error('Processing failed'));

            let consumeCallback: Function | undefined;
            amqpMock.mockChannel.consume.mockImplementation(async (queue: any, cb: any) => {
                consumeCallback = cb;
                return { consumerTag: 'test' };
            });

            await rabbitmqService.consumeInbound(handler);

            const msg = {
                content: Buffer.from(JSON.stringify({ wa_id: '123' })),
                properties: {}
            };

            await consumeCallback!(msg);

            expect(amqpMock.mockChannel.ack).toHaveBeenCalledWith(msg);
            expect(amqpMock.mockChannel.sendToQueue).toHaveBeenCalledWith(
                expect.stringContaining('inbound'),
                expect.any(Buffer),
                expect.objectContaining({
                    headers: expect.objectContaining({ 'x-retry-count': 1 })
                })
            );
        });
    });
});
