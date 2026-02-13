/**
 * Unit Tests for Message Processor Service
 * Tests the orchestration of transform and dispatch
 */

import { processOutboundMessage } from '../../../src/services/message-processor.service';
import { transformMessage } from '../../../src/services/transformer.service';
import { dispatch } from '../../../src/services/dispatcher.service';
import * as fixtures from '../../fixtures/messages';

// Mock dependencies
jest.mock('../../../src/services/transformer.service');
jest.mock('../../../src/services/dispatcher.service');

const mockTransformMessage = transformMessage as jest.MockedFunction<typeof transformMessage>;
const mockDispatch = dispatch as jest.MockedFunction<typeof dispatch>;

describe('Message Processor Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('processOutboundMessage', () => {
        it('should transform and dispatch a message', async () => {
            const mockTransformed = {
                metadata: {
                    tenantId: 'tenant-123',
                    phoneNumberId: '987654321',
                    internalId: fixtures.validTextMessage.internalId,
                    correlationId: 'genesys-789',
                },
                wabaPayload: {
                    messaging_product: 'whatsapp' as const,
                    recipient_type: 'individual' as const,
                    to: '1234567890',
                    type: 'text' as const,
                    text: { body: 'Hello, this is a test message' },
                },
            };

            mockTransformMessage.mockReturnValue(mockTransformed);
            mockDispatch.mockResolvedValue();

            await processOutboundMessage(fixtures.validTextMessage);

            expect(mockTransformMessage).toHaveBeenCalledWith(fixtures.validTextMessage);
            expect(mockDispatch).toHaveBeenCalledWith(mockTransformed);
        });

        it('should handle array of transformed messages', async () => {
            const mockTransformed = [
                {
                    metadata: {
                        tenantId: 'tenant-123',
                        phoneNumberId: '987654321',
                        internalId: fixtures.validTextMessage.internalId,
                        correlationId: 'genesys-789',
                    },
                    wabaPayload: {
                        messaging_product: 'whatsapp' as const,
                        recipient_type: 'individual' as const,
                        to: '1234567890',
                        type: 'audio' as const,
                        audio: { link: 'https://example.com/audio.mp3' },
                    },
                },
                {
                    metadata: {
                        tenantId: 'tenant-123',
                        phoneNumberId: '987654321',
                        internalId: fixtures.validTextMessage.internalId,
                        correlationId: 'genesys-789',
                    },
                    wabaPayload: {
                        messaging_product: 'whatsapp' as const,
                        recipient_type: 'individual' as const,
                        to: '1234567890',
                        type: 'text' as const,
                        text: { body: 'Audio caption' },
                    },
                },
            ];

            mockTransformMessage.mockReturnValue(mockTransformed);
            mockDispatch.mockResolvedValue();

            await processOutboundMessage(fixtures.validTextMessage);

            expect(mockTransformMessage).toHaveBeenCalledWith(fixtures.validTextMessage);
            expect(mockDispatch).toHaveBeenCalledWith(mockTransformed);
        });

        it('should propagate transformation errors', async () => {
            const error = new Error('Transformation failed');
            mockTransformMessage.mockImplementation(() => {
                throw error;
            });

            await expect(processOutboundMessage(fixtures.validTextMessage)).rejects.toThrow('Transformation failed');
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        it('should propagate dispatch errors', async () => {
            const mockTransformed = {
                metadata: {
                    tenantId: 'tenant-123',
                    phoneNumberId: '987654321',
                    internalId: fixtures.validTextMessage.internalId,
                    correlationId: 'genesys-789',
                },
                wabaPayload: {
                    messaging_product: 'whatsapp' as const,
                    recipient_type: 'individual' as const,
                    to: '1234567890',
                    type: 'text' as const,
                    text: { body: 'Test' },
                },
            };

            mockTransformMessage.mockReturnValue(mockTransformed);
            mockDispatch.mockRejectedValue(new Error('Dispatch failed'));

            await expect(processOutboundMessage(fixtures.validTextMessage)).rejects.toThrow('Dispatch failed');
        });
    });
});
