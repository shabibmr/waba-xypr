# Phase 2: Transformation Logic Rewrite

**Priority:** Critical | **Depends on:** Phase 1 (Input Schema)
**FRD Refs:** REQ-OUT-02, REQ-OUT-03, Section 3.2, Section 3.3

---

## Gap Summary

The transformer currently operates on flat Genesys fields (`text`, `mediaUrl`, `mediaType`) and outputs a flat Meta API payload. The FRD requires:
1. Reading from `payload.text` / `payload.media` (new schema)
2. Outputting wrapped `{ metadata, wabaPayload }` envelope
3. MIME-type-based media type resolution (not passthrough of `mediaType` string)
4. Caption rules: 1024-char max, no caption on audio
5. Audio+text special handling (configurable behavior)
6. Document filename extraction from URL when not provided
7. Text trimming/whitespace normalization

---

## Current State

| Feature | Status | Detail |
|---------|--------|--------|
| Text transformation | Partial | Reads `genesysMessage.text`, no trim, no length check, no output envelope |
| Media transformation | Partial | Uses `mediaType` passthrough, no MIME mapping |
| Output format | Wrong | Flat `{ messaging_product, to, type, text/image/... }` -- missing `metadata` + `wabaPayload` wrapper |
| MIME type mapping | Missing | FRD has 19 MIME types mapped to 4 WhatsApp types |
| Caption max length | Missing | No 1024-char truncation |
| Audio+text handling | Missing | Audio gets caption (WhatsApp rejects this) |
| Template handling | Non-standard | `{{TEMPLATE:name}}` marker in text -- not in FRD |
| `preview_url` on text | Extra | FRD doesn't specify URL preview; harmless but not required |

## Expected State (FRD)

- Wrapped output: `{ metadata: {...}, wabaPayload: {...} }`
- MIME-type-to-WhatsApp-type map with 19+ entries
- Caption truncation at 1024 chars for image/video/document
- Audio: no caption, configurable behavior for audio+text
- Document: auto-extract filename from URL if not provided

---

## Tasks

### T2.1 - Implement MIME Type Mapping
- Create `src/config/mime-types.ts` (or add to config)
- Full mapping per FRD Section 3.3 + Appendix A:
  ```typescript
  const MIME_TYPE_MAP: Record<string, string> = {
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/webp': 'image',
    'video/mp4': 'video',
    'video/3gpp': 'video',
    'application/pdf': 'document',
    'application/vnd.ms-powerpoint': 'document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
    'application/msword': 'document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
    'application/vnd.ms-excel': 'document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
    'text/plain': 'document',
    'text/csv': 'document',
    'audio/aac': 'audio',
    'audio/mp4': 'audio',
    'audio/mpeg': 'audio',
    'audio/amr': 'audio',
    'audio/ogg': 'audio',
  };
  ```
- Implement `getWhatsAppType(mimeType: string): string | null`
- Case-insensitive lookup (`mime_type.toLowerCase()`)

### T2.2 - Implement Unsupported MIME Behavior
- Add config: `UNSUPPORTED_MIME_BEHAVIOR` env var (default: `reject`)
- Three modes per FRD:
  - `reject`: throw validation error, route to DLQ
  - `convert_to_document`: map to `document` type, use original filename
  - `text_fallback`: drop media, send text-only (log warning)
- Implement `handleUnsupportedMime(mimeType, message)` in transformer

### T2.3 - Rewrite Text Transformation
- Modify `transformer.service.ts`:
  - Input: `InputMessage` (from Phase 1)
  - Trim `payload.text`
  - Validate length (0 < len <= 4096) -- should already pass from validator, but defensive
  - Build output with `metadata` + `wabaPayload` wrapper:
    ```typescript
    {
      metadata: {
        tenantId: input.tenantId,
        phoneNumberId: input.phoneNumberId,
        internalId: input.internalId,
        correlationId: input.genesysId
      },
      wabaPayload: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: input.waId,
        type: 'text',
        text: { body: trimmedText }
      }
    }
    ```

### T2.4 - Rewrite Media Transformation
- Determine WhatsApp type from `payload.media.mime_type` using MIME map (T2.1)
- Handle unsupported MIME per config (T2.2)
- Build media object with `link` from `payload.media.url`
- Caption logic:
  - If audio: **no caption** (skip `payload.text`)
  - If image/video/document and `payload.text` exists:
    - Trim text
    - Truncate to 1024 chars if exceeds (log warning)
    - Set as `caption`
- Document-specific: set `filename` from `payload.media.filename` or extract from URL
- Build output with same `metadata` + `wabaPayload` wrapper

### T2.5 - Implement Audio+Text Special Handling
- Add config: `AUDIO_TEXT_BEHAVIOR` env var (default: `separate_message`)
- Three modes per FRD:
  - `separate_message`: return array of 2 output messages (audio + text)
  - `discard_text`: return audio only, log warning
  - `text_only`: return text only, log warning
- Transformer should return `OutputMessage | OutputMessage[]` to support multi-message

### T2.6 - Implement Filename Extraction Utility
- Create or extend `src/utils/url.utils.ts`
- `extractFilenameFromUrl(url: string): string | null`
  - Parse URL path, extract last segment
  - Remove query params
  - Return filename or null

### T2.7 - Remove Legacy Template Handling
- Remove `{{TEMPLATE:name}}` detection from transformer.service.ts
  - This is a non-standard pattern not in the FRD
  - Template sending is handled by a separate endpoint (`POST /send/template`) already
  - Or keep the template controller as a separate feature outside FRD scope
- Clean up `extractTemplateComponents` import if no longer used in transformer

### T2.8 - Update Config with New Environment Variables
- Add to `src/config/index.ts`:
  ```typescript
  behavior: {
    unsupportedMime: process.env.UNSUPPORTED_MIME_BEHAVIOR || 'reject',
    audioText: process.env.AUDIO_TEXT_BEHAVIOR || 'separate_message',
  }
  ```
- Update `.env.example` with new variables

---

## Acceptance Criteria

- [ ] 19 MIME types correctly mapped to 4 WhatsApp types (image, video, document, audio)
- [ ] Unsupported MIME types handled per `UNSUPPORTED_MIME_BEHAVIOR` config
- [ ] Text messages: trimmed, output in `{ metadata, wabaPayload }` envelope
- [ ] Media messages: MIME-based type, output in envelope
- [ ] Caption max 1024 chars, truncated with warning log
- [ ] Audio messages: no caption
- [ ] Audio+text: configurable behavior (separate_message / discard_text / text_only)
- [ ] Document: filename from `payload.media.filename` or URL extraction
- [ ] `correlationId` in metadata set to `genesysId`
