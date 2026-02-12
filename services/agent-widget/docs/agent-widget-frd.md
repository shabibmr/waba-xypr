# Functional Requirements Document (FRD) - Enhanced for LLM Code Generation

**Service Name:** `agent-widget`  
**Version:** 1.4 (Consolidated)  
**Parent Reference:** System Design Document  

This enhanced FRD is optimized for LLMs (e.g., Claude) to generate high-quality code. Enhancements include:  
- Modular, hierarchical structure with clear inputs/outputs.  
- Pseudocode for flows to guide implementation.  
- JSON schemas for payloads and APIs.  
- Explicit error cases and edge conditions.  
- Code-friendly language: imperative steps, enums, types.  
- Sections tagged for code gen (e.g., [CODE_GEN: UI Component]).  

---

## 1. Introduction  
The Agent Interaction Widget is a micro-frontend for real-time WhatsApp interactions.  
- **Deployment Modes:**  
  - Embedded in Genesys Cloud Agent Desktop (iframe, mirrors interactions).  
  - Standalone/embedded in Customer Portal (admin/fallback messaging).  
- **Tech Stack Guidance:** React for UI, Socket.IO for WebSockets, Axios for APIs. Ensure stateless design.  

---

## 2. Objectives  
- Enable seamless Genesys/Portal integration.  
- Auto-resolve conversation context.  
- Support WhatsApp features: text, media (JPG/PNG/PDF/MP4), emojis, status indicators, read receipts, previews.  
- Fallback to direct messaging if Genesys unavailable.  
- Real-time sync via WebSockets.  
- Enforce tenant isolation and compliance.  

---

## 3. System Responsibilities  

### 3.1 Multi-Host Integration  
- Detect host: Genesys (if window.Genesys SDK exists) vs. Portal (URL params).  
- Adapt UI: Genesys → Lightning theme; Portal → Portal theme.  
- [CODE_GEN: HostDetector] Implement as React hook:  
  ```javascript  
  const detectMode = () => window.Genesys ? 'genesys' : 'portal';  
  ```  

### 3.2 Context Resolution  
- Inputs: conversationId (SDK/URL), tenantId (URL), mode (URL), integrationId (URL/Config).  
- Validate via API: GET /api/v1/widget/context/{conversationId} → { valid: boolean, tenantId: string, wa_id: string }.  
- Fetch WhatsApp ID from State Manager.  
- Edge: Invalid context → throw Error('InvalidConversation').  

### 3.3 Messaging Capabilities  
- Types: text, media attachments, emojis.  
- Indicators: sent (1 gray tick), delivered (2 gray), read (2 blue).  
- Previews: Inline for images/videos/docs.  
- Fallback: Direct send if Genesys down.  

### 3.4 Real-Time Synchronization  
- WebSocket: wss://api.xypr.com/socket.io namespace /tenant/{tenantId}/conv/{conversationId}.  
- Events: inbound_message ({ text: string, mediaUrl?: string }), status_update ({ messageId: string, status: 'sent'|'delivered'|'read' }).  
- [CODE_GEN: WebSocketHandler] Use Socket.IO client:  
  ```javascript  
  const socket = io(baseUrl, { auth: { token } });  
  socket.on('inbound_message', updateUI);  
  ```  

---

## 4. Hosting Modes  

### 4.1 Genesys Cloud Mode  
- Embed: Iframe in Genesys Cloud.  
- Auth: Short-lived SSO token.  
- PCI: Optional flag to disable input.  
- Intercept: Webhook mirrors Genesys messages.  
- [CODE_GEN: GenesysInit]  
  ```javascript  
  if (window.Genesys) { conversationId = Genesys.getActiveConversationId(); }  
  ```  

### 4.2 Customer Portal Mode  
- Standalone: Parse URL for conversationId, tenantId, mode='portal'.  
- Auth: Bearer token or HTTP-only cookie.  
- Direct: Send to middleware.  

---

## 5. Input Requirements  

### 5.1 Contextual & Initialization Inputs  
| Parameter | Type | Source | Required In | Description |  
|-----------|------|--------|-------------|-------------|  
| conversationId | string | SDK/URL | Both | Unique ID. |  
| tenantId | string | URL | Portal | Org ID. |  
| mode | enum('genesys'|'portal') | URL | Portal | Force mode. |  
| integrationId | string | URL/Config | Both | WhatsApp integration. |  

### 5.2 Authentication & Authorization  
- Genesys: SSO token (string, expires in 5min), optional pciCheck: boolean.  
- Portal: Bearer string or cookie.  
- [CODE_GEN: AuthValidator] Validate token via API: POST /auth/validate.  

### 5.3 Functional Messaging Inputs  
- Outbound: { text: string, media?: File (JPG|PNG|PDF|MP4), emojis: supported via Unicode }.  
- Metadata: contact_name: string, wa_id: string.  
- Location: Optional { lat: number, lng: number }.  

### 5.4 Technical Dependencies  
- Genesys SDK: Global window object.  
- WebSocket: Socket.IO.  
- APIs: REST with JSON.  

---

## 6. Functional Specifications  

### 6.1 Context Resolution & Mode Detection  
Pseudocode:  
```javascript
function initWidget() {  
  mode = detectHost();  
  if (mode === 'genesys') { conversationId = getFromSDK(); }  
  else { parseURLParams(); }  
  response = await fetch(`/api/v1/widget/context/${conversationId}`);  
  if (!response.valid) throw new Error('Invalid Context');  
  connectWebSocket(response.tenantId, conversationId);  
}  
```  
Edge: No SDK → fallback to portal; Invalid URL → error UI.  

### 6.2 Message Send Flow  
Payload Schema (JSON):  
```json
{  
  "type": "object",  
  "properties": {  
    "conversationId": { "type": "string" },  
    "tenantId": { "type": "string" },  
    "text": { "type": "string" },  
    "mediaUrl": { "type": ["string", "null"] },  
    "integrationId": { "type": "string" }  
  },  
  "required": ["conversationId", "tenantId", "integrationId"]  
}  
```  
Flow Pseudocode:  
```javascript
async function sendMessage(payload) {  
  addPendingMessageToUI(payload);  
  try {  
    await post('/api/v1/widget/send', payload); // Validates, publishes to RabbitMQ  
    // State Manager resolves wa_id, forwards to WhatsApp  
    await websocketConfirmation(); // Update status  
  } catch (e) { retry(3, e); }  
}  
```  
[CODE_GEN: SendButton] React component with onClick calling sendMessage.  

### 6.3 Messaging Paths  
- Genesys Sync: Intercept webhook → mirror to UI.  
- Direct Portal: Widget → middleware.  
- Edge: Genesys down → switch to direct.  

### 6.4 Real-Time Synchronization  
Events Schema:  
```json
{  
  "inbound_message": { "text": "string", "mediaUrl?": "string" },  
  "status_update": { "messageId": "string", "status": "enum(sent,delivered,read)" }  
}  
```  
[CODE_GEN: StatusRenderer] Component: Map status to ticks (gray/blue icons).  

---

## 7. UI / UX Requirements  
- Adaptability: Use CSS vars for themes.  
- Media: <img> for previews, <video> for MP4, MinIO URLs for download.  
- Accessibility: ARIA roles, keyboard nav (e.g., Enter to send).  
- [CODE_GEN: ChatUI] React: MessageList, InputBox, StatusIcons.  

---

## 8. Performance Requirements  
- Send: <200ms (UI to queue).  
- WebSocket: <300ms latency.  
- Upload: Progress bar (use XMLHttpRequest).  
- Retry: Exponential backoff (100ms, 200ms, 400ms).  

---

## 9. Security Requirements  
- Tenant: Enforce on every API/WebSocket.  
- Tokens: Validate per call.  
- CORS: Allow mypurecloud.com.  
- PCI: If true, disable input.  
- WebSocket: Auth handshake { token: string }.  
- [CODE_GEN: SecurityWrapper] HOC to check tenant.  

---

## 10. Error Handling Requirements  
- Failed send: Retry button.  
- WebSocket disconnect: Auto-reconnect (backoff: 1s, 2s, 5s).  
- Offline: Banner UI.  
- Duplicates: Use unique messageId.  
- Pseudocode:  
  ```javascript  
  socket.on('disconnect', () => reconnectWithBackoff());  
  ```  

---

## 11. Technical Constraints  
- Iframe: Sandbox allow-scripts.  
- Cross-origin: Use postMessage if needed.  
- Stateless: Store state in backend/WebSocket.  

---

## 12. Non-Functional Requirements  
- Multi-tenant: Yes.  
- Scalable: Stateless FE.  
- Queue: RabbitMQ.  
- Secure: HTTPS only.  

---

## 13. Future Enhancements  
- Typing: WebSocket event.  
- Reactions: Emoji picker.  
- Templates: Predefined messages.  
- Search: Local filter.  
- Export: CSV via API.  
- Analytics: Track events.  
- Tagging: Metadata API.  
- SLA: Timer UI.  
- AI: Suggestion endpoint.  

---

## Final Summary  
Enhanced FRD for LLM code gen: Structured flows, schemas, pseudocode ensure excellent, modular code output (e.g., React components, API handlers). Focus on React + Socket.IO for implementation.