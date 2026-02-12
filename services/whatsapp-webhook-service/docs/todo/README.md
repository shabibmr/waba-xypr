# WhatsApp Webhook Service - Implementation Tasks

## Overview
This directory contains task lists to bridge the gap between the current implementation and the Functional Requirements Document (FRD).

## Task Categories
1. **[Security & Reliability](./01-security-reliability.md)**: Critical fixes for webhook acknowledgment, signature verification, and data safety.
2. **[Tenant Integration](./02-tenant-integration.md)**: Alignment with Tenant Service API and credential handling.
3. **[Media Handling](./03-media-handling.md)**: Improvements to media download and storage flows.

## MVP Roadmap (Minimal Viable Product)
To achieve a working MVP that is secure and reliable, the following tasks must be prioritized:

### Priority 1: High (Blocking)
- [ ] **Fix Webhook Acknowledgment Flow**: Move `res.sendStatus(200)` to the *end* of processing. This is critical for data safety and Meta compliance (stopping retries only on success).
- [ ] **Enforce Signature Verification**: Ensure 403 Forbidden is returned for invalid signatures.
- [ ] **Verify Tenant Endpoint**: Ensure we are calling the correct URL to resolve tenants.

### Priority 2: Medium (Feature Completeness)
- [ ] **Media Download**: Ensure valid `accessToken` is available for `saveMedia`.
- [ ] **MinIO URL**: Ensure generated URLs are accessible.

### Priority 3: Low (Optimization)
- [ ] **Async Media Download**: Move media downloading to a background job if latency exceeds 3 seconds (currently processed inline).
