/**
 * Unit Tests for Transformer Service
 * Tests message transformation logic for all message types and edge cases
 */

import { transformMessage } from '../../../src/services/transformer.service';
import {
    validTextMessage,
    validImageMessage,
    validVideoMessage,
    validDocumentMessage,
    validAudioMessage,
    validAudioWithTextMessage,
} from '../../fixtures/messages';
import { InputMessage, OutputMessage } from '../../../src/types/messages';

// Mock config for testing different behaviors
jest.mock('../../../src/config', () => ({
    default: {
        behavior: {
            unsupportedMime: 'reject',
            audioText: 'separate_message',
        },
    },
}));

describe('Transformer Service', () => {
    describe('transformMessage', () => {
        describe('Text Messages', () => {
            it('should transform text-only message correctly', () => {
                const result = transformMessage(validTextMessage) as OutputMessage;

                expect(result.metadata).toEqual({
                    tenantId: validTextMessage.tenantId,
                    phoneNumberId: validTextMessage.phoneNumberId,
                    internalId: validTextMessage.internalId,
                    correlationId: validTextMessage.genesysId,
                });

                expect(result.wabaPayload).toEqual({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: validTextMessage.waId,
                    type: 'text',
                    text: { body: 'Hello, this is a test message' },
                });
            });

            it('should trim whitespace from text', () => {
                const msg: InputMessage = {
                    ...validTextMessage,
                    payload: { text: '  Hello World  ' },
                };
                const result = transformMessage(msg) as OutputMessage;
                expect(result.wabaPayload.text?.body).toBe('Hello World');
            });
        });

        describe('Image Messages', () => {
            it('should transform image message with caption', () => {
                const result = transformMessage(validImageMessage) as OutputMessage;

                expect(result.wabaPayload.type).toBe('image');
                expect(result.wabaPayload.image).toEqual({
                    link: 'https://example.com/image.jpg',
                    caption: 'Check out this image',
                });
            });

            it('should transform image message without caption', () => {
                const msg: InputMessage = {
                    ...validImageMessage,
                    payload: {
                        media: {
                            url: 'https://example.com/image.jpg',
                            mime_type: 'image/jpeg',
                        },
                    },
                };
                const result = transformMessage(msg) as OutputMessage;

                expect(result.wabaPayload.type).toBe('image');
                expect(result.wabaPayload.image).toEqual({
                    link: 'https://example.com/image.jpg',
                });
            });

            it('should handle PNG images', () => {
                const msg: InputMessage = {
                    ...validImageMessage,
                    payload: {
                        media: {
                            url: 'https://example.com/image.png',
                            mime_type: 'image/png',
                        },
                    },
                };
                const result = transformMessage(msg) as OutputMessage;
                expect(result.wabaPayload.type).toBe('image');
            });

            it('should handle WebP images', () => {
                const msg: InputMessage = {
                    ...validImageMessage,
                    payload: {
                        media: {
                            url: 'https://example.com/image.webp',
                            mime_type: 'image/webp',
                        },
                    },
                };
                const result = transformMessage(msg) as OutputMessage;
                expect(result.wabaPayload.type).toBe('image');
            });
        });

        describe('Video Messages', () => {
            it('should transform video message with caption', () => {
                const result = transformMessage(validVideoMessage) as OutputMessage;

                expect(result.wabaPayload.type).toBe('video');
                expect(result.wabaPayload.video).toEqual({
                    link: 'https://example.com/video.mp4',
                    caption: 'Watch this video',
                });
            });

            it('should transform video message without caption', () => {
                const msg: InputMessage = {
                    ...validVideoMessage,
                    payload: {
                        media: {
                            url: 'https://example.com/video.mp4',
                            mime_type: 'video/mp4',
                        },
                    },
                };
                const result = transformMessage(msg) as OutputMessage;

                expect(result.wabaPayload.type).toBe('video');
                expect(result.wabaPayload.video).toEqual({
                    link: 'https://example.com/video.mp4',
                });
            });
        });

        describe('Document Messages', () => {
            it('should transform document message with filename', () => {
                const result = transformMessage(validDocumentMessage) as OutputMessage;

                expect(result.wabaPayload.type).toBe('document');
                expect(result.wabaPayload.document).toEqual({
                    link: 'https://example.com/document.pdf',
                    filename: 'document.pdf',
                });
            });

            it('should extract filename from URL if not provided', () => {
                const msg: InputMessage = {
                    ...validDocumentMessage,
                    payload: {
                        media: {
                            url: 'https://example.com/files/report.pdf',
                            mime_type: 'application/pdf',
                        },
                    },
                };
                const result = transformMessage(msg) as OutputMessage;

                expect(result.wabaPayload.document?.filename).toBe('report.pdf');
            });

            it('should use default filename if extraction fails', () => {
                const msg: InputMessage = {
                    ...validDocumentMessage,
                    payload: {
                        media: {
                            url: 'https://example.com/files',
                            mime_type: 'application/pdf',
                        },
                    },
                };
                const result = transformMessage(msg) as OutputMessage;

                expect(result.wabaPayload.document?.filename).toBe('document');
            });

            it('should include caption for documents', () => {
                const msg: InputMessage = {
                    ...validDocumentMessage,
                    payload: {
                        text: 'Here is the report',
                        media: {
                            url: 'https://example.com/report.pdf',
                            mime_type: 'application/pdf',
                        },
                    },
                };
                const result = transformMessage(msg) as OutputMessage;

                expect(result.wabaPayload.document?.caption).toBe('Here is the report');
            });
        });

        describe('Audio Messages', () => {
            it('should transform audio message', () => {
                const result = transformMessage(validAudioMessage) as OutputMessage;

                expect(result.wabaPayload.type).toBe('audio');
                expect(result.wabaPayload.audio).toEqual({
                    link: 'https://example.com/audio.mp3',
                });
            });

            it('should not include caption for audio (WhatsApp restriction)', () => {
                const result = transformMessage(validAudioMessage) as OutputMessage;
                expect(result.wabaPayload.audio?.caption).toBeUndefined();
            });
        });

        describe('Audio with Text (AUDIO_TEXT_BEHAVIOR)', () => {
            it('should split audio and text into separate messages', () => {
                const result = transformMessage(validAudioWithTextMessage);

                expect(Array.isArray(result)).toBe(true);
                const messages = result as OutputMessage[];
                expect(messages).toHaveLength(2);

                // First message should be audio
                expect(messages[0].wabaPayload.type).toBe('audio');
                expect(messages[0].wabaPayload.audio).toEqual({
                    link: 'https://example.com/audio.mp3',
                });

                // Second message should be text
                expect(messages[1].wabaPayload.type).toBe('text');
                expect(messages[1].wabaPayload.text).toEqual({
                    body: 'Listen to this',
                });
            });
        });

        describe('Caption Truncation', () => {
            it('should truncate caption exceeding MAX_CAPTION_LENGTH', () => {
                const longCaption = 'a'.repeat(1500);
                const msg: InputMessage = {
                    ...validImageMessage,
                    payload: {
                        text: longCaption,
                        media: {
                            url: 'https://example.com/image.jpg',
                            mime_type: 'image/jpeg',
                        },
                    },
                };

                const result = transformMessage(msg) as OutputMessage;
                expect(result.wabaPayload.image?.caption?.length).toBe(1024);
            });

            it('should not modify caption under MAX_CAPTION_LENGTH', () => {
                const caption = 'Short caption';
                const msg: InputMessage = {
                    ...validImageMessage,
                    payload: {
                        text: caption,
                        media: {
                            url: 'https://example.com/image.jpg',
                            mime_type: 'image/jpeg',
                        },
                    },
                };

                const result = transformMessage(msg) as OutputMessage;
                expect(result.wabaPayload.image?.caption).toBe(caption);
            });

            it('should ignore empty caption', () => {
                const msg: InputMessage = {
                    ...validImageMessage,
                    payload: {
                        text: '   ',
                        media: {
                            url: 'https://example.com/image.jpg',
                            mime_type: 'image/jpeg',
                        },
                    },
                };

                const result = transformMessage(msg) as OutputMessage;
                expect(result.wabaPayload.image?.caption).toBeUndefined();
            });
        });

        describe('Unsupported MIME Types', () => {
            it('should throw error for unsupported MIME type (reject mode)', () => {
                const msg: InputMessage = {
                    ...validImageMessage,
                    payload: {
                        media: {
                            url: 'https://example.com/file.xyz',
                            mime_type: 'application/xyz',
                        },
                    },
                };

                expect(() => transformMessage(msg)).toThrow('Unsupported MIME type: application/xyz');
            });
        });

        describe('Metadata Population', () => {
            it('should correctly populate metadata from InputMessage', () => {
                const result = transformMessage(validTextMessage) as OutputMessage;

                expect(result.metadata.tenantId).toBe(validTextMessage.tenantId);
                expect(result.metadata.phoneNumberId).toBe(validTextMessage.phoneNumberId);
                expect(result.metadata.internalId).toBe(validTextMessage.internalId);
                expect(result.metadata.correlationId).toBe(validTextMessage.genesysId);
            });
        });

        describe('Edge Cases', () => {
            it('should throw error if neither text nor media is present', () => {
                const msg: InputMessage = {
                    ...validTextMessage,
                    payload: {},
                };

                expect(() => transformMessage(msg)).toThrow('Message has neither text nor media payload');
            });
        });
    });
});
