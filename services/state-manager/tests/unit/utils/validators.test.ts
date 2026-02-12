import { validateE164, validateMediaUrl } from '../../../src/utils/validation';

describe('Validators', () => {
    // ==================== validateE164 ====================

    describe('validateE164', () => {
        const validPhones = [
            '919876543210',
            '+919876543210',
            '14155552671',
            '+14155552671',
            '1234567890',
        ];

        test.each(validPhones)('"%s" should be valid', (phone) => {
            expect(validateE164(phone)).toBe(true);
        });

        const invalidPhones = [
            '',
            'abc',
            '0123456789',      // starts with 0
            '+0123456789',     // starts with +0
            '123456789012345678', // too long (>15)
        ];

        test.each(invalidPhones)('"%s" should be invalid', (phone) => {
            expect(validateE164(phone)).toBe(false);
        });
    });

    // ==================== validateMediaUrl ====================

    describe('validateMediaUrl', () => {
        it('should return true for null/undefined (no media)', () => {
            expect(validateMediaUrl(null)).toBe(true);
            expect(validateMediaUrl(undefined)).toBe(true);
        });

        it('should accept allowed domains', () => {
            expect(validateMediaUrl('https://minio.internal.company.com/bucket/file.jpg')).toBe(true);
            expect(validateMediaUrl('https://s3.amazonaws.com/bucket/file.png')).toBe(true);
        });

        it('should reject untrusted domains', () => {
            expect(validateMediaUrl('https://evil.com/malware.exe')).toBe(false);
            expect(validateMediaUrl('https://example.com/image.jpg')).toBe(false);
        });

        it('should reject non-http schemes', () => {
            expect(validateMediaUrl('ftp://s3.amazonaws.com/file.jpg')).toBe(false);
        });

        it('should reject malformed URLs', () => {
            expect(validateMediaUrl('not-a-url')).toBe(false);
            expect(validateMediaUrl('://missing-scheme')).toBe(false);
        });
    });
});
