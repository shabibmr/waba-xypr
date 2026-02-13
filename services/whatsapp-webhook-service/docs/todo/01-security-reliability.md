# Task List: Security & Reliability

## Description
Address critical security and reliability gaps where the service authenticates and acknowledges messages incorrectly.

## Dependencies
- None

## Status
⚠️ **2/3 Complete** - 1 critical blocker remaining

## Tasks
- [ ] **🚨 Refactor Webhook Controller** *(CRITICAL BLOCKER)*:
    - [ ] Remove `res.sendStatus(200)` from line 36 of `handleWebhook`
    - [ ] Await `webhookProcessorService.processWebhook` and wrap in try-catch
    - [ ] Send `200 OK` only after successful processing
    - [ ] Send `403 Forbidden` if signature verification fails
    - [ ] Send `500 Server Error` if RabbitMQ publishing fails
    - **Current Issue**: [`webhook.controller.js:36`](file:///Users/admin/code/WABA/v1/waba-xypr/services/whatsapp-webhook-service/src/controllers/webhook.controller.js#L36) sends 200 immediately

- [ ] **Implement Synchronous Processing in Service**:
    - [ ] Modify `processWebhook` to throw specific errors (e.g., `SignatureVerificationError`)
    - [ ] Ensure `tenantService` lookups and `signatureVerifier` run *before* RabbitMQ publishing
    - [x] ✅ Tenant lookups happen at [`webhook-processor.service.js:44`](file:///Users/admin/code/WABA/v1/waba-xypr/services/whatsapp-webhook-service/src/services/webhook-processor.service.js#L44)
    - [x] ✅ Signature verification at [`webhook-processor.service.js:52-63`](file:///Users/admin/code/WABA/v1/waba-xypr/services/whatsapp-webhook-service/src/services/webhook-processor.service.js#L52-L63)

- [x] **✅ Verify Signature Timing**:
    - [x] ✅ Signature verification happens before media downloading
    - **Evidence**: Lines 52-63 (verify) → Lines 72-76 (process messages)

