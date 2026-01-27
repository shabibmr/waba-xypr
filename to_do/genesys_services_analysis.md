# Genesys Services Analysis

## 1. genesys-api-service
**Location:** `services/genesys-api-service`

### Purpose
Acts as the outbound gateway to Genesys Cloud. It handles all API requests *from* the WABA platform *to* Genesys Cloud.

### Features
*   **Message Sending**: Sends inbound messages (Customer -> Agent) to Genesys via Open Messaging API.
*   **Receipt Handling**: Forwards WhatsApp delivery receipts and status updates to Genesys.
*   **Conversation Management**:
    *   Get conversation details and messages.
    *   Update conversation attributes.
    *   Disconnect conversations.
    *   Send typing indicators.
*   **Organization & User Management**:
    *   Retrieve organization details.
    *   Fetch organization users (agents) with pagination.
    *   Get specific user details.
*   **Multi-tenancy**: Supports tenant-specific credentials and OAuth tokens.

### Potential Errors / Observations
*   **Code Quality**: The code structure appears clean and follows the service-controller pattern securely.
*   **Error Handling**: Standard try-catch blocks with middleware error handling.
*   **Dependencies**: Relies on `tenant-service` for credentials and `auth-service` (implied by token usage) or internal auth logic.

---

## 2. genesys-webhook-service
**Location:** `services/genesys-webhook-service`

### Purpose
Handles incoming webhooks *from* Genesys Cloud. It acts as the listener for events occurring within Genesys (e.g., Agent replies, status changes).

### Features
*   **Outbound Message Processing**: Receives messages sent by Agents in Genesys and queues them for delivery to the customer via WhatsApp (via `outbound-transformer` / RabbitMQ).
*   **Event Handling**: Listeners for:
    *   `conversation.disconnected` (updates state).
    *   `agent.typing`.
    *   `participant.joined` / `participant.left`.
    *   `conversation.transferred`.
*   **Agent State**: Processing agent presence/state changes.
*   **Tenant Resolution**: dynamically resolves which tenant a webhook belongs to based on `conversationId` or `integrationId`.

### Potential Errors / Critical Findings
*   **Data Loss Risk (Race Condition)**:
    *   In `WebhookController`, the service sends `res.sendStatus(200)` **immediately** before processing the payload (Fire-and-forget).
    *   If `genesysHandlerService.processOutboundMessage` fails (e.g., RabbitMQ is down, Tenant resolution fails), the error is logged, but Genesys has already received a success confirmation. Genesys will likely *not* retry the webhook.
*   **RabbitMQ Dependency**:
    *   The service strictly depends on RabbitMQ to forward messages. If the connection is lost, messages will be dropped after the 200 OK response.
    *   *Recommendation*: Consider acknowledging the webhook (200 OK) only *after* successfully publishing to RabbitMQ, or implement a local durable buffer/retry mechanism.

---

### Comparison / Summary
*   **API Service**: WABA Platform -> Genesys Cloud (Rest API)
*   **Webhook Service**: Genesys Cloud -> WABA Platform (Webhooks -> RabbitMQ)

This duality separates the "Push" and "Pull" concerns effectively, but the Webhook service needs robust error handling to prevent message loss during infrastructure blips.
