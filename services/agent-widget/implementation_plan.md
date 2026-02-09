# Agent Widget - Implementation Plan

## Goal

Build an embedded Genesys widget that displays WhatsApp customer context, conversation history, enables template messaging, and provides real-time updates within the Genesys agent workspace.

## Phased Implementation

### Phase 1: WebSocket Real-time Updates (Priority: CRITICAL)
**Duration**: 1 week

#### 1.1 Socket.IO Integration
- **Files**:
  - `src/services/socketService.ts` - Socket client
  - `src/hooks/useRealtimeMessages.ts` - Real-time hook

- **Implementation**:
  - Connect to agent-portal-service
  - Subscribe to conversation events
  - Handle message status updates
  - Auto-reconnect on disconnect

---

### Phase 2: Message Flow Integration (Priority: HIGH)
**Duration**: 1.5 weeks

#### 2.1 Message Sending
- **Files**:
  - `src/services/messageService.ts` - Message API client
  - `src/components/MessageSender.tsx` - Send UI

- **Implementation**:
  - Send messages via outbound-transformer
  - Validate message before sending
  - Handle send errors gracefully
  - Show delivery confirmations

---

### Phase 3: Customer Context Enhancement (Priority: HIGH)
**Duration**: 1 week

#### 3.1 Customer Profile Display
- **Files**:
  - `src/components/CustomerContext.tsx` - Context display
  - `src/services/stateManagerService.ts` - State manager API

- **Display**:
  - Customer name and profile picture
  - WhatsApp phone number
  - Previous conversation history
  - Customer preferences
  - Interaction count

---

### Phase 4: Template Management (Priority: MEDIUM)
**Duration**: 1 week

#### 4.1 Template Integration
- **Files**:
  - `src/components/TemplateSelector.tsx` - Template UI
  - `src/services/templateService.ts` - Template API

- **Features**:
  - Browse available templates
  - Parameter input validation
  - Template preview
  - Send template message

---

### Phase 5: Security & Authentication (Priority: HIGH)
**Duration**: 1 week

#### 5.1 JWT Authentication
- **Files**:
  - `src/services/authService.ts` - Authentication
  - `src/middleware/authMiddleware.ts` - Auth middleware

- **Implementation**:
  - Validate JWT tokens
  - Verify agent permissions
  - Authorize conversation access

---

### Phase 6: Multi-tenant Isolation (Priority: MEDIUM)
**Duration**: 1 week

#### 6.1 Tenant Context
- **Files**:
  - `src/contexts/TenantContext.tsx` - Tenant state

- **Implementation**:
  - Load tenant-specific templates
  - Apply tenant branding
  - Isolate customer data by tenant

---

## Dependencies

```json
{
  "react": "^18.2.0",
  "socket.io-client": "^4.6.1",
  "axios": "^1.6.2"
}
```

---

## Verification Plan

### Manual Testing
1. Open widget in Genesys → verify loads correctly
2. Send message → verify delivery
3. Receive message → verify real-time update
4. Select template → verify sends correctly

---

## Rollback Strategy
- Feature flags for new features
- Maintain backward compatibility with Genesys
