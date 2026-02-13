/**
 * Unit Tests for Validator Service
 * Tests input validation for all required fields and edge cases
 */

import { validateInputMessage } from '../../../src/services/validator.service';
import {
    validTextMessage,
    validImageMessage,
    invalidMessage_MissingInternalId,
    invalidMessage_InvalidUUID,
    invalidMessage_InvalidWaId,
    invalidMessage_NoPayload,
    invalidMessage_EmptyText,
    invalidMessage_TextTooLong,
    invalidMessage_MediaMissingUrl,
} from '../../fixtures/messages';

describe('Validator Service', () => {
    describe('validateInputMessage', () => {
        describe('Valid Messages', () => {
            it('should validate a valid text message', () => {
                const result = validateInputMessage(validTextMessage);
                expect(result.valid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            it('should validate a valid image message', () => {
                const result = validateInputMessage(validImageMessage);
                expect(result.valid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });
        });

        describe('Required Fields', () => {
            it('should reject message with missing internalId', () => {
                const result = validateInputMessage(invalidMessage_MissingInternalId);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('internalId is required and must be a string');
            });

            it('should reject non-object message', () => {
                const result = validateInputMessage(null);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Message must be a non-null object');
            });

            it('should reject message with invalid UUID format', () => {
                const result = validateInputMessage(invalidMessage_InvalidUUID);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('internalId must be a valid UUID v4');
            });

            it('should reject message with missing tenantId', () => {
                const msg = { ...validTextMessage, tenantId: undefined };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.includes('tenantId'))).toBe(true);
            });

            it('should reject message with empty tenantId', () => {
                const msg = { ...validTextMessage, tenantId: '   ' };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('tenantId must be non-empty');
            });

            it('should reject message with missing conversationId', () => {
                const msg = { ...validTextMessage, conversationId: undefined };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.includes('conversationId'))).toBe(true);
            });

            it('should reject message with conversationId too long', () => {
                const msg = { ...validTextMessage, conversationId: 'a'.repeat(300) };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('conversationId must be 1-255 characters');
            });

            it('should reject message with missing genesysId', () => {
                const msg = { ...validTextMessage, genesysId: undefined };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.includes('genesysId'))).toBe(true);
            });

            it('should reject message with invalid waId format', () => {
                const result = validateInputMessage(invalidMessage_InvalidWaId);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('waId must match E.164 format without +: 7-15 digits starting with non-zero');
            });

            it('should reject message with missing phoneNumberId', () => {
                const msg = { ...validTextMessage, phoneNumberId: undefined };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.includes('phoneNumberId'))).toBe(true);
            });

            it('should reject message with non-numeric phoneNumberId', () => {
                const msg = { ...validTextMessage, phoneNumberId: 'abc123' };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('phoneNumberId must be a numeric string');
            });
        });

        describe('Timestamp Validation', () => {
            it('should reject message with missing timestamp', () => {
                const msg = { ...validTextMessage, timestamp: undefined };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('timestamp is required');
            });

            it('should reject message with non-number timestamp', () => {
                const msg = { ...validTextMessage, timestamp: '1707782400' as any };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('timestamp must be a finite number');
            });

            it('should reject message with timestamp too small', () => {
                const msg = { ...validTextMessage, timestamp: 999999999 };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.includes('timestamp must be between'))).toBe(true);
            });

            it('should reject message with timestamp too large', () => {
                const msg = { ...validTextMessage, timestamp: 10000000000 };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.includes('timestamp must be between'))).toBe(true);
            });
        });

        describe('Type Validation', () => {
            it('should reject message with wrong type', () => {
                const msg = { ...validTextMessage, type: 'event' as any };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain("type must be 'message'");
            });
        });

        describe('Payload Validation', () => {
            it('should reject message with missing payload', () => {
                const msg = { ...validTextMessage, payload: undefined };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('payload is required and must be an object');
            });

            it('should reject message with empty payload', () => {
                const result = validateInputMessage(invalidMessage_NoPayload);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('payload must contain at least text or media');
            });

            it('should reject message with empty text', () => {
                const result = validateInputMessage(invalidMessage_EmptyText);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('payload.text must be non-empty after trimming');
            });

            it('should reject message with text too long', () => {
                const result = validateInputMessage(invalidMessage_TextTooLong);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('payload.text must not exceed 4096 characters');
            });

            it('should reject message with non-string text', () => {
                const msg = { ...validTextMessage, payload: { text: 123 } };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('payload.text must be a string');
            });
        });

        describe('Media Validation', () => {
            it('should reject media without url', () => {
                const result = validateInputMessage(invalidMessage_MediaMissingUrl);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('payload.media.url is required and must be a string');
            });

            it('should reject media without mime_type', () => {
                const msg = {
                    ...validTextMessage,
                    payload: { media: { url: 'https://example.com/file' } },
                };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('payload.media.mime_type is required and must be a string');
            });

            it('should reject media with non-string filename', () => {
                const msg = {
                    ...validImageMessage,
                    payload: {
                        media: {
                            url: 'https://example.com/image.jpg',
                            mime_type: 'image/jpeg',
                            filename: 123 as any,
                        },
                    },
                };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('payload.media.filename must be a string if provided');
            });

            it('should accept media with optional filename', () => {
                const msg = {
                    ...validImageMessage,
                    payload: {
                        media: {
                            url: 'https://example.com/image.jpg',
                            mime_type: 'image/jpeg',
                            filename: 'my-image.jpg',
                        },
                    },
                };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(true);
            });

            it('should accept media without filename', () => {
                const msg = {
                    ...validImageMessage,
                    payload: {
                        media: {
                            url: 'https://example.com/image.jpg',
                            mime_type: 'image/jpeg',
                        },
                    },
                };
                const result = validateInputMessage(msg);
                expect(result.valid).toBe(true);
            });
        });
    });
});
