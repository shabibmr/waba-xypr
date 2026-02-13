/**
 * Unit Tests for Dispatcher Service
 * Tests queue and HTTP dispatch logic with mocked dependencies
 */

import { initDispatcher, dispatch } from '../../../src/services/dispatcher.service';
import { OutputMessage } from '../../../src/types/messages';
import { Channel } from 'amqplib';
import axios from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('../../../src/config', () => ({
    default: {
        rabbitmq: {
            exchange: 'outbound.exchange',
            outputQueue: 'outbound-ready',
        },
        services: {
            whatsappService: 'http://whatsapp-api-service:3008',
        },
        pipelineMode: false,
    },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Dispatcher Service', () => {
    let mockChannel: jest.Mocked<Channel>;

    beforeEach(() => {
        // Create mock channel
        mockChannel = {
            assertExchange: jest.fn().mockResolvedValue({}),
            assertQueue: jest.fn().mockResolvedValue({}),
            bindQueue: jest.fn().mockResolvedValue({}),
            publish: jest.fn().mockReturnValue(true),
        } as any;

        jest.clearAllMocks();
    });

    describe('initDispatcher', () => {
        it('should assert exchange, queue, and binding', async () => {
            await initDispatcher(mockChannel);

            expect(mockChannel.assertExchange).toHaveBeenCalledWith(
                'outbound.exchange',
                'topic',
                { durable: true }
            );
            expect(mockChannel.assertQueue).toHaveBeenCalledWith(
                'outbound-ready',
                { durable: true }
            );
            expect(mockChannel.bindQueue).toHaveBeenCalledWith(
                'outbound-ready',
                'outbound.exchange',
                'outbound.ready.*'
            );
        });
    });

    describe('dispatch - Queue Mode', () => {
        const mockOutputMessage: OutputMessage = {
            metadata: {
                tenantId: 'tenant-123',
                phoneNumberId: '987654321',
                internalId: '123e4567-e89b-42d3-a456-426614174000',
                correlationId: 'genesys-789',
            },
            wabaPayload: {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: '1234567890',
                type: 'text',
                text: { body: 'Test message' },
            },
        };

        beforeEach(async () => {
            await initDispatcher(mockChannel);
        });

        it('should publish message to queue with correct routing key', async () => {
            await dispatch(mockOutputMessage);

            expect(mockChannel.publish).toHaveBeenCalledWith(
                'outbound.exchange',
                'outbound.ready.tenant-123',
                expect.any(Buffer),
                expect.objectContaining({
                    persistent: true,
                    contentType: 'application/json',
                })
            );
        });

        it('should publish message with correct headers', async () => {
            await dispatch(mockOutputMessage);

            const publishCall = mockChannel.publish.mock.calls[0];
            const options = publishCall[3];

            expect(options.headers['X-Tenant-ID']).toBe('tenant-123');
            expect(options.headers['X-Correlation-ID']).toBe('genesys-789');
            expect(options.headers['X-Message-Type']).toBe('outbound');
            expect(options.headers['X-Timestamp']).toBeDefined();
        });

        it('should publish message with correct content', async () => {
            await dispatch(mockOutputMessage);

            const publishCall = mockChannel.publish.mock.calls[0];
            const content = publishCall[2];
            const parsedContent = JSON.parse(content.toString());

            expect(parsedContent).toEqual(mockOutputMessage);
        });

        it('should handle array of messages', async () => {
            const messages: OutputMessage[] = [
                mockOutputMessage,
                { ...mockOutputMessage, metadata: { ...mockOutputMessage.metadata, internalId: 'msg-2' } },
            ];

            await dispatch(messages);

            expect(mockChannel.publish).toHaveBeenCalledTimes(2);
        });

        it('should throw error if channel not initialized', async () => {
            // Create new dispatcher without initializing
            const { dispatch: uninitializedDispatch } = require('../../../src/services/dispatcher.service');

            await expect(
                uninitializedDispatch(mockOutputMessage)
            ).rejects.toThrow('Dispatcher not initialized');
        });

        it('should throw error if publish fails (backpressure)', async () => {
            mockChannel.publish.mockReturnValue(false);

            await expect(dispatch(mockOutputMessage)).rejects.toThrow(
                'RabbitMQ publish failed - channel backpressure'
            );
        });
    });

    describe('dispatch - HTTP Mode', () => {
        const mockOutputMessage: OutputMessage = {
            metadata: {
                tenantId: 'tenant-123',
                phoneNumberId: '987654321',
                internalId: '123e4567-e89b-42d3-a456-426614174000',
                correlationId: 'genesys-789',
            },
            wabaPayload: {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: '1234567890',
                type: 'text',
                text: { body: 'Test message' },
            },
        };

        beforeEach(() => {
            // Mock config for HTTP mode
            jest.resetModules();
            jest.mock('../../../src/config', () => ({
                default: {
                    rabbitmq: {
                        exchange: 'outbound.exchange',
                        outputQueue: 'outbound-ready',
                    },
                    services: {
                        whatsappService: 'http://whatsapp-api-service:3008',
                    },
                    pipelineMode: true, // Enable HTTP mode
                },
            }));
        });

        afterEach(() => {
            jest.resetModules();
        });

        it('should dispatch via HTTP in pipeline mode', async () => {
            mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

            const { dispatch: httpDispatch, initDispatcher: httpInit } = require('../../../src/services/dispatcher.service');
            await httpInit(mockChannel);
            await httpDispatch(mockOutputMessage);

            expect(mockedAxios.post).toHaveBeenCalledWith(
                'http://whatsapp-api-service:3008/whatsapp/send',
                mockOutputMessage,
                expect.objectContaining({
                    headers: {
                        'X-Tenant-ID': 'tenant-123',
                        'X-Correlation-ID': 'genesys-789',
                        'Content-Type': 'application/json',
                    },
                    timeout: 10000,
                })
            );
        });
    });
});
