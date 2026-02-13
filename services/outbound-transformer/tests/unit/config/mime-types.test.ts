/**
 * Unit Tests for MIME Type Mapping
 * Tests MIME type to WhatsApp message type conversion
 */

import { getWhatsAppType, isSupportedMimeType } from '../../../src/config/mime-types';

describe('MIME Type Mapping', () => {
    describe('getWhatsAppType', () => {
        describe('Image Types', () => {
            it('should map image/jpeg to image', () => {
                expect(getWhatsAppType('image/jpeg')).toBe('image');
            });

            it('should map image/png to image', () => {
                expect(getWhatsAppType('image/png')).toBe('image');
            });

            it('should map image/webp to image', () => {
                expect(getWhatsAppType('image/webp')).toBe('image');
            });

            it('should handle case-insensitive MIME types', () => {
                expect(getWhatsAppType('IMAGE/JPEG')).toBe('image');
                expect(getWhatsAppType('ImAgE/PnG')).toBe('image');
            });

            it('should handle MIME types with whitespace', () => {
                expect(getWhatsAppType('  image/jpeg  ')).toBe('image');
            });
        });

        describe('Video Types', () => {
            it('should map video/mp4 to video', () => {
                expect(getWhatsAppType('video/mp4')).toBe('video');
            });

            it('should map video/3gpp to video', () => {
                expect(getWhatsAppType('video/3gpp')).toBe('video');
            });
        });

        describe('Document Types', () => {
            it('should map application/pdf to document', () => {
                expect(getWhatsAppType('application/pdf')).toBe('document');
            });

            it('should map text/plain to document', () => {
                expect(getWhatsAppType('text/plain')).toBe('document');
            });

            it('should map text/csv to document', () => {
                expect(getWhatsAppType('text/csv')).toBe('document');
            });

            it('should map Microsoft Office formats to document', () => {
                expect(getWhatsAppType('application/msword')).toBe('document');
                expect(getWhatsAppType('application/vnd.ms-excel')).toBe('document');
                expect(getWhatsAppType('application/vnd.ms-powerpoint')).toBe('document');
            });

            it('should map Office Open XML formats to document', () => {
                expect(
                    getWhatsAppType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
                ).toBe('document');
                expect(
                    getWhatsAppType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                ).toBe('document');
                expect(
                    getWhatsAppType('application/vnd.openxmlformats-officedocument.presentationml.presentation')
                ).toBe('document');
            });
        });

        describe('Audio Types', () => {
            it('should map audio/aac to audio', () => {
                expect(getWhatsAppType('audio/aac')).toBe('audio');
            });

            it('should map audio/mp4 to audio', () => {
                expect(getWhatsAppType('audio/mp4')).toBe('audio');
            });

            it('should map audio/mpeg to audio', () => {
                expect(getWhatsAppType('audio/mpeg')).toBe('audio');
            });

            it('should map audio/amr to audio', () => {
                expect(getWhatsAppType('audio/amr')).toBe('audio');
            });

            it('should map audio/ogg to audio', () => {
                expect(getWhatsAppType('audio/ogg')).toBe('audio');
            });
        });

        describe('Unsupported Types', () => {
            it('should return null for unsupported MIME type', () => {
                expect(getWhatsAppType('application/xyz')).toBeNull();
            });

            it('should return null for video/mkv', () => {
                expect(getWhatsAppType('video/mkv')).toBeNull();
            });

            it('should return null for image/gif', () => {
                expect(getWhatsAppType('image/gif')).toBeNull();
            });

            it('should return null for empty string', () => {
                expect(getWhatsAppType('')).toBeNull();
            });
        });
    });

    describe('isSupportedMimeType', () => {
        it('should return true for supported image types', () => {
            expect(isSupportedMimeType('image/jpeg')).toBe(true);
            expect(isSupportedMimeType('image/png')).toBe(true);
        });

        it('should return true for supported video types', () => {
            expect(isSupportedMimeType('video/mp4')).toBe(true);
        });

        it('should return true for supported document types', () => {
            expect(isSupportedMimeType('application/pdf')).toBe(true);
        });

        it('should return true for supported audio types', () => {
            expect(isSupportedMimeType('audio/mpeg')).toBe(true);
        });

        it('should return false for unsupported types', () => {
            expect(isSupportedMimeType('application/xyz')).toBe(false);
            expect(isSupportedMimeType('video/mkv')).toBe(false);
        });
    });
});
