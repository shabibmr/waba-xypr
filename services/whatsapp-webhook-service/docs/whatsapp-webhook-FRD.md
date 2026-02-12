# Functional Requirements Document

## WhatsApp Webhook Service

**Service Name:** `whatsapp-webhook-service`

**Version:** 1.1 (Updated)

**Parent Document:** System Design Document

---

# 1. Overview

The **WhatsApp Webhook Service** is the entry point for all incoming traffic from the Meta (WhatsApp Business) Platform. It is responsible for receiving webhook events, validating their authenticity, handling media assets, and buffering the data into RabbitMQ for asynchronous processing.

---

## 1.1 Primary Responsibilities

\begin{itemize}
\item Ingress Security: Validating the X-Hub-Signature-256 header to ensure requests come from Meta.
\item Verification: Handling the initial GET verification challenge from Meta during setup.
\item Media Handling: Detecting media messages, downloading the binary content from Meta's CDN, and uploading it to the private MinIO media-inbound bucket.
\item Buffering: Pushing the validated payload (with MinIO URLs injected) to the RabbitMQ-inboundQueue.
\end{itemize}

---

# 2. Dependencies

\begin{table}
\begin{tabular}{|l|l|}
\hline
Dependency & Purpose \\
\hline
RabbitMQ & Destination for raw inbound messages \\
MinIO & Storage for downloaded media files \\
Tenant Service & To resolve tenant\_id from phone\_number\_id and retrieve app\_secret \\
\hline
\end{tabular}
\end{table}

---

# 3. Data Architecture

---

## 3.1 Input (HTTP Webhook)

The service accepts the standard Meta Graph API Webhook format.

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "123456789",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "...",
          "phone_number_id": "..."
        },
        "contacts": [{
          "profile": { "name": "John Doe" },
          "wa_id": "919876543210"
        }],
        "messages": [{
          "from": "919876543210",
          "id": "wamid.HBg...",
          "timestamp": "1700000000",
          "type": "image",
          "image": {
            "id": "media-id-123",
            "mime_type": "image/jpeg"
          }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

---

## 3.2 Output (RabbitMQ Payload)

The service normalizes the nested Meta structure into a flatter internal event object.

**Queue:** RabbitMQ-inboundQueue

```json
{
  "tenantId": "resolved-from-phone-number-id",
  "waId": "919876543210",
  "wamid": "wamid.HBg...",
  "timestamp": 1700000000,
  "contactName": "John Doe",
  "type": "message",
  "payload": {
    "type": "image",
    "id": "media-id-123",
    "mime_type": "image/jpeg",
    "media_url": "https://minio.internal/media-inbound/..."
  }
}
```

**Note:** Status events like read/delivered follow a similar structure but with `type: "event"`

---

# 4. Functional Specifications

---

# 4.1 Webhook Verification (Setup)

**Requirement ID: REQ-IN-01**

**Trigger:** HTTP GET /webhook

**Input:** Query params `hub.mode`, `hub.verify_token`, `hub.challenge`

### Logic

\begin{enumerate}
\item Verify `hub.mode` is `subscribe`.
\item Verify `hub.verify_token` matches the configured environment variable `WEBHOOK_VERIFY_TOKEN`.
\item If valid, return `hub.challenge` as plain text with 200 OK.
\item If invalid, return 403 Forbidden.
\end{enumerate}

---

# 4.2 Message Reception and Validation

**Requirement ID: REQ-IN-01, REQ-SEC-01**

**Trigger:** HTTP POST /webhook

### Logic

\begin{enumerate}
\item **Tenant Resolution:**
  \begin{itemize}
  \item Extract `metadata.phone_number_id` from the payload.
  \item Call Tenant Service endpoint `GET /tenants/resolve/:phoneNumberId` to get the `tenant_id` and the `app_secret` (WABA credentials).
  \item If not found, return 404 (or 200 to Meta to stop retries if it's a misconfiguration).
  \end{itemize}

\item **Signature Check:**
  \begin{itemize}
  \item Calculate HMAC-SHA256 of the request body using the retrieved `app_secret`.
  \item Compare with `X-Hub-Signature-256`.
  \item If mismatch, log security warning and return 403 Forbidden.
  \end{itemize}

\item **Parsing:**
  \begin{itemize}
  \item Extract the `messages` or `statuses` array.
  \item Process each item individually.
  \end{itemize}
\end{enumerate}

---

# 4.3 Media Processing

**Requirement ID: REQ-IN-03, REQ-IN-04**

**Condition:** Message type is `image`, `video`, `document`, `audio`, or `sticker`.

### Logic

\begin{enumerate}
\item Get the Media ID from the payload.
\item Call Meta API: `GET /{media-id}` to retrieve the download URL.
  \begin{itemize}
  \item Use the tenant's WABA System User Token (retrieved via Auth Service or Tenant Service credentials).
  \end{itemize}
\item Download the binary file.
\item Upload to MinIO bucket `media-inbound` with key: `/{tenantId}/{year}/{month}/{uuid}.{ext}`.
\item Generate a Presigned URL (valid for 7 days, or per config).
\item Inject this `media_url` into the message payload before queuing.
\end{enumerate}

---

# 4.4 Queue Dispatch

**Requirement ID: REQ-IN-06** (Triggering State Manager)

### Logic

\begin{enumerate}
\item Wrap the parsed data into the Internal Event structure.
\item Publish to RabbitMQ-inboundQueue.
\item **Ack:** Return HTTP 200 to Meta after successful publishing.
  \begin{itemize}
  \item If RabbitMQ fails, return 500 to trigger Meta retry.
  \end{itemize}
\end{enumerate}

---

# 5. Non-Functional Requirements

\begin{itemize}
\item **Availability:** 99.9\% uptime. (Meta disables webhooks after consecutive failures).

\item **Latency:** Must accept and queue the request within 3 seconds (Meta timeout).
  \begin{itemize}
  \item Heavy processing (like media download) should be asynchronous if file sizes are large, though the current design blocks response until queued to ensure data safety.
  \item **Refinement:** Consider downloading media in the background if 3s timeout becomes an issue.
  \end{itemize}

\item **Security:** App Secret must be stored securely.
\end{itemize}

---

# Final Summary

The WhatsApp Webhook Service is the critical ingress point that:

\begin{itemize}
\item Validates all incoming Meta webhook requests via signature verification
\item Handles initial webhook verification for setup
\item Downloads and stores media assets in MinIO
\item Normalizes Meta's nested payload structure
\item Buffers validated events into RabbitMQ for downstream processing
\item Ensures tenant isolation through proper credential resolution
\item Maintains strict security and performance requirements
\end{itemize}

This service acts as the secure gateway between Meta's platform and the internal message processing pipeline, ensuring data integrity, security, and reliable message flow.

---