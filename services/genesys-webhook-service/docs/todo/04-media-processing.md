# Task File 04 — Media Processing
**Priority:** HIGH — Depends on 01 (tenant resolution for Auth Service call) and 02 (media detected only after correct classification)
**FRD Refs:** REQ-OUT-02, REQ-OUT-03, §2.3, §3.2, §5.2

---

## Gaps

### GAP-22: No OAuth token for Genesys media download
**Current (`media.service.ts`):** Downloads directly from the URL using axios with no authentication header.
**FRD (§2.3, §3.4, §5.2.2):** Must obtain an OAuth Bearer token from Auth Service before downloading:
```
POST /api/v1/auth/token
{ "tenantId": "...", "scope": "genesys:media:download" }
→ { "accessToken": "Bearer eyJhbGc...", ... }
```
Then: `GET {genesysUrl}` with `Authorization: Bearer {accessToken}` header.

**Impact:** Media downloads will fail for all properly-secured Genesys environments (unauthorized).

---

### GAP-23: Download uses buffer, not streaming
**Current:** `axios.get(url, { responseType: 'arraybuffer' })` — loads entire file into memory.
**FRD (§2.3, §5.2.2):** "Stream download from Genesys URL (no memory buffering)" — must use streaming to avoid OOM on large files.

---

### GAP-24: Wrong MinIO bucket name
**Current:** Uses bucket `whatsapp-media`.
**FRD (§3.2):** Bucket must be `media-outbound`.

**Impact:** Outbound media stored in wrong bucket; presigned URLs point to wrong location.

---

### GAP-25: File path missing the day component
**Current:** Path format: `{tenantId}/{year}/{month}/{uuid}.{ext}`
**FRD (§3.2):** Path must be: `{tenantId}/{year}/{month}/{day}/{uuid}.{extension}`
```
e.g. uuid-5678/2023/01/01/abc-def-789.pdf
```

---

### GAP-26: Presigned URL not time-limited to 7 days
**Current:** Generates a public URL from config (`MINIO_PUBLIC_URL`), not a proper presigned URL with expiry.
**FRD (§3.2, §5.2.2):** Must use `minio.presignedGetObject(bucket, key, 7*24*3600)` to generate a 7-day time-limited presigned URL.

---

### GAP-27: MIME type validation not enforced before upload
**Current:** No allowed/blocked MIME type check.
**FRD (§5.2.3):** Only allowed MIME types may be uploaded:
```
image/jpeg, image/png, image/gif, image/webp,
application/pdf, application/msword, application/vnd.openxmlformats...,
audio/mpeg, audio/ogg, audio/wav,
video/mp4, video/quicktime,
text/plain, text/csv
```
Unsupported types: throw `InvalidMediaError`, log warning, return `null` (graceful degradation).

---

### GAP-28: File size not validated
**Current:** No size check.
**FRD (§3.2, §5.2.4):** Maximum 20 MB. Check `Content-Length` header before downloading; reject if over limit.

---

### GAP-29: Media detection reads wrong field
**Current:** Checks for `mediaUrl` in a root-level `message` object.
**FRD (§5.2.1):** Media is detected from `content[]` array where `contentType == "Attachment"`:
```
payload.content[].contentType === "Attachment"
→ attachment = payload.content[].attachment
→ { id, url, mime, filename }
```

---

### GAP-30: Only first attachment processed (acceptable, but undocumented)
**FRD (§5.4):** Processes first attachment only: "extend for multiple if needed". Current implementation aligns with this. Just ensure it is intentional and documented.

---

### GAP-31: Media failure does not prevent message from being published (partial alignment)
**Current:** On media failure, the code throws and may block the overall message.
**FRD (§7.3):** Graceful degradation — if media fails, publish the message anyway with `media: null` and optionally `media_processing_failed: true`. Text message must always be delivered.

---

## Tasks

| # | Task | File(s) to Change |
|---|------|-------------------|
| 04-A | Add Auth Service call before Genesys media download: `POST {AUTH_SERVICE_URL}/api/v1/auth/token` with `{ tenantId, scope: "genesys:media:download" }` | `media.service.ts` |
| 04-B | Pass `Authorization: Bearer {token}` header to Genesys download request | `media.service.ts` |
| 04-C | Switch from `arraybuffer` to streaming: use `axios({ responseType: 'stream' })` and pipe to MinIO | `media.service.ts` |
| 04-D | Fix bucket name: `whatsapp-media` → `media-outbound` | `media.service.ts`, `config/config.ts` |
| 04-E | Fix file path to include day: `{tenantId}/{YYYY}/{MM}/{DD}/{uuid}.{ext}` | `media.service.ts` |
| 04-F | Replace public URL generation with `minio.presignedGetObject(bucket, key, 7*24*3600)` | `media.service.ts` |
| 04-G | Add MIME type allow-list validation before upload; throw `InvalidMediaError` for disallowed types | `media.service.ts` |
| 04-H | Add `Content-Length` check before download; reject if > 20 MB | `media.service.ts` |
| 04-I | Fix media detection to read from `payload.content[].attachment` (FRD §5.2.1 schema) | `genesys-handler.service.ts` |
| 04-J | Wrap media processing in try/catch; on failure publish message with `media: null` (graceful degradation) | `genesys-handler.service.ts` |

---

## Acceptance Criteria
- Media download includes `Authorization: Bearer {token}` from Auth Service
- Download is streamed (no full buffer in memory)
- Uploaded to `media-outbound` bucket
- Object path includes day: `{tenantId}/YYYY/MM/DD/{uuid}.ext`
- Presigned URL is 7-day time-limited
- Disallowed MIME type → `media: null`, message still published
- File > 20 MB → `media: null`, message still published
- `media.service.ts` has download timeout of 30s and upload timeout of 30s
