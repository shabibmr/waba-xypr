# Genesys Cloud — Messaging Conversations API Reference

> Base: `/api/v2/conversations/messages`

---

## 1. Conversations (List / Create)

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 1 | `GET` | `/api/v2/conversations/messages` | Get active message conversations for the logged-in user |
| 2 | `POST` | `/api/v2/conversations/messages` | Create an outbound messaging conversation. Fails if existing conversation is in `alerting`/`connected` state. If disconnected but within the window, fails unless `useExistingConversation = true` |
| 3 | `POST` | `/api/v2/conversations/messages/agentless` | Send an agentless (API participant) outbound message using client credentials. Requires `messaging` scope. Use `useExistingActiveConversation` to barge into an active conversation |

---

## 2. Cached Media

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 4 | `GET` | `/api/v2/conversations/messages/cachedmedia` | List cached media items |
| 5 | `GET` | `/api/v2/conversations/messages/cachedmedia/{cachedMediaItemId}` | Get a specific cached media item |
| 6 | `DELETE` | `/api/v2/conversations/messages/cachedmedia/{cachedMediaItemId}` | Remove a cached media item (async) |

---

## 3. Open Messaging — Inbound

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 7 | ~~`POST`~~ | ~~`/api/v2/conversations/messages/inbound/open`~~ | ⚠️ **DEPRECATED** — Use endpoints 8, 9, 10 below instead |
| 8 | `POST` | `/api/v2/conversations/messages/{integrationId}/inbound/open/event` | Send an inbound Open **Event** Message. Requires `messaging` scope (client credentials) |
| 9 | `POST` | `/api/v2/conversations/messages/{integrationId}/inbound/open/message` | Send an inbound Open **Message**. Requires `messaging` scope (client credentials) |
| 10 | `POST` | `/api/v2/conversations/messages/{integrationId}/inbound/open/receipt` | Send an inbound Open **Receipt** Message. Requires `messaging` scope (client credentials) |
| 11 | `POST` | `/api/v2/conversations/messages/{integrationId}/inbound/open/structured/response` | Send an inbound Open **Structured Response**. Requires `messaging` scope (client credentials) |

---

## 4. Single Conversation

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 12 | `GET` | `/api/v2/conversations/messages/{conversationId}` | Get message conversation details |
| 13 | `PATCH` | `/api/v2/conversations/messages/{conversationId}` | Update a conversation (disconnect all participants) |
| 14 | `PUT` | `/api/v2/conversations/messages/{conversationId}/recordingstate` | Update recording state of a conversation |

---

## 5. Messages (Send / Retrieve)

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 15 | `POST` | `…/{conversationId}/communications/{communicationId}/messages` | Send a message on an existing conversation. Only **one** body field per request: `textBody`, `mediaId`, or `messageTemplate` |
| 16 | `POST` | `…/{conversationId}/communications/{communicationId}/socialmedia/messages` | Send a **social media** message on an existing conversation |
| 17 | `POST` | `…/{conversationId}/communications/{communicationId}/typing` | Send a **typing** event |
| 18 | `POST` | `…/{conversationId}/messages/bulk` | Get messages in batch (max **1,000** message IDs per request) |
| 19 | `GET` | `…/{conversationId}/messages/{messageId}` | Get a specific conversation message |
| 20 | `GET` | `/api/v2/conversations/messages/{messageId}/details` | Get message details (top-level, not scoped to conversation) |

---

## 6. Media Upload

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 21 | `GET` | `…/{conversationId}/communications/{communicationId}/messages/media` | List message media by status |
| 22 | ~~`POST`~~ | ~~`…/{conversationId}/communications/{communicationId}/messages/media`~~ | ⚠️ **DEPRECATED** — Create media |
| 23 | `POST` | `…/{conversationId}/communications/{communicationId}/messages/media/uploads` | Create a URL to upload a message media file |
| 24 | `GET` | `…/{conversationId}/communications/{communicationId}/messages/media/{mediaId}` | Get a specific media item |

---

## 7. Participant Management

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 25 | `PATCH` | `…/{conversationId}/participants/{participantId}` | Update conversation participant |
| 26 | `PATCH` | `…/{conversationId}/participants/{participantId}/attributes` | Update participant attributes |
| 27 | `PATCH` | `…/{conversationId}/participants/{participantId}/communications/{communicationId}` | Disconnect a participant's communication (does **not** update wrapup) |
| 28 | `POST` | `…/{conversationId}/participants/{participantId}/monitor` | Listen in (monitor) from the point of view of a participant |
| 29 | `POST` | `…/{conversationId}/participants/{participantId}/replace` | Replace participant with a specified user/address |

---

## 8. Wrap-Up

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 30 | `GET` | `…/{conversationId}/participants/{participantId}/communications/{communicationId}/wrapup` | Get wrap-up for a communication |
| 31 | `POST` | `…/{conversationId}/participants/{participantId}/communications/{communicationId}/wrapup` | Apply wrap-up for a communication |
| 32 | `GET` | `…/{conversationId}/participants/{participantId}/wrapup` | Get wrap-up for a participant |
| 33 | `GET` | `…/{conversationId}/participants/{participantId}/wrapupcodes` | List available wrapup codes for a participant |

---

## Quick Reference — Key Path Parameters

| Parameter | Description |
|-----------|-------------|
| `{conversationId}` | Unique ID of the messaging conversation |
| `{communicationId}` | ID of a specific communication leg within a conversation |
| `{participantId}` | ID of a participant in the conversation |
| `{integrationId}` | ID of the Open Messaging integration |
| `{messageId}` | ID of a specific message |
| `{mediaId}` | ID of a specific media attachment |
| `{cachedMediaItemId}` | ID of a cached media item |

---

## Auth & Scopes

| Scope | Required For |
|-------|-------------|
| `messaging` | Agentless outbound, all Open Messaging inbound endpoints |
| OAuth Client Credentials | Agentless & Open Messaging inbound APIs |
| User Token | Standard conversation APIs (list, get, patch, participant ops) |

---

*Ref: [Genesys Cloud Developer Docs — Digital Messaging](https://developer.genesys.cloud/commdigital/digital)*
