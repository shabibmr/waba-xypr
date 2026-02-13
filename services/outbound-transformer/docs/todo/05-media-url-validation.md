# Phase 5: Media URL Validation & Signed URL Generation

**Priority:** High | **Depends on:** Phase 2 (Transformation Logic)
**FRD Refs:** REQ-OUT-03 (Step 2), Section 5.2, Section 10.2

---

## Gap Summary

The current service passes media URLs through as-is. No validation, no SSRF protection, no signed URL generation. Internal storage URLs (e.g., `https://minio.internal/...`) will be unreachable by WhatsApp servers.

---

## Current State

- **URL validation:** None -- any string accepted as URL
- **HTTPS enforcement:** No check
- **Private IP protection:** No SSRF defense
- **Internal URL detection:** No detection of MinIO/internal URLs
- **Signed URL generation:** No MinIO/S3 client installed
- **URL length validation:** No check against 2048-char WhatsApp limit

## Expected State (FRD)

1. Parse and validate URL format
2. Enforce HTTPS scheme
3. Resolve hostname and reject private IPs (SSRF protection)
4. Detect internal storage URLs (MinIO, localhost, configured domain)
5. Generate presigned public URLs for internal storage (10-min expiry)
6. Validate URL length <= 2048 chars
7. Optional: HEAD request to verify URL accessibility

---

## Tasks

### T5.1 - Implement URL Validation Utility
- Create `src/utils/url.utils.ts` (or expand existing)
- `validateMediaUrl(url: string): { valid: boolean; errors: string[] }`
  - Parse URL (catch malformed)
  - Check scheme is `https`
  - Check hostname exists
  - Check URL length <= 2048 chars
  - Block `localhost`, `127.0.0.1`, `0.0.0.0`

### T5.2 - Implement Private IP Detection (SSRF Protection)
- In `src/utils/url.utils.ts`:
- `isPrivateIp(ip: string): boolean`
  - Check against RFC 1918 ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
  - Check loopback: `127.0.0.0/8`
  - Check link-local: `169.254.0.0/16`
  - Use Node.js `net` module or `ipaddr.js` library
- `resolveAndCheckHostname(hostname: string): Promise<void>`
  - DNS resolve hostname
  - Check resolved IP against private ranges
  - Throw `ValidationError` if private

### T5.3 - Implement Internal Storage URL Detection
- `isInternalStorageUrl(url: string): boolean`
- Check hostname against configurable list:
  ```typescript
  const internalDomains = [
    'minio.internal',
    'localhost',
    '127.0.0.1',
    config.storage.internalDomain, // from env
  ];
  ```
- Config: `INTERNAL_STORAGE_DOMAIN` env var

### T5.4 - Add MinIO/S3 Client for Signed URLs
- `npm install minio` (or `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`)
- Create `src/services/storage.service.ts`
- Initialize client from config
- `generateSignedUrl(internalUrl: string, expirationSeconds: number): Promise<string>`
  - Parse internal URL to extract bucket name and object key
  - Generate presigned GET URL with configured expiration (default 600s / 10 min)
  - Log URL generation for audit
- Config env vars:
  ```
  STORAGE_TYPE=minio  # or s3
  STORAGE_ENDPOINT=https://minio.example.com
  STORAGE_ACCESS_KEY=***
  STORAGE_SECRET_KEY=***
  SIGNED_URL_EXPIRATION_SECONDS=600
  ```

### T5.5 - Integrate URL Validation into Media Transformation
- In transformer.service.ts media flow:
  1. Validate URL format and HTTPS
  2. Check if internal storage URL → generate signed URL
  3. If not internal: resolve hostname, check for private IP
  4. Validate final URL length <= 2048
  5. Use validated/signed URL in output payload

### T5.6 - Optional: URL Accessibility Check
- Config: `VALIDATE_URL_ACCESSIBILITY` env var (default: `false`)
- If enabled: HTTP HEAD request to URL, check for 200 response
- Timeout: 5 seconds
- On failure: log warning (don't block -- URL may be temporarily unavailable)

### T5.7 - Update .env.example
- Add all storage and URL validation env vars

---

## Acceptance Criteria

- [ ] Non-HTTPS URLs rejected with error
- [ ] Private IPs detected and rejected (10.x, 172.16-31.x, 192.168.x, 127.x)
- [ ] Localhost URLs rejected
- [ ] Internal storage URLs (MinIO) converted to presigned public URLs
- [ ] Signed URL expiration configurable (default 10 min)
- [ ] URL length > 2048 chars rejected
- [ ] DNS resolution errors caught and reported
- [ ] Storage client connection failure handled gracefully
