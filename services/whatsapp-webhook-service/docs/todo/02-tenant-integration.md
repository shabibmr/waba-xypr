# Task List: Tenant Integration

## Description
Align Tenant Service usage with FRD and ensure correct credential retrieval.

## Dependencies
- 01-security-reliability.md

## Tasks
- [ ] **Verify Tenant Service API Endpoint**:
    - [ ] Check Tenant Service documentation/code to confirm if `/tenants/by-phone/:phoneNumberId` or `/tenants/resolve/:phoneNumberId` is correct.
    - [ ] Update `tenant.service.js` to use the correct endpoint.

- [ ] **Update Credential Retrieval**:
    - [ ] Ensure `getTenantMetaCredentials` returns both `appSecret` (for signature) and `accessToken` (for media download).
    - [ ] Update `tenant.service.js` to destruct/validate both fields.
