import logger from './logger';

const DEFAULT_MEDIA_DOMAINS = ['minio.internal.company.com', 's3.amazonaws.com'];
const ALLOWED_MEDIA_DOMAINS = process.env.ALLOWED_MEDIA_DOMAINS
  ? process.env.ALLOWED_MEDIA_DOMAINS.split(',').map(d => d.trim()).filter(Boolean)
  : DEFAULT_MEDIA_DOMAINS;

export function validateE164(phone: string): boolean {
  const e164Pattern = /^\+?[1-9]\d{1,14}$/;
  return e164Pattern.test(phone);
}

export function validateMediaUrl(url: string | null | undefined): boolean {
  if (!url) return true;

  try {
    const parsed = new URL(url);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      logger.warn('Invalid media URL scheme', { scheme: parsed.protocol });
      return false;
    }

    const valid = ALLOWED_MEDIA_DOMAINS.some(domain =>
      parsed.hostname.endsWith(domain)
    );

    if (!valid) {
      logger.warn('Media URL from untrusted domain', { hostname: parsed.hostname });
    }

    return valid;
  } catch {
    return false;
  }
}
