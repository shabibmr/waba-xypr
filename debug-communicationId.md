# Debug: communicationId Not Received

## Steps to Diagnose

### 1. Check Widget Console Log
Open browser console when widget loads. Look for:
```
[Widget] Conversation context: { waId, integrationId, communicationId }
```

### 2. Check Network Response
Network tab → `/widget/api/init?conversationId=...`
Look for `customerData.communicationId` in response

### 3. Check Database Directly
```sql
SELECT
  wa_id,
  conversation_id,
  communication_id,  -- Should NOT be NULL
  contact_name,
  status,
  created_at,
  updated_at
FROM conversation_mappings
WHERE conversation_id = 'YOUR_CONVERSATION_ID'
  AND status = 'active';
```

### 4. Check Genesys API Service Logs
```bash
docker compose logs genesys-api-service | grep -A 5 "communicationId"
```

Look for:
- `communicationId found: <uuid>`
- `communicationId not found` (retry warnings)
- `communicationId could not be resolved after all retries`

### 5. Check State Manager Logs
```bash
docker compose logs state-manager | grep -A 5 "correlation"
```

Look for:
- `Processing correlation event`
- `Correlation successful`
- `Correlation failed - mapping not found or already correlated`

### 6. Check RabbitMQ Queue
```bash
# Check if correlation events are stuck in queue
docker exec whatsapp-rabbitmq rabbitmqctl list_queues name messages
```

Look for messages in:
- `correlation-events` queue

## Expected Values

### First Message Scenario:
1. **Initial mapping creation**: `communication_id = NULL`
2. **After Genesys response**: Correlation event published
3. **After correlation**: `communication_id = <participant-id from Genesys>`
4. **Widget reload**: Should receive non-null `communicationId`

### Existing Conversation:
- Widget should ALWAYS receive `communicationId` (already populated in DB)

## Quick Test Query
```bash
# Get conversation mapping details
curl -H "X-Tenant-ID: YOUR_TENANT_ID" \
  http://localhost:3005/state/conversation/YOUR_CONVERSATION_ID
```

Expected response should include:
```json
{
  "waId": "+1234567890",
  "conversationId": "abc-123",
  "communicationId": "participant-uuid",  // ← Should be present
  "contactName": "Customer",
  ...
}
```
