/**
 * Unit Tests for URL Utilities
 * Tests filename extraction from URLs
 */

import { extractFilenameFromUrl } from '../../../src/utils/url.utils';

describe('URL Utilities', () => {
    describe('extractFilenameFromUrl', () => {
        it('should extract filename from simple URL', () => {
            const url = 'https://example.com/document.pdf';
            expect(extractFilenameFromUrl(url)).toBe('document.pdf');
        });

        it('should extract filename from nested path', () => {
            const url = 'https://example.com/files/reports/2024/report.pdf';
            expect(extractFilenameFromUrl(url)).toBe('report.pdf');
        });

        it('should extract filename with multiple extensions', () => {
            const url = 'https://example.com/archive.tar.gz';
            expect(extractFilenameFromUrl(url)).toBe('archive.tar.gz');
        });

        it('should decode URI-encoded filenames', () => {
            const url = 'https://example.com/my%20document.pdf';
            expect(extractFilenameFromUrl(url)).toBe('my document.pdf');
        });

        it('should decode complex URI-encoded filenames', () => {
            const url = 'https://example.com/file%20%282%29.pdf';
            expect(extractFilenameFromUrl(url)).toBe('file (2).pdf');
        });

        it('should ignore query parameters', () => {
            const url = 'https://example.com/document.pdf?version=1&token=abc123';
            expect(extractFilenameFromUrl(url)).toBe('document.pdf');
        });

        it('should ignore hash fragments', () => {
            const url = 'https://example.com/document.pdf#page=5';
            expect(extractFilenameFromUrl(url)).toBe('document.pdf');
        });

        it('should return null for URL without extension', () => {
            const url = 'https://example.com/files';
            expect(extractFilenameFromUrl(url)).toBeNull();
        });

        it('should return null for URL with directory path only', () => {
            const url = 'https://example.com/files/';
            expect(extractFilenameFromUrl(url)).toBeNull();
        });

        it('should return null for empty path', () => {
            const url = 'https://example.com/';
            expect(extractFilenameFromUrl(url)).toBeNull();
        });

        it('should return null for invalid URL', () => {
            const url = 'not-a-valid-url';
            expect(extractFilenameFromUrl(url)).toBeNull();
        });

        it('should handle URLs with port numbers', () => {
            const url = 'https://example.com:8080/files/document.pdf';
            expect(extractFilenameFromUrl(url)).toBe('document.pdf');
        });

        it('should handle data URLs gracefully', () => {
            const url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
            expect(extractFilenameFromUrl(url)).toBeNull();
        });

        it('should handle file protocol URLs', () => {
            const url = 'file:///home/user/document.pdf';
            expect(extractFilenameFromUrl(url)).toBe('document.pdf');
        });

        it('should handle special characters in filename', () => {
            const url = 'https://example.com/file-name_v1.2.pdf';
            expect(extractFilenameFromUrl(url)).toBe('file-name_v1.2.pdf');
        });
    });
});
