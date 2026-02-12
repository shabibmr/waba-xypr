# Task List: Security & Reliability

## Description
Address critical security and reliability gaps where the service authenticates and acknowledges messages incorrectly.

## Dependencies
- None

## Tasks
- [ ] **Refactor Webhook Controller**:
    - [ ] Remove `res.sendStatus(200)` from the beginning of `handleWebhook`.
    - [ ] Await `webhookProcessorService.processWebhook`.
    - [ ] Send `200 OK` only after successful processing.
    - [ ] Send `403 Forbidden` if signature verification fails.
    - [ ] Send `500 Server Error` if RabbitMQ publishing fails.

- [ ] **Implement Synchronous Processing in Service**:
    - [ ] Modify `processWebhook` to return status/result instead of void.
    - [ ] Ensure `tenantService` lookups and `signatureVerifier` run *before* RabbitMQ publishing.
    - [ ] Throw specific errors (e.g., `SignatureVerificationError`) to allow controller to send correct HTTP codes.

- [ ] **Verify Signature Timing**:
    - [ ] Ensure signature verification happens *before* any other processing logic (like media downloading).
