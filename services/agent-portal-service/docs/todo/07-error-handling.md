# 07 — Error Handling

> **FRD Reference:** Section 10.1 (Error Handling), Lines 3300-3400
> **Priority:** 🟡 Medium — MVP Phase 2

---

## Gap Summary

| Feature | FRD | Code | Gap |
|---------|-----|------|-----|
| Global error handler | ✅ | ✅ | `errorHandler.js` implemented |
| Standardized error format | ✅ | ✅ | Implemented |
| Error codes enum | ✅ | ✅ | `utils/errorCodes` exists |
| Retry logic for transient failures | ✅ | ❌ | Not implemented |
| Axios error wrapping | ✅ | 🟡 | Some controllers wrap, some don't |

---

## FRD Error Format

```json
{
  "error": {
    "code": "AUTH_001",
    "message": "...",
    "details": {},
    "timestamp": "ISO",
    "requestId": "UUID"
  }
}
```

## Tasks

### T07.1 — Standardize Error Response Format
- [x] **File:** `src/middleware/errorHandler.js` (MODIFY)
- [x] **What:** All errors must follow FRD format with code, message, details, requestId
- [x] **Create:** `src/utils/AppError.js` (NEW) — custom error class

### T07.2 — Define Error Codes
- [x] **File:** `src/utils/errorCodes.js` (NEW)
- [x] **What:** Enum of all error codes: `AUTH_001`, `ONBOARD_001`, `CONV_001`, etc.

### T07.3 — Consistent Error Responses in Controllers
- [x] **File:** All controllers (MODIFY)
- [x] **What:** Replace ad-hoc `res.status(x).json({error: '...'})` with `throw new AppError()`

### T07.4 — Retry Logic for External Service Calls
- **File:** `src/utils/retry.js` (NEW)
- **What:** Exponential backoff wrapper for axios calls to State Manager, Tenant Service
- **Config:** Max 3 retries, 1s/2s/4s backoff
