/**
 * URL Utilities
 * Per FRD - filename extraction from media URLs
 */

/**
 * Extract filename from a URL path
 * Removes query parameters and returns the last path segment
 * @param url - The media URL
 * @returns Filename or null if extraction fails
 */
export function extractFilenameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    if (pathSegments.length === 0) return null;

    const lastSegment = pathSegments[pathSegments.length - 1];
    // Decode URI-encoded characters
    const decoded = decodeURIComponent(lastSegment);
    // Return only if it looks like a filename (has an extension)
    if (decoded.includes('.')) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}
