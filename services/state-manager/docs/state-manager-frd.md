# State Manager Service - Technical Specification (MVP)

## Document Purpose
This document defines the State Manager Service, a critical component in the XYPR middleware that acts as the **single source of truth** for conversation state and message lifecycle tracking in WhatsApp-to-Genesys integrations.

---

## System Context

### What This Service Does
The State Manager maintains bidirectional mappings between:
- **WhatsApp users** (identified by `wa_id`) 
- **Genesys conversations** (identified by `conversation_id`)

### Why This Service Exists
**Problem**: When a WhatsApp user sends a message, we need to:
1. Determine if they have an active conversation in Genesys
2. Route subsequent messages to the same conversation
3. Prevent creating duplicate conversations
4. Track every message through its entire lifecycle

**Solution**: This service provides atomic, transactional mapping operations with built-in concurrency controls.

### Architecture Pattern
- **Compute**: Stateless workers (horizontally scalable)
- **State**: Persistent (PostgreSQL) + Cached (Redis)
- **Communication**: Event-driven via RabbitMQ queues
- **Multi-tenancy**: Physical database isolation (separate PostgreSQL database per tenant)

### Multi-Tenancy Strategy (Physical Isolation)
- **Architecture**: Shared Application / Isolated Databases.
- **Tenant Connection Factory**:
    - Service maintains a dynamic pool of HikariCP (or similar) datasources.
    - Credentials fetched securely from `tenant-service` at runtime.
    - Context Propagation: `tenantId` from message header selects the correct DB connection.
- **No tenant_id columns**: Tenant context is determined by the selected database connection.
- **Schema Management**: Flyway/Liquibase migration run against *each* tenant DB.

---

## Core Data Model

### Entity: Conversation Mapping

**Purpose**: Links one WhatsApp user to one active Genesys conversation.

**Lifecycle**:
```
1. Created: When first inbound message arrives from a wa_id
2. Correlated: When Genesys returns conversationId after conversation creation
3. Active: While messages are being exchanged
4. Expired: After 24 hours of inactivity
```

**Schema**: `conversation_mappings` table

| Column | Type | Purpose | Constraints |
|--------|------|---------|-------------|
| `id` | UUID | Primary key | NOT NULL, PK |
| `wa_id` | VARCHAR | WhatsApp user identifier (phone number format) | NOT NULL, INDEXED |
| `conversation_id` | VARCHAR | Genesys conversation UUID | NULL initially, INDEXED |
| `communication_id` | VARCHAR | Genesys communication session ID | NULLABLE |
| `last_message_id` | VARCHAR | Most recent WhatsApp message ID (wamid) | NULLABLE, INDEXED |
| `contact_name` | VARCHAR | WhatsApp user's display name | NULLABLE |
| `status` | VARCHAR | Enum: 'active', 'closed', 'expired' | NOT NULL |
| `last_activity_at` | TIMESTAMP | Last message timestamp (for TTL) | NOT NULL, INDEXED |
| `created_at` | TIMESTAMP | Record creation time | NOT NULL |
| `updated_at` | TIMESTAMP | Last modification time | NOT NULL |

**Critical Business Rule - Enforced by Database Constraint**:
```sql
UNIQUE (wa_id) WHERE status = 'active'
```
**Meaning**: A WhatsApp user can have only ONE active conversation at any time.

**DDL**:
```sql
CREATE TABLE conversation_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_id VARCHAR(50) NOT NULL,
    conversation_id VARCHAR(100),
    communication_id VARCHAR(100),
    last_message_id VARCHAR(255),
    contact_name VARCHAR(255),
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'closed', 'expired')),
    last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_unique_active_mapping 
ON conversation_mappings (wa_id) 
WHERE status = 'active';

CREATE INDEX idx_wa_id ON conversation_mappings (wa_id);
CREATE INDEX idx_conversation_id ON conversation_mappings (conversation_id);
CREATE INDEX idx_last_message_id ON conversation_mappings (last_message_id);
CREATE INDEX idx_last_activity ON conversation_mappings (last_activity_at);
CREATE INDEX idx_status ON conversation_mappings (status);
```

---

### Entity: Message Tracking

**Purpose**: Audit trail for every message flowing through the system.

**Schema**: `message_tracking` table

| Column | Type | Purpose | Constraints |
|--------|------|---------|-------------|
| `id` | UUID | Primary key | NOT NULL, PK |
| `mapping_id` | UUID | Link to conversation mapping | NOT NULL, FK |
| `wamid` | VARCHAR | WhatsApp message ID (globally unique) | NOT NULL, UNIQUE, INDEXED |
| `genesys_id` | VARCHAR | Genesys message identifier | NULLABLE, INDEXED |
| `direction` | VARCHAR | 'INBOUND' or 'OUTBOUND' | NOT NULL |
| `status` | VARCHAR | Current delivery state (see state machine) | NOT NULL |
| `media_url` | TEXT | MinIO/S3 URL if message contains media | NULLABLE |
| `created_at` | TIMESTAMP | First insertion time | NOT NULL |
| `updated_at` | TIMESTAMP | Last status update time | NOT NULL |

**Idempotency Key**: `wamid` (WhatsApp message ID)
- Prevents duplicate message logging
- Multiple webhook deliveries of same message → single tracking record

**DDL**:
```sql
CREATE TABLE message_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapping_id UUID NOT NULL REFERENCES conversation_mappings(id) ON DELETE CASCADE,
    wamid VARCHAR(255) NOT NULL UNIQUE,
    genesys_id VARCHAR(100),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    status VARCHAR(20) NOT NULL,
    media_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_wamid ON message_tracking (wamid);
CREATE INDEX idx_mapping_id ON message_tracking (mapping_id);
CREATE INDEX idx_genesys_id ON message_tracking (genesys_id);
CREATE INDEX idx_direction ON message_tracking (direction);
CREATE INDEX idx_status ON message_tracking (status);
CREATE INDEX idx_created_at ON message_tracking (created_at);
```

---

## Message Status State Machine

### Purpose
Ensures message status progresses logically and prevents invalid state transitions.

### Outbound Messages (Middleware → WhatsApp)
```
queued → sent → delivered → read
   ↓
failed (terminal state, can occur from any prior state)
```

### Inbound Messages (WhatsApp → Middleware)
```
received → processed
    ↓
  failed (terminal state)
```

### Rules
1. **Forward-only**: Cannot regress to a previous state
2. **Validation**: Reject updates that violate the state sequence
3. **Idempotent**: Duplicate status updates with same value are ignored (log but don't error)
4. **Timestamp check**: Ignore updates older than current `updated_at`

**Example Valid Sequence**:
```
queued → sent → delivered → read ✅
```

**Example Invalid Sequences**:
```
delivered → sent ❌ (regression)
queued → read ❌ (skipped states)
```

**State Transition Map** (for validation logic):
```python
STATE_TRANSITIONS = {
    'queued': ['sent', 'failed'],
    'sent': ['delivered', 'failed'],
    'delivered': ['read', 'failed'],
    'read': [],  # terminal state
    'failed': [],  # terminal state
    'received': ['processed', 'failed'],
    'processed': []  # terminal state
}

def is_valid_transition(current_status: str, new_status: str) -> bool:
    """Check if status transition is allowed"""
    if current_status == new_status:
        return True  # Idempotent update
    return new_status in STATE_TRANSITIONS.get(current_status, [])
```

---

## Caching Strategy (Redis)

### Why Redis?
- **Performance**: Sub-10ms lookups vs 20-50ms database queries
- **High throughput**: Handles 1000s of concurrent message resolutions
- **Graceful degradation**: Service continues if Redis fails (DB fallback)

### Cache Keys

#### 1. WhatsApp → Genesys Lookup
**Key**: `mapping:wa:{wa_id}`  
**Value** (JSON):
```json
{
  "conversation_id": "abc-123",
  "internal_mapping_id": "uuid-456",
  "last_activity_at": "2025-01-15T10:30:00Z"
}
```
**TTL**: 24 hours (refreshed on each message)

#### 2. Genesys → WhatsApp Lookup
**Key**: `mapping:conv:{conversation_id}`  
**Value** (JSON):
```json
{
  "wa_id": "919876543210",
  "internal_mapping_id": "uuid-456"
}
```
**TTL**: 24 hours (refreshed on each message)

### Cache Invalidation Strategy
- **TTL-based**: Auto-expire after 24 hours of inactivity
- **Explicit deletion**: When mapping status changes to 'expired' or 'closed'
- **Write-through**: Update Redis immediately when database is updated

### Cache Operation Patterns

**Pattern 1: Read-Through**
```python
def get_mapping_by_wa_id(wa_id: str) -> Optional[dict]:
    # Try cache first
    cache_key = f"mapping:wa:{wa_id}"
    cached = redis.get(cache_key)
    
    if cached:
        return json.loads(cached)
    
    # Cache miss - query database
    mapping = db.query(
        "SELECT * FROM conversation_mappings WHERE wa_id = $1 AND status = 'active'",
        wa_id
    )
    
    if mapping:
        # Populate cache
        redis.setex(cache_key, 86400, json.dumps(mapping))
    
    return mapping
```

**Pattern 2: Write-Through**
```python
def update_conversation_id(mapping_id: str, conversation_id: str, wa_id: str):
    # Update database
    db.execute(
        "UPDATE conversation_mappings SET conversation_id = $1 WHERE id = $2",
        conversation_id, mapping_id
    )
    
    # Update cache immediately
    mapping = db.query("SELECT * FROM conversation_mappings WHERE id = $1", mapping_id)
    redis.setex(f"mapping:wa:{wa_id}", 86400, json.dumps(mapping))
    redis.setex(f"mapping:conv:{conversation_id}", 86400, json.dumps(mapping))
```

---

## Core Operations

### Operation 1: Inbound Message - Identity Resolution

**Trigger**: Message arrives from WhatsApp via RabbitMQ `inboundQueue`

**Input Payload**:
```json
{
  "wa_id": "919876543210",
  "wamid": "wamid.HBgNMTIzNDU2Nzg5MBUCABIYFjNFQjBDRkQ1RkE5M0U3QTcyNzY5",
  "message_text": "Hello, I need help",
  "contact_name": "John Doe",
  "timestamp": "2025-01-15T10:30:00Z",
  "media_url": "https://minio.internal/media/abc123.jpg"
}
```

**Processing Steps**:

1. **Validation**
   - Verify `wa_id` is valid phone number format (E.164)
   - If `media_url` present, validate it's from allowed domains (MinIO only)

2. **Distributed Lock Acquisition**
   - Acquire Redis lock: `lock:mapping:{wa_id}`
   - TTL: 5 seconds (prevents deadlock)
   - Retry: 3 attempts with 100ms delay
   - **Purpose**: Prevents race condition when multiple messages arrive simultaneously from same user

3. **Mapping Lookup** (Cache-first pattern)
   ```python
   # Check cache
   cache_key = f"mapping:wa:{wa_id}"
   cached_mapping = redis.get(cache_key)
   
   if cached_mapping:
       mapping = json.loads(cached_mapping)
   else:
       # Database fallback
       mapping = db.query("""
           SELECT * FROM conversation_mappings 
           WHERE wa_id = $1 AND status = 'active'
       """, wa_id)
       
       if mapping:
           # Populate cache
           redis.setex(cache_key, 86400, json.dumps(mapping))
   ```

4. **Mapping Creation** (if not found)
   ```sql
   INSERT INTO conversation_mappings (
     id, wa_id, last_message_id, contact_name, 
     status, last_activity_at, created_at, updated_at
   ) VALUES (
     gen_random_uuid(), $1, $2, $3,
     'active', NOW(), NOW(), NOW()
   )
   ON CONFLICT (wa_id) WHERE status = 'active'
   DO NOTHING
   RETURNING id, conversation_id;
   ```
   **Parameters**:
   - `$1` = wa_id
   - `$2` = wamid
   - `$3` = contact_name
   
   **Note**: `conversation_id` is NULL at this point (will be set later by Operation 5)

5. **Message Tracking** (Idempotent insert)
   ```sql
   INSERT INTO message_tracking (
     id, mapping_id, wamid, direction, status, media_url, created_at, updated_at
   ) VALUES (
     gen_random_uuid(), $1, $2, 'INBOUND', 'received', $3, NOW(), NOW()
   )
   ON CONFLICT (wamid) DO NOTHING
   RETURNING id;
   ```
   **Parameters**:
   - `$1` = mapping_id
   - `$2` = wamid
   - `$3` = media_url (or NULL)

6. **Update Activity Timestamp**
   ```sql
   UPDATE conversation_mappings 
   SET last_activity_at = NOW(), 
       last_message_id = $1,
       updated_at = NOW()
   WHERE id = $2;
   ```

7. **Cache Population**
   ```python
   cache_data = {
       "conversation_id": mapping.conversation_id,
       "internal_mapping_id": mapping.id,
       "last_activity_at": mapping.last_activity_at.isoformat()
   }
   redis.setex(f"mapping:wa:{wa_id}", 86400, json.dumps(cache_data))
   ```

8. **Lock Release**
   ```python
   redis.delete(f"lock:mapping:{wa_id}")
   ```

9. **Forward to Next Queue**
   - Publish enriched message to `inbound.enriched` queue

**Output Payload** (enriched):
```json
{
  "wa_id": "919876543210",
  "wamid": "wamid.HBgNMTIzNDU2Nzg5MBUCABIYFjNFQjBDRkQ1RkE5M0U3QTcyNzY5",
  "traceId": "trace-uuid-v4",
  "internalId": "uuid-456",
  "message_text": "Hello, I need help",
  "contact_name": "John Doe",
  "timestamp": "2025-01-15T10:30:00Z",
  "media_url": "https://minio.internal/media/abc123.jpg",
  "mapping_id": "uuid-456",
  "conversation_id": "abc-123",
  "is_new_conversation": true
}
```

**Idempotency Guarantee**:
- If `wamid` already exists in `message_tracking`, the ON CONFLICT clause prevents duplicate insertion
- Log a warning but continue processing (don't fail the message)

**Error Handling**:
```python
try:
    # Process message
    pass
except LockAcquisitionFailed:
    # Could not acquire lock after 3 retries
    # Send to DLQ with reason: "lock_timeout"
    logger.error(f"Failed to acquire lock for wa_id={wa_id}")
    send_to_dlq(message, reason="lock_timeout")
except DatabaseError as e:
    # Database unavailable
    # Reject message back to queue for retry
    logger.error(f"Database error: {e}")
    raise  # RabbitMQ will requeue
```

---

### Operation 2: Outbound Message - Identity Resolution

**Trigger**: Message needs to be sent from Genesys to WhatsApp via RabbitMQ `outboundQueue`

**Input Payload**:
```json
{
  "conversation_id": "abc-123",
  "genesys_message_id": "msg-xyz",
  "message_text": "Thank you for contacting us",
  "media_url": null
}
```

**Processing Steps**:

1. **Validation**
   - Verify `conversation_id` is not null/empty
   - Verify `conversation_id` is valid UUID format

2. **Mapping Lookup** (Cache-first)
   ```python
   # Check cache
   cache_key = f"mapping:conv:{conversation_id}"
   cached_mapping = redis.get(cache_key)
   
   if cached_mapping:
       mapping = json.loads(cached_mapping)
   else:
       # Database fallback
       mapping = db.query("""
           SELECT * FROM conversation_mappings
           WHERE conversation_id = $1 AND status = 'active'
       """, conversation_id)
       
       if mapping:
           # Populate cache
           redis.setex(cache_key, 86400, json.dumps(mapping))
   ```

3. **Error Handling - Mapping Not Found**
   ```python
   if not mapping:
       logger.error(f"No active mapping found for conversation_id={conversation_id}")
       send_to_dlq(message, reason="mapping_not_found")
       return
   ```

4. **Status Validation**
   ```python
   if mapping['status'] != 'active':
       logger.warning(f"Mapping status is {mapping['status']}, not active")
       send_to_dlq(message, reason=f"mapping_status_{mapping['status']}")
       return
   ```

5. **Message Tracking**
   ```sql
   INSERT INTO message_tracking (
     id, mapping_id, genesys_id, direction, status, media_url, created_at, updated_at
   ) VALUES (
     gen_random_uuid(), $1, $2, 'OUTBOUND', 'queued', $3, NOW(), NOW()
   )
   RETURNING id;
   ```

6. **Update Activity Timestamp**
   ```sql
   UPDATE conversation_mappings
   SET last_activity_at = NOW(),
       updated_at = NOW()
   WHERE id = $1;
   ```

7. **Refresh Cache TTL**
   ```python
   # Extend TTL on both cache keys
   redis.expire(f"mapping:wa:{mapping['wa_id']}", 86400)
   redis.expire(f"mapping:conv:{conversation_id}", 86400)
   ```

8. **Forward to WhatsApp Queue**
   - Publish to `outbound-processed` queue with `wa_id` attached

**Output Payload** (enriched):
```json
{
  "conversation_id": "abc-123",
  "genesys_message_id": "msg-xyz",
  "message_text": "Thank you for contacting us",
  "media_url": null,
  "wa_id": "919876543210",
  "mapping_id": "uuid-456"
}
```

---

### Operation 3: Message Status Update (from WhatsApp)

**Trigger**: WhatsApp webhook delivers status update via RabbitMQ `statusQueue`

**Input Payload**:
```json
{
  "wamid": "wamid.HBgNMTIzNDU2Nzg5MBUCABIYFjNFQjBDRkQ1RkE5M0U3QTcyNzY5",
  "status": "delivered",
  "timestamp": "2025-01-15T10:31:00Z"
}
```

**Processing Steps**:

1. **Locate Message**
   ```sql
   SELECT id, status, updated_at, direction, mapping_id
   FROM message_tracking
   WHERE wamid = $1;
   ```

2. **Handle Unknown Message**
   ```python
   if not message:
       logger.warning(f"Status update for unknown wamid={wamid}, ignoring")
       return  # Not an error - might be from before system deployment
   ```

3. **Validate State Transition**
   ```python
   if not is_valid_transition(message['status'], new_status):
       logger.warning(
           f"Invalid state transition for wamid={wamid}: "
           f"{message['status']} -> {new_status}"
       )
       return  # Don't update, don't error
   ```

4. **Timestamp Check (prevent stale updates)**
   ```python
   event_timestamp = datetime.fromisoformat(event['timestamp'])
   if event_timestamp <= message['updated_at']:
       logger.info(f"Ignoring stale status update for wamid={wamid}")
       return
   ```

5. **Update Status (Atomic)**
   ```sql
   UPDATE message_tracking
   SET status = $1, 
       updated_at = $2
   WHERE id = $3 
     AND status = $4  -- Optimistic locking
   RETURNING id;
   ```
   **Parameters**:
   - `$1` = new_status
   - `$2` = event_timestamp
   - `$3` = message_id
   - `$4` = current_status

6. **Check Update Result**
   ```python
   if rows_affected == 0:
       # Status changed between SELECT and UPDATE (race condition)
       logger.info(f"Message status already updated for wamid={wamid}")
   ```

7. **Optional: Publish State Change Event**
   ```python
   if rows_affected > 0:
       publish_event("state.message.updated", {
           "wamid": wamid,
           "old_status": current_status,
           "new_status": new_status,
           "timestamp": event_timestamp
       })
   ```

**Error Cases**:
- Unknown wamid → Log warning, continue (not an error)
- Invalid state transition → Log warning, skip update
- Stale event → Log info, skip update
- Database error → Raise exception (RabbitMQ will requeue)

---

### Operation 4: Message Status Update (from Genesys)

**Trigger**: Genesys webhook or polling detects message status change

**Input Payload**:
```json
{
  "genesys_message_id": "msg-xyz",
  "conversation_id": "abc-123",
  "status": "processed",
  "timestamp": "2025-01-15T10:31:30Z"
}
```

**Processing Steps**: (Similar to Operation 3, but query by `genesys_id`)

```sql
SELECT id, status, updated_at, direction, mapping_id
FROM message_tracking
WHERE genesys_id = $1;
```

**Note**: Genesys status updates apply to INBOUND messages only (`direction = 'INBOUND'`)

---

### Operation 5: Conversation ID Correlation

**Trigger**: Genesys API successfully creates a conversation and returns the `conversation_id`

**Context**: When an inbound message arrives, we create a mapping with `conversation_id = NULL`. After Genesys creates the conversation, we need to update our mapping with the actual conversation ID.

**Input Payload**:
```json
{
  "conversation_id": "abc-123",
  "communication_id": "comm-456",
  "whatsapp_message_id": "wamid.HBgNMTIzNDU2Nzg5MBUCABIYFjNFQjBDRkQ1RkE5M0U3QTcyNzY5"
}
```

**Processing Steps**:

1. **Update Mapping (Idempotent)**
   ```sql
   UPDATE conversation_mappings
   SET 
     conversation_id = $1,
     communication_id = $2,
     updated_at = NOW()
   WHERE 
     last_message_id = $3
     AND conversation_id IS NULL
   RETURNING id, wa_id;
   ```
   **Parameters**:
   - `$1` = conversation_id
   - `$2` = communication_id
   - `$3` = whatsapp_message_id

2. **Check Update Result**
   ```python
   if rows_affected == 0:
       # conversation_id already set (duplicate webhook)
       logger.info(
           f"Conversation ID already set for wamid={whatsapp_message_id}, "
           f"ignoring duplicate correlation"
       )
       return
   ```

3. **Cache Population (Both Keys)**
   ```python
   mapping = fetch_mapping_by_id(mapping_id)
   
   # WhatsApp → Genesys lookup
   cache_data_wa = {
       "conversation_id": conversation_id,
       "internal_mapping_id": mapping_id,
       "last_activity_at": mapping['last_activity_at'].isoformat()
   }
   redis.setex(f"mapping:wa:{wa_id}", 86400, json.dumps(cache_data_wa))
   
   # Genesys → WhatsApp lookup
   cache_data_conv = {
       "wa_id": wa_id,
       "internal_mapping_id": mapping_id
   }
   redis.setex(f"mapping:conv:{conversation_id}", 86400, json.dumps(cache_data_conv))
   ```

4. **Optional: Publish Correlation Event**
   ```python
   publish_event("state.conversation.correlated", {
       "wa_id": wa_id,
       "conversation_id": conversation_id,
       "communication_id": communication_id
   })
   ```

**Why This Matters**: This operation "closes the loop" between WhatsApp and Genesys, enabling bidirectional message routing.

**Idempotency**: The `WHERE conversation_id IS NULL` clause ensures duplicate correlation attempts are safely ignored.

---

## Conversation Lifecycle Management

### Auto-Expiry Policy

**Rule**: Conversations expire after 24 hours of inactivity

**Background Job**: `ConversationExpiryJob`

**Frequency**: Runs every 5 minutes

**Detection Query**:
```sql
SELECT id, wa_id, conversation_id
FROM conversation_mappings
WHERE status = 'active'
  AND last_activity_at < NOW() - INTERVAL '24 hours'
LIMIT 1000;  -- Process in batches
```

**Expiry Process**:
```sql
UPDATE conversation_mappings
SET status = 'expired', 
    updated_at = NOW()
WHERE id = ANY($1::uuid[]);
```

**Cache Cleanup**:
```python
for mapping in expired_mappings:
    redis.delete(f"mapping:wa:{mapping['wa_id']}")
    if mapping['conversation_id']:
        redis.delete(f"mapping:conv:{mapping['conversation_id']}")
```

**Logging**:
```python
logger.info(
    f"Expired {len(expired_mappings)} conversations",
    extra={
        "expired_count": len(expired_mappings),
        "oldest_activity": min(m['last_activity_at'] for m in expired_mappings)
    }
)
```

**Behavior After Expiry**:
- Next inbound message from same `wa_id` creates a NEW conversation
- This prevents stale conversations from accumulating
- Historical data remains in database for audit purposes

**Monitoring**:
- Metric: `conversations_expired_total` (counter)
- Metric: `conversations_expired_last_run` (gauge)
- Alert: If no expirations happen for 24 hours (job might be stuck)

---

## API Endpoints

### 1. GET /mapping/wa/:waId

**Purpose**: Retrieve conversation mapping by WhatsApp user ID

**Example Request**:
```
GET /mapping/wa/919876543210
```

**Response** (200 OK):
```json
{
  "conversationId": "abc-123",
  "waId": "919876543210",
  "isNew": false,
  "internalId": "uuid-456",
  "status": "active",
  "lastActivityAt": "2025-01-15T10:30:00Z",
  "communicationId": "comm-456"
}
```

**Response** (404 Not Found):
```json
{
  "error": "No active mapping found",
  "waId": "919876543210"
}
```

**Implementation**:
```python
@app.get("/mapping/wa/{wa_id}")
def get_mapping_by_wa_id(wa_id: str):
    # Try cache first
    cached = redis.get(f"mapping:wa:{wa_id}")
    if cached:
        data = json.loads(cached)
        mapping = db.query("SELECT * FROM conversation_mappings WHERE id = $1", 
                          data['internal_mapping_id'])
    else:
        # Database fallback
        mapping = db.query(
            "SELECT * FROM conversation_mappings WHERE wa_id = $1 AND status = 'active'",
            wa_id
        )
    
    if not mapping:
        return JSONResponse(status_code=404, content={"error": "No active mapping found"})
    
    return {
        "conversationId": mapping['conversation_id'],
        "waId": mapping['wa_id'],
        "isNew": mapping['conversation_id'] is None,
        "internalId": mapping['id'],
        "status": mapping['status'],
        "lastActivityAt": mapping['last_activity_at'].isoformat(),
        "communicationId": mapping['communication_id']
    }
```

---

### 2. GET /mapping/conv/:conversationId

**Purpose**: Retrieve WhatsApp user ID by Genesys conversation ID

**Example Request**:
```
GET /mapping/conv/abc-123
```

**Response** (200 OK):
```json
{
  "waId": "919876543210",
  "internalId": "uuid-456",
  "status": "active",
  "communicationId": "comm-456",
  "lastActivityAt": "2025-01-15T10:30:00Z"
}
```

**Response** (404 Not Found):
```json
{
  "error": "No mapping found for conversation",
  "conversationId": "abc-123"
}
```

**Implementation**:
```python
@app.get("/mapping/conv/{conversation_id}")
def get_mapping_by_conversation_id(conversation_id: str):
    # Try cache first
    cached = redis.get(f"mapping:conv:{conversation_id}")
    if cached:
        data = json.loads(cached)
        mapping = db.query("SELECT * FROM conversation_mappings WHERE id = $1", 
                          data['internal_mapping_id'])
    else:
        # Database fallback
        mapping = db.query(
            "SELECT * FROM conversation_mappings WHERE conversation_id = $1 AND status = 'active'",
            conversation_id
        )
    
    if not mapping:
        return JSONResponse(status_code=404, content={"error": "No mapping found"})
    
    return {
        "waId": mapping['wa_id'],
        "internalId": mapping['id'],
        "status": mapping['status'],
        "communicationId": mapping['communication_id'],
        "lastActivityAt": mapping['last_activity_at'].isoformat()
    }
```

---

### 3. POST /messages

**Purpose**: Manual message tracking (fallback/testing endpoint)

**Request Body**:
```json
{
  "mappingId": "uuid-456",
  "wamid": "wamid.xxx",
  "genesysId": "msg-xyz",
  "direction": "INBOUND",
  "status": "received",
  "mediaUrl": null
}
```

**Response** (201 Created):
```json
{
  "id": "msg-tracking-uuid",
  "created": true
}
```

**Response** (409 Conflict) - Duplicate wamid:
```json
{
  "error": "Message already tracked",
  "wamid": "wamid.xxx",
  "existingId": "existing-uuid"
}
```

---

### 4. PATCH /messages/:wamid

**Purpose**: Update message status with validation

**Request Body**:
```json
{
  "status": "delivered",
  "timestamp": "2025-01-15T10:31:00Z"
}
```

**Response** (200 OK):
```json
{
  "updated": true,
  "previousStatus": "sent",
  "newStatus": "delivered",
  "messageId": "msg-tracking-uuid"
}
```

**Response** (400 Bad Request) - Invalid transition:
```json
{
  "error": "Invalid state transition",
  "currentStatus": "delivered",
  "attemptedStatus": "sent",
  "validNextStates": ["read", "failed"]
}
```

**Response** (404 Not Found):
```json
{
  "error": "Message not found",
  "wamid": "wamid.xxx"
}
```

---

### 5. GET /health

**Purpose**: Health check endpoint for load balancer

**Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "checks": {
    "database": {
      "status": "ok",
      "latency_ms": 3
    },
    "redis": {
      "status": "ok",
      "latency_ms": 1
    },
    "rabbitmq": {
      "status": "ok",
      "queue_depth": 45
    }
  },
  "uptime_seconds": 86400
}
```

**Response** (503 Service Unavailable) - Database down:
```json
{
  "status": "unhealthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "checks": {
    "database": {
      "status": "error",
      "error": "Connection refused"
    },
    "redis": {
      "status": "ok"
    },
    "rabbitmq": {
      "status": "ok"
    }
  }
}
```

---

## Non-Functional Requirements

### Performance Targets

| Operation | Target Latency | Measurement Point |
|-----------|---------------|-------------------|
| Redis cache hit | < 10ms | P95 |
| Database query (single mapping) | < 50ms | P95 |
| End-to-end inbound processing | < 100ms | P95, includes lock + DB + cache |
| Lock acquisition | < 5ms | P99 |
| Status update | < 30ms | P95 |

**Throughput Target**: 
- **Per instance**: 1,000 messages/second
- **MVP deployment**: 5,000 messages/second (5 instances)

**Benchmarking**:
- Test with realistic message distribution (70% inbound, 30% outbound)
- Simulate burst traffic (3x normal load for 5 minutes)

---

### Concurrency Controls

**Problem**: Multiple workers might process messages from the same WhatsApp user simultaneously

**Solutions**:

#### 1. Redis Distributed Locks

**Lock Key Format**: `lock:mapping:{wa_id}`

**Implementation**:
```python
def acquire_lock(wa_id: str, ttl_seconds: int = 5) -> bool:
    """
    Acquire distributed lock using Redis SET NX
    Returns True if lock acquired, False otherwise
    """
    lock_key = f"lock:mapping:{wa_id}"
    acquired = redis.set(lock_key, "1", nx=True, ex=ttl_seconds)
    return acquired

def release_lock(wa_id: str):
    """Release lock immediately"""
    redis.delete(f"lock:mapping:{wa_id}")

def with_lock_retry(wa_id: str, max_retries: int = 3):
    """Retry lock acquisition with exponential backoff"""
    for attempt in range(max_retries):
        if acquire_lock(wa_id):
            return True
        time.sleep(0.1 * (2 ** attempt))  # 100ms, 200ms, 400ms
    return False
```

**Lock TTL**: 5 seconds
- **Purpose**: Prevents deadlock if service crashes while holding lock
- **Justification**: Normal processing takes <100ms, 5s is safe buffer

#### 2. Database Constraints

**Prevents duplicate active conversations**:
```sql
CREATE UNIQUE INDEX idx_unique_active_mapping 
ON conversation_mappings (wa_id) 
WHERE status = 'active';
```

**Behavior**: If two workers try to create mapping simultaneously, one gets `UniqueViolation` error

#### 3. Idempotent Message Logging

**Prevents duplicate message tracking**:
```sql
CREATE UNIQUE INDEX idx_wamid ON message_tracking (wamid);

INSERT INTO message_tracking (...) VALUES (...)
ON CONFLICT (wamid) DO NOTHING;
```

**Behavior**: Duplicate `wamid` → silent ignore, log warning

#### 4. Optimistic Locking for Status Updates

**Prevents lost updates**:
```sql
UPDATE message_tracking
SET status = $1, updated_at = $2
WHERE id = $3 AND status = $4;  -- Compare current status
```

**Behavior**: If status changed between SELECT and UPDATE → 0 rows affected

### Lock Contention Handling

**Monitoring**:
```python
# Metric: lock acquisition failures
lock_failures = Counter('lock_acquisition_failures_total', 'Lock acquisition failures')

if not with_lock_retry(wa_id):
    lock_failures.inc()
    send_to_dlq(message, reason="lock_timeout")
```

**Alerting**:
- If `lock_failures` > 10/minute → Warning
- If `lock_failures` > 100/minute → Critical (possible thundering herd)

---

### Reliability & Fault Tolerance

#### Failure Scenario Matrix

| Component | Failure Mode | Detection | Action | Recovery Time |
|-----------|--------------|-----------|--------|---------------|
| Redis | Connection lost | Health check fails | Fallback to DB | 0s (automatic) |
| Redis | Slow response | Timeout (500ms) | Fallback to DB | 0s (automatic) |
| PostgreSQL | Connection lost | Query exception | Pause queue consumption | Manual |
| PostgreSQL | Slow query | Timeout (5s) | Reject message (requeue) | Automatic |
| RabbitMQ | Connection lost | Connection exception | Reconnect with backoff | 30s (automatic) |
| RabbitMQ | Queue full | Publish exception | Alert + circuit breaker | Manual |

#### Redis Failure Handling

**Pattern**: Graceful Degradation

```python
def get_mapping_with_fallback(wa_id: str) -> Optional[dict]:
    try:
        # Try Redis first
        cached = redis.get(f"mapping:wa:{wa_id}", timeout=0.5)
        if cached:
            cache_hit_counter.inc()
            return json.loads(cached)
    except (redis.TimeoutError, redis.ConnectionError) as e:
        logger.warning(f"Redis unavailable, falling back to DB: {e}")
        cache_miss_counter.inc()
    
    # Fallback to database
    return db.query(
        "SELECT * FROM conversation_mappings WHERE wa_id = $1 AND status = 'active'",
        wa_id
    )
```

**Impact**: 
- Latency increases from ~10ms to ~50ms
- Service remains fully functional
- Cache hit rate drops to 0%

#### Database Failure Handling

**Pattern**: Fail-Stop

```python
def health_check():
    try:
        db.query("SELECT 1")
        return {"database": "ok"}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {"database": "error"}

# In queue consumer
if health_check()["database"] != "ok":
    logger.critical("Database unhealthy, pausing queue consumption")
    channel.stop_consuming()
    trigger_alert("database_down")
    time.sleep(30)  # Wait before retry
```

**Rationale**: Without database, we cannot:
- Create new mappings
- Track messages
- Prevent duplicate conversations

**Better to**: Stop processing than risk data corruption

#### Dead Letter Queue (DLQ)

**Reasons for DLQ routing**:

| Reason | Description | Resolution |
|--------|-------------|------------|
| `mapping_not_found` | Outbound message for unknown conversation | Manual investigation |
| `lock_timeout` | Could not acquire lock after 3 retries | Automatic retry after 5 min |
| `invalid_payload` | Missing required fields | Fix producer, discard |
| `state_violation` | Invalid status transition | Manual review |
| `mapping_status_expired` | Mapping expired before outbound sent | Alert Genesys team |
| `database_error` | Persistent DB error | Manual investigation |

**DLQ Processing Strategy**:
```python
# Automatic retry for transient errors
RETRIABLE_REASONS = ['lock_timeout', 'database_error']

def process_dlq_message(message: dict):
    if message['reason'] in RETRIABLE_REASONS:
        if message['retry_count'] < 3:
            # Requeue to main queue
            message['retry_count'] += 1
            publish_to_queue('inboundQueue', message)
        else:
            # Exhausted retries
            store_in_permanent_dlq(message)
            alert_team(message)
    else:
        # Manual intervention required
        store_in_permanent_dlq(message)
```

**Monitoring**:
```python
dlq_depth = Gauge('dlq_message_count', 'Messages in DLQ')
dlq_messages_total = Counter('dlq_messages_total', 'DLQ messages', ['reason'])

# Alert if DLQ depth > 100
if dlq_depth.get() > 100:
    trigger_alert("dlq_depth_high")
```

---

### Scalability

#### Horizontal Scaling Strategy

**Service Architecture**: Stateless workers consuming from shared queues

**Scaling Trigger**: Queue depth

```yaml
# Kubernetes HPA (Horizontal Pod Autoscaler)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: state-manager
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: state-manager
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: External
    external:
      metric:
        name: rabbitmq_queue_messages
        selector:
          matchLabels:
            queue: inboundQueue
      target:
        type: AverageValue
        averageValue: "1000"  # Scale up if queue depth > 1000 per pod
```

**Capacity Planning**:

| Load Level | Messages/sec | Required Instances | Queue Depth |
|------------|--------------|-------------------|-------------|
| Low | 1,000 | 3 | < 500 |
| Normal | 5,000 | 5 | < 1,000 |
| High | 10,000 | 10 | < 2,000 |
| Peak | 20,000 | 20 | < 5,000 |

#### Database Scaling

**MVP**: Single PostgreSQL instance with replication

**Read/Write Split**:
```python
# Write operations (mappings, message tracking) → Primary
primary_db = Database(settings.DB_PRIMARY_URL)

# Read operations (API endpoints) → Replica (optional)
replica_db = Database(settings.DB_REPLICA_URL or settings.DB_PRIMARY_URL)

@app.get("/mapping/wa/{wa_id}")
def get_mapping(wa_id: str):
    # Use replica for reads
    return replica_db.query("SELECT * FROM conversation_mappings WHERE wa_id = $1", wa_id)
```

**Future**: 
- Table partitioning for `message_tracking` (by month)
- Connection pooling (PgBouncer)
- Separate DB per tenant (already physically isolated in MVP)

#### Cache Scaling

**Redis Clustering** (Future):
```
Hash slot distribution:
- Slot 0-5460:   Redis Node 1
- Slot 5461-10922:  Redis Node 2
- Slot 10923-16383: Redis Node 3

Key distribution uses consistent hashing:
mapping:wa:{wa_id} → hashed to slot → routed to node
```

**MVP**: Single Redis instance with persistence (AOF)

---

### Observability

#### Metrics (Prometheus)

**Latency Histograms**:
```python
from prometheus_client import Histogram

mapping_resolution_latency = Histogram(
    'mapping_resolution_duration_seconds',
    'Time to resolve mapping',
    ['operation', 'cache_hit']
)

# Usage
with mapping_resolution_latency.labels(operation='wa_lookup', cache_hit='true').time():
    mapping = get_mapping_by_wa_id(wa_id)
```

**Counters**:
```python
from prometheus_client import Counter

messages_processed = Counter(
    'messages_processed_total',
    'Total messages processed',
    ['direction', 'status']
)

conversations_created = Counter(
    'conversations_created_total',
    'New conversations created'
)

duplicate_messages = Counter(
    'duplicate_messages_total',
    'Messages with duplicate wamid'
)

cache_operations = Counter(
    'cache_operations_total',
    'Cache operations',
    ['operation', 'result']  # operation: get/set, result: hit/miss/error
)
```

**Gauges**:
```python
from prometheus_client import Gauge

active_conversations = Gauge(
    'active_conversations_count',
    'Number of active conversations'
)

# Update periodically (every 60s)
def update_active_conversations():
    count = db.query("SELECT COUNT(*) FROM conversation_mappings WHERE status = 'active'")[0]
    active_conversations.set(count)

lock_contention_rate = Gauge(
    'lock_contention_rate',
    'Percentage of lock acquisition failures'
)
```

#### Structured Logging

**Log Format** (JSON):
```json
{
  "timestamp": "2025-01-15T10:30:00.123Z",
  "level": "INFO",
  "service": "state-manager",
  "operation": "inbound_identity_resolution",
  "trace_id": "abc-123-xyz",
  "wa_id": "919876543210",
  "wamid": "wamid.xxx",
  "mapping_id": "uuid-456",
  "cache_hit": true,
  "is_new_conversation": false,
  "duration_ms": 8,
  "message": "Mapping resolved successfully"
}
```

**Log Levels**:

| Level | Use Case | Example |
|-------|----------|---------|
| DEBUG | Detailed flow | "Acquired lock for wa_id=..." |
| INFO | Normal operations | "Mapping resolved", "Message tracked" |
| WARNING | Recoverable issues | "Duplicate wamid ignored", "Invalid state transition" |
| ERROR | Failed operations | "Database query failed", "DLQ send failed" |
| CRITICAL | Service degradation | "Database unreachable", "Redis cluster down" |

**Key Operations to Log**:

1. **Mapping Creation**:
```python
logger.info(
    "New conversation mapping created",
    extra={
        "operation": "mapping_create",
        "wa_id": wa_id,
        "mapping_id": mapping_id,
        "contact_name": contact_name
    }
)
```

2. **Conversation Correlation**:
```python
logger.info(
    "Conversation correlated",
    extra={
        "operation": "conversation_correlated",
        "wa_id": wa_id,
        "conversation_id": conversation_id,
        "communication_id": communication_id
    }
)
```

3. **DLQ Routing**:
```python
logger.error(
    "Message sent to DLQ",
    extra={
        "operation": "dlq_send",
        "reason": reason,
        "wamid": wamid,
        "retry_count": retry_count
    }
)
```

#### Alerting Rules

**Critical Alerts** (Page on-call):
```yaml
groups:
- name: state_manager_critical
  rules:
  - alert: DatabaseDown
    expr: up{job="postgres"} == 0
    for: 1m
    annotations:
      summary: "PostgreSQL is down"
      
  - alert: HighDLQDepth
    expr: dlq_message_count > 1000
    for: 5m
    annotations:
      summary: "DLQ has {{ $value }} messages"
      
  - alert: HighErrorRate
    expr: rate(messages_processed_total{status="error"}[5m]) > 10
    for: 2m
    annotations:
      summary: "Error rate: {{ $value }}/sec"
```

**Warning Alerts** (Slack notification):
```yaml
groups:
- name: state_manager_warnings
  rules:
  - alert: LowCacheHitRate
    expr: rate(cache_operations_total{result="hit"}[5m]) / rate(cache_operations_total[5m]) < 0.8
    for: 10m
    annotations:
      summary: "Cache hit rate: {{ $value | humanizePercentage }}"
      
  - alert: HighLatency
    expr: histogram_quantile(0.95, mapping_resolution_duration_seconds) > 0.2
    for: 5m
    annotations:
      summary: "P95 latency: {{ $value }}s"
```

#### Dashboards

**Grafana Dashboard Panels**:

1. **Operations Overview**:
   - Messages processed/sec (by direction)
   - Active conversations (gauge)
   - Conversations created/hour

2. **Performance**:
   - P50/P95/P99 latency (inbound, outbound, correlation)
   - Cache hit rate (%)
   - Database query duration

3. **Reliability**:
   - DLQ depth (over time)
   - Error rate (%)
   - Lock contention rate

4. **Infrastructure**:
   - Database connections (active/idle)
   - Redis memory usage
   - RabbitMQ queue depth

---

## Data Retention & Archival

### Retention Policy

| Table | Active Retention | Archive Retention | Total Retention |
|-------|------------------|-------------------|-----------------|
| `conversation_mappings` | 90 days | 1 year | 15 months |
| `message_tracking` | 30 days | 6 months | 7.5 months |

### Archival Strategy

**Monthly Batch Job**: `archival_job.py`

**Execution**: 1st day of month at 02:00 AM

**Process**:

1. **Archive Conversation Mappings**:
```sql
-- Create archive table (one-time)
CREATE TABLE conversation_mappings_archive (LIKE conversation_mappings INCLUDING ALL);

-- Move old records
INSERT INTO conversation_mappings_archive
SELECT * FROM conversation_mappings
WHERE updated_at < NOW() - INTERVAL '90 days'
  AND status IN ('expired', 'closed');

-- Delete from active table
DELETE FROM conversation_mappings
WHERE updated_at < NOW() - INTERVAL '90 days'
  AND status IN ('expired', 'closed');
```

2. **Archive Message Tracking** (with partitioning):
```sql
-- Create monthly partition (future enhancement)
CREATE TABLE message_tracking_2025_01 PARTITION OF message_tracking
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Drop old partition (automatic archival)
DROP TABLE IF EXISTS message_tracking_2024_07;  -- 6 months old
```

**Backup Before Deletion**:
```bash
# Export to S3 before dropping
pg_dump -t conversation_mappings_archive | gzip | aws s3 cp - s3://backups/state-manager/mappings_2025_01.sql.gz
```

### Data Lifecycle

```
Day 0:    Message arrives → Active table
Day 30:   Archive message_tracking → Archive table
Day 90:   Archive conversation_mappings → Archive table
Day 210:  Delete from message_tracking_archive
Day 450:  Delete from conversation_mappings_archive
```

---

## Security Considerations

### Media URL Validation

**Threat**: Server-Side Request Forgery (SSRF)

**Protection**: Whitelist allowed domains

```python
ALLOWED_MEDIA_DOMAINS = [
    "minio.internal.company.com",
    "s3.amazonaws.com"
]

def validate_media_url(url: str) -> bool:
    """
    Validate media URL is from trusted source
    Returns True if valid, False otherwise
    """
    if not url:
        return True  # NULL is valid
    
    try:
        parsed = urlparse(url)
        
        # Check scheme
        if parsed.scheme not in ['https', 'http']:
            logger.warning(f"Invalid media URL scheme: {parsed.scheme}")
            return False
        
        # Check domain
        if not any(parsed.hostname.endswith(domain) for domain in ALLOWED_MEDIA_DOMAINS):
            logger.warning(f"Media URL from untrusted domain: {parsed.hostname}")
            return False
        
        return True
    except Exception as e:
        logger.error(f"Media URL validation error: {e}")
        return False

# Usage in inbound processing
if message.get('media_url') and not validate_media_url(message['media_url']):
    send_to_dlq(message, reason="invalid_media_url")
    return
```

### API Authentication

**Requirement**: Internal service-to-service authentication

**MVP Implementation**: API Key

```python
from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader

API_KEY = os.getenv("STATE_MANAGER_API_KEY")
api_key_header = APIKeyHeader(name="X-API-Key")

def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return api_key

# Protect endpoints
@app.get("/mapping/wa/{wa_id}")
def get_mapping(wa_id: str, api_key: str = Depends(verify_api_key)):
    # Implementation
    pass
```

**Future Enhancement**: Mutual TLS (mTLS)

### SQL Injection Prevention

**Always use parameterized queries**:

```python
# ✅ CORRECT - Parameterized query
db.query(
    "SELECT * FROM conversation_mappings WHERE wa_id = $1",
    wa_id
)

# ❌ WRONG - String interpolation (SQL injection risk)
db.query(f"SELECT * FROM conversation_mappings WHERE wa_id = '{wa_id}'")
```

### Secrets Management

**Environment Variables**:
```bash
# Never hardcode secrets in code
DB_PASSWORD=${DB_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD}
STATE_MANAGER_API_KEY=${STATE_MANAGER_API_KEY}
```

**Production**: Use secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)

---

## Future Enhancements

### Phase 2: Multi-Channel Support

**Goal**: Support Instagram, Facebook Messenger, Telegram

**Schema Changes**:
```sql
ALTER TABLE conversation_mappings
ADD COLUMN channel VARCHAR(20) DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'instagram', 'messenger', 'telegram'));

-- Update unique constraint
DROP INDEX idx_unique_active_mapping;
CREATE UNIQUE INDEX idx_unique_active_mapping 
ON conversation_mappings (channel, wa_id) 
WHERE status = 'active';
```

**Cache Key Updates**:
```python
# Old: mapping:wa:{wa_id}
# New: mapping:{channel}:{external_id}
cache_key = f"mapping:{channel}:{external_id}"
```

### Phase 3: Multi-Active Conversations

**Use Case**: Power users with separate conversations (sales, support, billing)

**Configuration Table**:
```sql
CREATE TABLE tenant_settings (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    allow_multiple_active_conversations BOOLEAN DEFAULT FALSE,
    max_active_conversations_per_user INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Constraint Adjustment**:
```sql
-- Remove unique constraint, add CHECK constraint
ALTER TABLE conversation_mappings
DROP CONSTRAINT IF EXISTS unique_active_mapping;

-- Application-level enforcement based on tenant settings
```

### Phase 4: Event Sourcing

**Goal**: Full audit trail with event replay capability

**Event Store Schema**:
```sql
CREATE TABLE conversation_events (
    id UUID PRIMARY KEY,
    aggregate_id UUID NOT NULL,  -- mapping_id
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    sequence_number INT NOT NULL,
    occurred_at TIMESTAMP NOT NULL,
    UNIQUE (aggregate_id, sequence_number)
);

-- Event types:
-- - ConversationCreated
-- - ConversationCorrelated
-- - MessageReceived
-- - MessageSent
-- - StatusUpdated
-- - ConversationExpired
```

**Benefits**:
- Complete history of every state change
- Ability to rebuild state from events
- Time-travel debugging
- Analytics on state transitions

### Phase 5: Real-Time Analytics

**Stream Processing**: Apache Kafka + Flink

```python
# Publish events to Kafka
def publish_event(event_type: str, data: dict):
    kafka_producer.send(
        topic='state-manager-events',
        value={
            'event_type': event_type,
            'data': data,
            'timestamp': datetime.utcnow().isoformat()
        }
    )

# Real-time aggregations
# - Average response time
# - Conversation duration distribution
# - Peak load hours
# - User engagement metrics
```

---

## Testing Strategy

### Unit Tests

**Test Cases**:

1. **State Machine Validation**:
```python
def test_valid_state_transitions():
    assert is_valid_transition('queued', 'sent') == True
    assert is_valid_transition('sent', 'delivered') == True
    assert is_valid_transition('delivered', 'read') == True

def test_invalid_state_transitions():
    assert is_valid_transition('delivered', 'sent') == False
    assert is_valid_transition('queued', 'read') == False
```

2. **Cache Key Generation**:
```python
def test_cache_key_format():
    key = generate_cache_key('wa', '919876543210')
    assert key == 'mapping:wa:919876543210'
```

3. **Idempotency**:
```python
def test_duplicate_wamid_handling():
    # Insert message
    insert_message(mapping_id, wamid='test123')
    
    # Try inserting again
    result = insert_message(mapping_id, wamid='test123')
    assert result['created'] == False
```

### Integration Tests

**Test Cases**:

1. **Redis Failover**:
```python
def test_redis_failover():
    # Stop Redis
    redis_container.stop()
    
    # Operation should still succeed via DB fallback
    mapping = get_mapping_by_wa_id('919876543210')
    assert mapping is not None
    
    # Start Redis
    redis_container.start()
```

2. **Concurrent Mapping Creation**:
```python
def test_concurrent_mapping_creation():
    # Simulate 10 simultaneous messages from same wa_id
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(create_mapping, wa_id='919876543210', wamid=f'wamid_{i}')
            for i in range(10)
        ]
    
    # Only ONE mapping should be created
    mappings = db.query("SELECT * FROM conversation_mappings WHERE wa_id = '919876543210'")
    assert len(mappings) == 1
```

3. **Lock Timeout**:
```python
def test_lock_timeout_handling():
    # Hold lock indefinitely
    redis.set('lock:mapping:919876543210', '1', ex=30)
    
    # Try to process message
    result = process_inbound_message({'wa_id': '919876543210', 'wamid': 'test'})
    
    # Should send to DLQ
    assert result['dlq_reason'] == 'lock_timeout'
```

### Load Tests

**Tool**: Locust or K6

**Scenario 1: Steady State**:
```python
# 5,000 messages/sec for 10 minutes
# 70% inbound, 30% outbound
# 50% cache hit rate
```

**Scenario 2: Burst Traffic**:
```python
# Normal: 5,000 msg/sec
# Spike: 15,000 msg/sec for 5 minutes
# Return to normal
```

**Scenario 3: New Users**:
```python
# All messages from new wa_ids
# Cache hit rate: 0%
# Every message creates new mapping
```

**Success Criteria**:
- P95 latency < 200ms
- Error rate < 0.1%
- No database connection pool exhaustion
- Queue depth remains < 10,000

---

## Deployment Configuration

### Environment Variables

```bash
# Application
SERVICE_NAME=state-manager
LOG_LEVEL=INFO
CONVERSATION_TTL_HOURS=24
LOCK_TTL_SECONDS=5
LOCK_RETRY_COUNT=3
EXPIRY_JOB_INTERVAL_MINUTES=5

# Database (PostgreSQL)
DB_HOST=postgres.internal
DB_PORT=5432
DB_NAME=xypr_state_mvp
DB_USER=state_manager
DB_PASSWORD=${DB_PASSWORD}  # From secrets manager
DB_MAX_CONNECTIONS=50
DB_CONNECTION_TIMEOUT=5
DB_QUERY_TIMEOUT=30

# Redis
REDIS_HOST=redis.internal
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_POOL_SIZE=20
REDIS_SOCKET_TIMEOUT=0.5
REDIS_SOCKET_CONNECT_TIMEOUT=1

# RabbitMQ
RABBITMQ_HOST=rabbitmq.internal
RABBITMQ_PORT=5672
RABBITMQ_USER=state_manager
RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD}
RABBITMQ_VHOST=/xypr
RABBITMQ_PREFETCH_COUNT=100
RABBITMQ_HEARTBEAT=60

# Queues
INBOUND_QUEUE=inboundQueue
OUTBOUND_QUEUE=outboundQueue
STATUS_QUEUE=statusQueue
DLQ_NAME=state-manager-dlq
INBOUND_ENRICHED_QUEUE=inbound.enriched
OUTBOUND_PROCESSED_QUEUE=outbound-processed

# API
API_PORT=8080
API_KEY=${STATE_MANAGER_API_KEY}

# Observability
METRICS_PORT=9090
PROMETHEUS_ENABLED=true
JAEGER_ENABLED=false  # Optional distributed tracing
```

### Docker Compose (Local Development)

```yaml
version: '3.8'

services:
  state-manager:
    build: .
    ports:
      - "8080:8080"
      - "9090:9090"
    environment:
      - DB_HOST=postgres
      - REDIS_HOST=redis
      - RABBITMQ_HOST=rabbitmq
    depends_on:
      - postgres
      - redis
      - rabbitmq

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: xypr_state_mvp
      POSTGRES_USER: state_manager
      POSTGRES_PASSWORD: devpassword
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: state_manager
      RABBITMQ_DEFAULT_PASS: devpassword

volumes:
  postgres_data:
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: state-manager
spec:
  replicas: 3
  selector:
    matchLabels:
      app: state-manager
  template:
    metadata:
      labels:
        app: state-manager
    spec:
      containers:
      - name: state-manager
        image: xypr/state-manager:latest
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: state-manager-secrets
              key: db-password
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
```

---

## Summary

This State Manager Service is the **transactional core** of the XYPR WhatsApp-to-Genesys middleware. 

### Key Guarantees

✅ **No duplicate conversations**: Database unique constraint + distributed locks  
✅ **Deterministic message routing**: Bidirectional wa_id ↔ conversation_id mappings  
✅ **Complete message lifecycle tracking**: Every message logged with state progression  
✅ **High performance**: Redis caching (< 10ms) with database fallback (< 50ms)  
✅ **Horizontal scalability**: Stateless workers, shared-nothing architecture  
✅ **Fault tolerance**: Graceful degradation on Redis failure, fail-stop on DB failure  
✅ **Idempotency**: All operations can be safely retried  
✅ **Concurrency safety**: Distributed locks + database constraints prevent race conditions  

### MVP Simplifications

- **Single Tenant**: No tenant_id columns required
- **Physical Isolation**: Separate database per tenant (future multi-tenant = different DB)
- **Simplified Queries**: No tenant_id filtering in WHERE clauses
- **Easier Scaling**: Scale entire tenant's infrastructure independently

### Design Principles

1. **Idempotency First**: Every operation is retry-safe
2. **Atomicity**: Database constraints enforce business rules
3. **Observable**: Comprehensive metrics, logs, and tracing
4. **Fail-Fast**: Explicit error handling, clear DLQ routing
5. **Cache-Aside**: Redis enhances performance but isn't required

---

**End of Document**