# Task List: Media Handling

## Description
Enhance media handling reliability and config.

## Dependencies
- 02-tenant-integration.md

## Tasks
- [ ] **Validate Access Token for Downloads**:
    - [ ] In `webhook-processor.service.js`, ensure `accessToken` is passed to `mediaService.saveMedia`.

- [ ] **Configuration Check**:
    - [ ] Verify `MINIO_PUBLIC_URL` logic in `media.service.js`. Ensure it constructs a reachable URL for the frontend/agent-portal.

- [ ] **Error Handling for Media**:
    - [ ] Ensure that if media download fails, the message is still queued (with `mediaUrl: null` or error flag), OR (per FRD strictness) retry logic is triggered. *Recommendation: Queue with error flag to avoid blocking the queue.*
