---
name: Agent Debugging and Maintenance Skills Focus
description: Comprehensive required skills, context, and focus areas for Antigravity agents debugging and maintaining the WABA/Genesys integration project codebase.
---

### 1. Distributed Systems & Microservices Architecture
- **API Gateway Routing**: Proficiency in tracing requests through an API Gateway to downstream services (e.g., Auth, Tenant, WhatsApp, Genesys, Transformers).
- **Service Dependency Management**: Understanding initialization orders and cross-service dependencies in a Dockerized environment.
- **State Synchronization**: Capabilities to debug discrepancies between services when state changes asynchronously (e.g., maintaining `conversationId` and `communicationId` accuracy).

### 2. Event-Driven Architecture (RabbitMQ)
- **Message Queues (AMQP)**: Deep understanding of publishing and consuming events, routing keys, and queue bindings (e.g., `genesys.outbound.ready`, inbound webhooks).
- **Dead Letter Queues (DLQ) Analysis**: Skill to identify misrouted or persistently failing events from logs, inspect payload structures, and trace failures to either `whatsapp-webhook-service` or transformer services.
- **Serialization/Deserialization**: Catching silent failures resulting from schema mismatches when parsing event payloads across service boundaries.

### 3. Third-Party API Integration & Advanced OAuth
- **Genesys Cloud CX Platform SDKs**: In-depth knowledge of Genesys Cloud API rate limits, Conversations API bounds, API errors (like 400 Bad Request / Grant Type errors), Agent Widget interactions (WebSockets), and Guest/Agent auth routing.
- **Meta Graph API (WhatsApp Business)**: Handling WhatsApp Business API complexities like template messaging limitations, webhook verification logic, Media ID handling, and token expiry (`META_VERIFY_TOKEN`).
- **OAuth 2.0 Workflows**: Troubleshooting multi-tenant configurations where multiple organizations may require Client Credentials or Authorization Code Exchange validations (as seen in `tenant-service` / `auth-service` failures).

### 4. Node.js & Full-Stack TypeScript
- **Idiomatic TypeScript**: Parsing compiler errors, correctly shaping complex interfaces (`TenantGenesysCredentials`), debugging object mutations, and ensuring strict type alignment across transformer boundaries.
- **React/Vite Frontend Engineering**: Investigating Vite development proxy behaviors vs. production bundles across embedded environments (i.e., `agent-portal`, `agent-widget`, `admin-dashboard`).
- **Browser Security Mechanisms (CORS & CSP)**: Diagnosing and correcting Cross-Origin Resource Sharing policy violations and Content Security Policy restrictions—especially critical when embedding iframes (the `agent-widget`) within Genesys Cloud.

### 5. Datastore Operations (PostgreSQL, Redis, MinIO)
- **Relational Databases (Postgres)**: Investigating tenant isolation schemas, executing queries against the `whatsapp_genesys` database, and fixing migration or structural drift safely.
- **In-Memory Datastores (Redis)**: Debugging race conditions by analyzing distributed locks, caching mechanisms, or state-machine corruption (such as `state-manager` holding stale or mismatched values).
- **Object Storage (MinIO/S3)**: Tracing issues with media uploads/downloads on WhatsApp (e.g., inbound voice/image media payload extraction vs. saving securely locally or to MinIO).

### 6. Observability, Deployment & DevOps
- **Docker & Docker Compose**: Editing and fixing network misconfigurations between overlapping environments (`docker-compose.prod.yml` vs. `docker-compose.remote.yml`), mapping correct dynamic ports, or mapping container host domains correctly (`REMOTE_HOST`).
- **Log Aggregation (Promtail, Loki, Grafana)**: Interpreting correlated logs using request trace IDs to pinpoint where an asynchronous workflow stalled without disrupting other services in flight.
- **Bash & Shell Scripting**: Safely inspecting and running `.sh` management scripts directly to orchestrate tests or reboot components without compromising tenant data or active connections.
