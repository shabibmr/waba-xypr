# Task 08 — Testing

**Priority**: MEDIUM
**Depends on**: Tasks 01, 02, 03 (fixes and types must be in place before tests are meaningful)
**Blocks**: CI confidence

---

## 08-A: Fix Test Fixtures to Match Actual Payload Schema

**Gap ref**: G15

**Current** (`tests/fixtures/messages.js`):
```js
{
    from: '+1234567890',
    id: 'wamid.test123',
    timestamp: '1234567890',
    type: 'text',
    text: { body: 'Hello from WhatsApp' }   // ← raw Meta format, not transformer input
}
```

**Actual upstream payload** (from webhook-service):
```js
{
    tenantId: 't_abc123',
    messageId: 'wamid.test123',
    from: '+1234567890',
    contactName: 'Test User',
    timestamp: '1234567890',
    type: 'text',
    content: { text: 'Hello from WhatsApp' },
    metadata: {
        phoneNumberId: '123456789',
        displayPhoneNumber: '+1987654321'
    }
}
```

**Action**: Rewrite fixtures to match the actual queued payload shape. Add fixtures for:
- Text message
- Image message (with `mediaUrl`)
- Image message (with `content.error`)
- Document message
- Location message
- Interactive button reply
- Interactive list reply

---

## 08-B: Unit Tests for `messageFormatter.ts`

**Current**: Zero coverage of `formatMessageText()` or `transformToGenesysFormat()`.

**Required unit tests** (`tests/unit/utils/messageFormatter.test.ts`):

```
formatMessageText()
  ✓ extracts text from text message
  ✓ returns caption for image with caption
  ✓ returns [Image] for image without caption
  ✓ returns document filename
  ✓ returns audio placeholder
  ✓ formats location with coordinates
  ✓ extracts button reply title from interactive
  ✓ extracts list reply title from interactive
  ✓ formats contact name and phone
  ✓ returns error note when content.error is set
  ✓ returns unsupported placeholder for unknown type

transformToGenesysFormat()
  ✓ includes `from` field for new conversation
  ✓ includes `from` field for existing conversation (regression test for G2)
  ✓ includes `content` attachment array when mediaUrl present
  ✓ omits `content` array for text-only messages
```

---

## 08-C: Unit Tests for `transformerService.ts`

**Required** (`tests/unit/services/transformerService.test.ts`):

Mock `stateService` and `genesysService`. Test the orchestration logic:

```
processInboundMessage()
  ✓ throws if tenantId missing
  ✓ calls stateService.getConversationMapping with correct args
  ✓ calls genesysService.sendMessage
  ✓ calls stateService.trackMessage before sending
  ✓ calls stateService.updateMessageStatus('sent') on success
  ✓ calls stateService.updateMessageStatus('failed') on Genesys error
  ✓ re-throws error after updating status to failed
  ✓ skips processing for system message type
  ✓ skips processing for reaction message type
```

---

## 08-D: Integration Test for Full Flow

**Required** (`tests/integration/transform.flow.test.ts`):

Use `jest.mock` to stub HTTP calls. Test the full pipeline from queue message → stateService → genesysService:

```
Full inbound flow
  ✓ text message reaches Genesys with correct payload shape
  ✓ image with mediaUrl results in attachment in Genesys payload
  ✓ existing conversation includes from field
  ✓ genesys failure → message status set to 'failed'
  ✓ state-manager failure → message nacked (throws)
```

---

## 08-E: Fix API Tests to Use Actual Service

**Current** (`tests/api/transform.api.test.js`): Creates its own inline Express app, never imports the real service. Tests pass regardless of whether the actual code is broken.

**Required**: Import the actual app from `src/index.ts`, mock downstream HTTP calls with `nock` or `jest.mock(axios)`, and test the actual `/transform/inbound` endpoint.
