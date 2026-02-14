# Inbound Message Flow - WhatsApp to Genesys

This diagram shows the complete flow when a customer sends a message via WhatsApp to a Genesys agent.

## High-Level Flow

```mermaid
flowchart TB
    Customer[Customer on WhatsApp] -->|1. Sends Message| Meta[Meta WhatsApp API]
    Meta -->|2. Webhook POST| APIGateway[API Gateway :3000]
    APIGateway -->|3. Route to| WHWebhook[WhatsApp Webhook Service :3009]
    WHWebhook -->|4. Validate Signature| WHWebhook
    WHWebhook -->|5. Store Raw Payload| MinIO[(MinIO Object Storage)]
    WHWebhook -->|6. Queue Message| RabbitMQ[(RabbitMQ)]
    RabbitMQ -->|7. Consume| InboundTransformer[Inbound Transformer :3002]
    InboundTransformer -->|8. Get/Create Mapping| StateManager[State Manager :3005]
    StateManager -->|9. Return conversationId| InboundTransformer
    InboundTransformer -->|10. Transform to Genesys Format| InboundTransformer
    InboundTransformer -->|11. Send Message| GenesysAPI[Genesys API Service :3010]
    GenesysAPI -->|12. Get OAuth Token| AuthService[Auth Service :3004]
    AuthService -->|13. Return Token| GenesysAPI
    GenesysAPI -->|14. POST Message| GenesysCloud[Genesys Cloud API]
    GenesysCloud -->|15. Route to Agent| Agent[Contact Center Agent]

    style Customer fill:#e1f5ff
    style Meta fill:#25D366
    style Agent fill:#ff6b35
    style RabbitMQ fill:#ff6600
    style MinIO fill:#C72E49,color:#fff
    style StateManager fill:#ffd700
    style AuthService fill:#9370db
```

## Detailed Flow with Data Transformation

```mermaid
flowchart TB
    subgraph External["External Systems"]
        Customer[👤 Customer]
        MetaAPI[Meta WhatsApp Business API]
        GenesysCloud[Genesys Cloud Platform]
    end

    subgraph Infrastructure["Infrastructure Layer"]
        Redis[(Redis Cache)]
        RabbitMQ[(RabbitMQ)]
        PostgreSQL[(PostgreSQL)]
        MinIO[(MinIO<br/>Object Storage)]
    end

    subgraph Services["Microservices"]
        APIGateway[API Gateway<br/>:3000]
        WHWebhook[WhatsApp Webhook<br/>:3009]
        InboundTransformer[Inbound Transformer<br/>:3002]
        StateManager[State Manager<br/>:3005]
        AuthService[Auth Service<br/>:3004]
        GenesysAPI[Genesys API Service<br/>:3010]
    end

    Customer -->|"1. Send: 'Hello, I need help'"| MetaAPI
    MetaAPI -->|"2. POST /webhook/meta<br/>{messages: [{from, text, timestamp}]}"| APIGateway
    APIGateway -->|"3. Route /webhook/meta"| WHWebhook

    WHWebhook -->|"4a. Validate X-Hub-Signature-256"| WHWebhook
    WHWebhook -->|"4b. Check tenant by phone_number_id"| Redis
    WHWebhook -->|"4c. Store raw webhook payload<br/>Bucket: webhooks-inbound<br/>Key: {tenantId}/{timestamp}/{messageId}.json"| MinIO
    WHWebhook -->|"4d. Publish to<br/>INBOUND_WHATSAPP_MESSAGES"| RabbitMQ

    RabbitMQ -->|"5. Consume message"| InboundTransformer

    InboundTransformer -->|"6a. Check mapping<br/>GET /state/mapping/:waId"| StateManager
    StateManager -->|"6b. Check Redis cache<br/>Key: mapping:wa:{waId}"| Redis
    Redis -->|"Cache hit"| StateManager
    StateManager -->|"6c. Query PostgreSQL if cache miss<br/>SELECT * FROM conversation_mappings"| PostgreSQL
    PostgreSQL -->|"Return mapping"| StateManager
    StateManager -->|"6d. Cache in Redis (TTL: 3600s)"| Redis
    StateManager -->|"6e. UPDATE PostgreSQL<br/>last_activity_at = NOW()"| PostgreSQL
    StateManager -->|"6f. Return {conversationId, tenantId}"| InboundTransformer

    InboundTransformer -->|"7a. Check if message has media"| InboundTransformer
    InboundTransformer -->|"7b. If media: Fetch URL from MinIO<br/>GET /media/{tenantId}/{mediaId}"| MinIO
    MinIO -->|"Return signed URL"| InboundTransformer
    InboundTransformer -->|"7c. Transform message<br/>Meta JSON → Genesys Open Messaging<br/>Append media URL if present"| InboundTransformer

    InboundTransformer -->|"8. POST /genesys/messages/inbound"| GenesysAPI

    GenesysAPI -->|"9a. Check Redis for token<br/>Key: tenant:{tenantId}:oauth:token"| Redis
    Redis -->|"Token cached & valid"| GenesysAPI
    GenesysAPI -->|"9b. If no cache: Get token from Auth Service"| AuthService
    AuthService -->|"9c. Check cache"| Redis
    AuthService -->|"9d. Get credentials if needed"| PostgreSQL
    AuthService -->|"9e. Cache token in Redis"| Redis
    AuthService -->|"9f. Return Bearer token"| GenesysAPI

    GenesysAPI -->|"10. POST /api/v2/conversations/messages/\n{integrationId}/inbound/open/message<br/>Authorization: Bearer {token}"| GenesysCloud

    GenesysCloud -->|"11. Route to agent queue"| Agent[👨‍💼 Agent]

    GenesysCloud -.->|"12. Send delivery receipt"| WHWebhook
    WHWebhook -.->|"13. Update message status"| StateManager
    StateManager -.->|"14. Store in DB"| PostgreSQL

    style Customer fill:#e1f5ff
    style MetaAPI fill:#25D366,color:#fff
    style Agent fill:#ff6b35,color:#fff
    style RabbitMQ fill:#ff6600,color:#fff
    style Redis fill:#dc382d,color:#fff
    style PostgreSQL fill:#336791,color:#fff
    style MinIO fill:#C72E49,color:#fff
    style StateManager fill:#ffd700
    style AuthService fill:#9370db,color:#fff
```

## Sequence Diagram with Timing

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant M as Meta API
    participant AG as API Gateway
    participant WH as WhatsApp Webhook
    participant MinIO as MinIO
    participant RMQ as RabbitMQ
    participant IT as Inbound Transformer
    participant SM as State Manager
    participant R as Redis
    participant DB as PostgreSQL
    participant AS as Auth Service
    participant GA as Genesys API
    participant GC as Genesys Cloud
    participant A as Agent

    C->>M: Send WhatsApp message<br/>"Hello, I need help"

    Note over M: Meta processes message

    M->>AG: POST /webhook/meta<br/>{"messages": [{"from": "+919876543210", "text": {...}}]}
    AG->>WH: Route to webhook service

    WH->>WH: Validate signature<br/>(X-Hub-Signature-256)

    WH->>R: Get tenant by phone_number_id
    R-->>WH: {tenant_id, config}

    WH->>MinIO: PUT /webhooks-inbound/<br/>{tenantId}/{timestamp}/{messageId}.json<br/>Store raw webhook payload
    MinIO-->>WH: 200 OK (stored)

    WH->>RMQ: Publish to queue<br/>INBOUND_WHATSAPP_MESSAGES
    WH-->>AG: 200 OK
    AG-->>M: 200 OK (ACK)

    Note over RMQ,IT: Async Processing Begins

    RMQ->>IT: Consume message from queue

    IT->>SM: GET /state/mapping/:waId<br/>waId: +919876543210

    Note over SM: State Manager checks Redis first

    SM->>R: Check Redis cache:<br/>Key: mapping:wa:+919876543210

    alt Mapping exists in cache
        R-->>SM: {conversationId, tenantId}
    else No cache hit
        SM->>DB: SELECT * FROM conversation_mappings<br/>WHERE wa_id = '+919876543210'
        DB-->>SM: {conversation_id, tenant_id}
        SM->>R: SET mapping:wa:+919876543210<br/>TTL: 3600s
        SM->>DB: UPDATE conversation_mappings<br/>SET last_activity_at = NOW()
    end

    SM-->>IT: {conversationId: "abc-123", tenantId: "tenant-001"}

    Note over IT: Check for Media Attachments

    alt Message has media (image/video/document)
        IT->>MinIO: GET /media/{tenantId}/{mediaId}<br/>Fetch media URL
        MinIO-->>IT: Signed URL (expires in 1 hour)
        Note over IT: Transform with media URL
    else Text-only message
        Note over IT: Transform text only
    end

    IT->>IT: Build Genesys payload:<br/>{channel, direction, type, text,<br/>attachments: [mediaUrl], metadata}

    IT->>GA: POST /genesys/messages/inbound<br/>{conversationId, message, tenantId}

    Note over GA: Genesys API checks Redis for auth token

    GA->>R: Check Redis:<br/>Key: tenant:tenant-001:oauth:token

    alt Token in cache & valid (expires_at > now + 300s)
        R-->>GA: {accessToken, expiresAt}
        Note over GA: Use cached token
    else Token expired or not cached
        GA->>AS: GET /auth/token<br/>Header: X-Tenant-ID: tenant-001
        AS->>R: Check cache:<br/>tenant:tenant-001:oauth:token

        alt Auth service cache hit
            R-->>AS: {accessToken, expiresAt}
        else Auth service cache miss
            AS->>DB: SELECT * FROM tenant_credentials<br/>WHERE tenant_id = 'tenant-001'
            DB-->>AS: {clientId, clientSecret, region}
            AS->>GC: POST /oauth/token<br/>grant_type=client_credentials
            GC-->>AS: {access_token, expires_in: 3600}
            AS->>R: SET tenant:tenant-001:oauth:token<br/>TTL: expires_in - 300s
        end

        AS-->>GA: {token: "eyJhbG..."}
        GA->>R: Cache token locally<br/>TTL: expires_in - 300s
    end

    GA->>GC: POST /api/v2/conversations/messages/<br/>{integrationId}/inbound/open/message<br/>Authorization: Bearer eyJhbG...

    Note over GC: Genesys processes message<br/>Routes to agent queue

    GC-->>GA: 200 OK {messageId}
    GA-->>IT: Success

    IT->>SM: POST /state/message<br/>Track message delivery
    SM->>DB: INSERT INTO message_tracking

    GC->>A: Deliver message to agent<br/>"Hello, I need help"

    Note over A: Agent sees message<br/>in Genesys interface

    GC->>WH: POST /webhook/genesys<br/>delivery receipt
    WH->>SM: Update message status: delivered
    SM->>DB: UPDATE message_tracking<br/>SET status = 'delivered'
```

## Data Transformation Detail

```mermaid
flowchart LR
    subgraph Input["Meta WhatsApp Format"]
        MetaMsg["<b>Meta Message</b><br/>{<br/>  object: 'whatsapp_business_account',<br/>  entry: [{<br/>    changes: [{<br/>      value: {<br/>        messages: [{<br/>          from: '+919876543210',<br/>          id: 'wamid.ABC123',<br/>          timestamp: '1704067200',<br/>          type: 'text',<br/>          text: {<br/>            body: 'Hello, I need help'<br/>          }<br/>        }],<br/>        metadata: {<br/>          phone_number_id: '123456789'<br/>        }<br/>      }<br/>    }]<br/>  }]<br/>}"]
    end

    subgraph Transform["Inbound Transformer"]
        Extract[Extract Fields]
        Enrich[Enrich with State]
        Build[Build Genesys Payload]

        Extract --> Enrich --> Build
    end

    subgraph Output["Genesys Open Messaging Format"]
        GenesysMsg["<b>Genesys Message</b><br/>{<br/>  channel: {<br/>    platform: 'Open',<br/>    type: 'Private',<br/>    messageId: 'wamid.ABC123',<br/>    to: {<br/>      id: 'abc-123'<br/>    },<br/>    from: {<br/>      idType: 'PhoneNumber',<br/>      id: '+919876543210',<br/>      firstName: 'Customer',<br/>      lastName: 'Name'<br/>    },<br/>    time: '2024-01-01T00:00:00.000Z'<br/>  },<br/>  type: 'Text',<br/>  text: 'Hello, I need help',<br/>  direction: 'Inbound',<br/>  metadata: {<br/>    tenantId: 'tenant-001',<br/>    source: 'whatsapp'<br/>  }<br/>}"]
    end

    MetaMsg --> Extract
    Build --> GenesysMsg

    style MetaMsg fill:#25D366,color:#fff
    style GenesysMsg fill:#ff6b35,color:#fff
    style Transform fill:#f0f0f0
```

## State Manager Mapping Logic

```mermaid
flowchart TD
    Start([Receive wa_id<br/>+919876543210]) --> CheckCache{Check Redis<br/>Key: mapping:wa:+919876543210}

    CheckCache -->|Found in cache| ValidateCache{Is mapping<br/>still valid?<br/>TTL > 0}
    ValidateCache -->|Yes| UpdateActivity1[UPDATE PostgreSQL<br/>last_activity_at = NOW()]
    UpdateActivity1 --> ReturnCached[Return cached<br/>conversationId]
    ValidateCache -->|Expired| QueryDB

    CheckCache -->|Not Found| QueryDB[Query PostgreSQL<br/>SELECT * FROM conversation_mappings<br/>WHERE wa_id = '+919876543210']

    QueryDB --> ExistsDB{Mapping<br/>exists in DB?}

    ExistsDB -->|Yes| UpdateActivity2[UPDATE PostgreSQL<br/>last_activity_at = NOW()]
    UpdateActivity2 --> CacheMapping[SET Redis cache<br/>Key: mapping:wa:+919876543210<br/>Value: conversationId<br/>TTL: 3600s]
    CacheMapping --> CacheBidirectional[SET Redis cache<br/>Key: mapping:conv:conversationId<br/>Value: wa_id<br/>TTL: 3600s]
    CacheBidirectional --> ReturnDB[Return conversationId]

    ExistsDB -->|No| CreateNew[Create new mapping]
    CreateNew --> GenID[Generate new<br/>conversationId<br/>uuid.v4()]
    GenID --> InsertDB[INSERT INTO conversation_mappings<br/>wa_id, conversation_id, tenant_id,<br/>created_at, last_activity_at]
    InsertDB --> CacheNew[Cache in Redis<br/>Both directions<br/>TTL: 3600s]
    CacheNew --> ReturnNew[Return new<br/>conversationId]

    ReturnCached --> End([conversationId<br/>abc-123])
    ReturnDB --> End
    ReturnNew --> End

    style Start fill:#e1f5ff
    style End fill:#90EE90
    style CreateNew fill:#FFD700
    style CheckCache fill:#DDA0DD
    style QueryDB fill:#87CEEB
    style UpdateActivity1 fill:#FFA07A
    style UpdateActivity2 fill:#FFA07A
    style InsertDB fill:#98FB98
```

## State Manager Database Operations

### PostgreSQL Schema
```sql
CREATE TABLE conversation_mappings (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    wa_id VARCHAR(50) NOT NULL,
    conversation_id UUID NOT NULL,
    contact_name VARCHAR(255),
    phone_number_id VARCHAR(50),
    display_phone_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, wa_id),
    INDEX idx_wa_id (wa_id),
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_tenant_id (tenant_id)
);
```

### State Manager Operations

**1. Check Mapping (GET /state/mapping/:waId)**
```sql
-- Check Redis first
GET mapping:wa:+919876543210

-- If cache miss, query PostgreSQL
SELECT conversation_id, tenant_id, contact_name
FROM conversation_mappings
WHERE wa_id = '+919876543210'
AND tenant_id = 'tenant-001';

-- Update last activity
UPDATE conversation_mappings
SET last_activity_at = NOW()
WHERE wa_id = '+919876543210';

-- Cache result in Redis
SET mapping:wa:+919876543210 '{"conversationId":"abc-123","tenantId":"tenant-001"}' EX 3600
SET mapping:conv:abc-123 '{"waId":"+919876543210","tenantId":"tenant-001"}' EX 3600
```

**2. Create Mapping (POST /state/mapping)**
```sql
INSERT INTO conversation_mappings (
    tenant_id, wa_id, conversation_id, contact_name,
    phone_number_id, display_phone_number
) VALUES (
    'tenant-001', '+919876543210', 'abc-123', 'John Doe',
    '123456789', '+1234567890'
) ON CONFLICT (tenant_id, wa_id)
DO UPDATE SET last_activity_at = NOW()
RETURNING *;
```

**3. Track Message (POST /state/message)**
```sql
INSERT INTO message_tracking (
    message_id, conversation_id, tenant_id, direction,
    status, created_at
) VALUES (
    'wamid.ABC123', 'abc-123', 'tenant-001', 'inbound',
    'received', NOW()
);
```

## Error Handling Flow

```mermaid
flowchart TD
    Start([Message Received]) --> Validate{Validate<br/>Signature}

    Validate -->|Invalid| Reject[Return 401<br/>Unauthorized]
    Validate -->|Valid| CheckTenant{Tenant<br/>Active?}

    CheckTenant -->|No| RejectTenant[Return 403<br/>Tenant Inactive]
    CheckTenant -->|Yes| StoreMinIO[Store to MinIO]

    StoreMinIO -->|Success| Queue[Queue to RabbitMQ]
    StoreMinIO -->|Failure| MinIORetry{Retry<br/>MinIO?}

    MinIORetry -->|Yes, < 3 attempts| StoreMinIO
    MinIORetry -->|No| LogMinIOError[Log MinIO Error<br/>Continue anyway]
    LogMinIOError --> Queue

    Queue -->|Success| ACK[Return 200 OK<br/>to Meta]
    Queue -->|Failure| Retry{Retry<br/>Queue?}

    Retry -->|Yes, < 3 attempts| Queue
    Retry -->|No, exhausted| DLQ[Send to Dead Letter Queue]
    DLQ --> Alert[Alert Monitoring]

    ACK --> Process[Inbound Transformer<br/>Processes]

    Process --> Transform{Transform<br/>Success?}

    Transform -->|No| ErrorLog[Log Error]
    ErrorLog --> ErrorQueue[Publish to<br/>ERROR_EVENTS queue]

    Transform -->|Yes| GetMapping{Get Mapping<br/>Success?}

    GetMapping -->|No| CreateMapping[Create New Mapping]
    CreateMapping --> SendGenesys
    GetMapping -->|Yes| SendGenesys[Send to Genesys API]

    SendGenesys --> GenesysResponse{Genesys<br/>Success?}

    GenesysResponse -->|No| RetryGenesys{Retry?}
    RetryGenesys -->|Yes| SendGenesys
    RetryGenesys -->|No| FailLog[Log Failure<br/>Track in DB]

    GenesysResponse -->|Yes| Success[Message Delivered<br/>Track Success]

    style Reject fill:#ff6b6b
    style RejectTenant fill:#ff6b6b
    style DLQ fill:#ffa500
    style Alert fill:#ff0000,color:#fff
    style Success fill:#90EE90
    style ACK fill:#90EE90
    style StoreMinIO fill:#C72E49,color:#fff
```

## Redis Token Caching Strategy

```mermaid
flowchart TB
    subgraph Services["Services Requiring Auth Tokens"]
        WA[WhatsApp API Service<br/>:3008]
        GA[Genesys API Service<br/>:3010]
        SM[State Manager<br/>:3005]
    end

    subgraph Cache["Redis Token Cache"]
        TokenKeys["Token Cache Keys:<br/><br/>tenant:{tenantId}:oauth:token<br/>└─ Genesys OAuth tokens<br/><br/>tenant:{tenantId}:whatsapp:token<br/>└─ WhatsApp API tokens<br/><br/>TTL: expires_in - 300s (5min buffer)"]
    end

    subgraph Flow["Token Retrieval Flow"]
        Check{Check Redis<br/>for token}
        Valid{Token valid?<br/>expires_at > now + 300s}
        UseCache[Use cached token]
        FetchNew[Fetch new token<br/>from Auth Service]
        CacheNew[Cache in Redis<br/>with TTL]

        Check -->|Found| Valid
        Check -->|Not found| FetchNew
        Valid -->|Yes| UseCache
        Valid -->|No| FetchNew
        FetchNew --> CacheNew
    end

    WA -->|1. Check token| Check
    GA -->|1. Check token| Check
    SM -->|1. Check token| Check

    UseCache --> WA
    UseCache --> GA
    UseCache --> SM

    CacheNew --> TokenKeys

    style TokenKeys fill:#dc382d,color:#fff
    style UseCache fill:#90EE90
    style Check fill:#DDA0DD
    style CacheNew fill:#FFA07A
```

## Service-Specific Token Usage

### 1. Genesys API Service (:3010)

```mermaid
sequenceDiagram
    participant GA as Genesys API Service
    participant R as Redis
    participant AS as Auth Service
    participant GC as Genesys Cloud

    GA->>R: GET tenant:{tenantId}:oauth:token

    alt Token in cache & valid
        R-->>GA: {accessToken, expiresAt}
        Note over GA: Use cached token
    else Cache miss or expired
        GA->>AS: GET /auth/token
        AS->>R: Check own cache
        alt Auth service has token
            R-->>AS: {accessToken, expiresAt}
        else Auth service needs new token
            AS->>GC: POST /oauth/token<br/>grant_type=client_credentials
            GC-->>AS: {access_token, expires_in}
            AS->>R: SET token (TTL: 3300s)
        end
        AS-->>GA: {token}
        GA->>R: Cache locally (TTL: 3300s)
    end

    GA->>GC: API call with Bearer token
```

### 2. WhatsApp API Service (:3008)

```mermaid
sequenceDiagram
    participant WA as WhatsApp API Service
    participant R as Redis
    participant DB as PostgreSQL
    participant Meta as Meta WhatsApp API

    WA->>R: GET tenant:{tenantId}:whatsapp:token

    alt Token in cache
        R-->>WA: {accessToken, phoneNumberId}
        Note over WA: Use cached token
    else Cache miss
        WA->>DB: SELECT whatsapp_config<br/>FROM tenant_credentials
        DB-->>WA: {accessToken, phoneNumberId}
        WA->>R: SET whatsapp:token<br/>TTL: 86400s (24 hours)
    end

    WA->>Meta: POST /messages<br/>Authorization: Bearer {token}
```

### 3. State Manager (:3005)

```mermaid
sequenceDiagram
    participant SM as State Manager
    participant R as Redis
    participant DB as PostgreSQL

    Note over SM: State Manager uses Redis for:<br/>1. Conversation mappings<br/>2. Tenant config cache<br/>3. Rate limiting

    SM->>R: GET tenant:{tenantId}:config

    alt Config in cache
        R-->>SM: {config}
    else Cache miss
        SM->>DB: SELECT * FROM tenants<br/>WHERE tenant_id = ?
        DB-->>SM: {tenant config}
        SM->>R: SET tenant:config<br/>TTL: 3600s
    end

    SM->>R: GET mapping:wa:{waId}

    alt Mapping cached
        R-->>SM: {conversationId}
    else Not cached
        SM->>DB: SELECT conversation_id<br/>FROM conversation_mappings
        DB-->>SM: {conversationId}
        SM->>R: SET mapping<br/>TTL: 3600s
    end
```

## Redis Cache Keys Reference

| Service | Cache Key | TTL | Purpose |
|---------|-----------|-----|---------|
| Genesys API | `tenant:{tenantId}:oauth:token` | expires_in - 300s | Genesys OAuth access token |
| WhatsApp API | `tenant:{tenantId}:whatsapp:token` | 86400s (24h) | WhatsApp API access token |
| State Manager | `mapping:wa:{waId}` | 3600s (1h) | WhatsApp ID → Conversation ID |
| State Manager | `mapping:conv:{conversationId}` | 3600s (1h) | Conversation ID → WhatsApp ID |
| State Manager | `tenant:{tenantId}:config` | 3600s (1h) | Tenant configuration |
| All Services | `ratelimit:{tenantId}:{minute}` | 60s | Rate limiting counter |

## Media Handling with MinIO

```mermaid
flowchart TB
    subgraph Inbound["Inbound Message with Media"]
        MetaWebhook[Meta Webhook<br/>Contains media_id]
        Download[Download media from Meta<br/>GET /{version}/{media_id}]
        StoreMedia[Store to MinIO<br/>Bucket: media-inbound<br/>Key: {tenantId}/{mediaId}.{ext}]
        GenerateURL[Generate signed URL<br/>Expires: 1 hour]
    end

    subgraph Transform["Message Transformation"]
        CheckMedia{Message<br/>has media?}
        FetchURL[Fetch signed URL<br/>from MinIO]
        BuildPayload[Build Genesys payload<br/>with media URL]
    end

    subgraph Delivery["Deliver to Genesys"]
        SendGenesys[POST to Genesys<br/>with attachment URL]
        GenesysDownload[Genesys downloads<br/>from signed URL]
    end

    MetaWebhook --> Download
    Download --> StoreMedia
    StoreMedia --> GenerateURL
    GenerateURL --> CheckMedia

    CheckMedia -->|Yes| FetchURL
    CheckMedia -->|No| BuildPayload
    FetchURL --> BuildPayload
    BuildPayload --> SendGenesys
    SendGenesys --> GenesysDownload

    style StoreMedia fill:#C72E49,color:#fff
    style FetchURL fill:#C72E49,color:#fff
    style GenerateURL fill:#FFD700
```

## Media Storage Structure

### MinIO Buckets
```
media-inbound/              # Incoming media from WhatsApp
├── tenant-001/
│   ├── images/
│   │   ├── 2024-01-29/
│   │   │   ├── wamid.ABC123.jpg
│   │   │   └── wamid.ABC124.png
│   ├── videos/
│   │   └── 2024-01-29/
│   │       └── wamid.ABC125.mp4
│   └── documents/
│       └── 2024-01-29/
│           └── wamid.ABC126.pdf
└── tenant-002/
    └── ...

media-outbound/             # Outgoing media to WhatsApp
├── tenant-001/
│   └── ...
```

### Media Flow Details

**1. WhatsApp → System (Inbound)**
```javascript
// Webhook receives media_id
{
  "type": "image",
  "image": {
    "id": "wamid.ABC123",
    "mime_type": "image/jpeg",
    "sha256": "..."
  }
}

// Download from Meta
GET https://graph.facebook.com/v18.0/wamid.ABC123
Authorization: Bearer {whatsapp_token}

// Store to MinIO
PUT /media-inbound/{tenantId}/images/2024-01-29/wamid.ABC123.jpg
Content-Type: image/jpeg

// Generate signed URL (1 hour expiry)
presignedUrl = minioClient.presignedGetObject(
  'media-inbound',
  '{tenantId}/images/2024-01-29/wamid.ABC123.jpg',
  3600
)

// Include in Genesys payload
{
  "type": "Structured",
  "content": [{
    "contentType": "Attachment",
    "attachment": {
      "mediaType": "image/jpeg",
      "url": presignedUrl
    }
  }]
}
```

**2. System → WhatsApp (Outbound)**
```javascript
// Store media to MinIO first
PUT /media-outbound/{tenantId}/images/{uuid}.jpg

// Get public URL
const mediaUrl = minioClient.presignedGetObject(
  'media-outbound',
  '{tenantId}/images/{uuid}.jpg',
  86400  // 24 hours
)

// Send to WhatsApp
POST https://graph.facebook.com/v18.0/{phone_number_id}/messages
{
  "type": "image",
  "image": {
    "link": mediaUrl
  }
}
```

## MinIO Storage Pattern

```mermaid
flowchart TB
    subgraph Webhook["WhatsApp Webhook Service"]
        Receive[Receive Webhook<br/>from Meta]
        Validate[Validate Signature]
        ExtractMeta[Extract Metadata:<br/>- tenant_id<br/>- message_id<br/>- timestamp]
        BuildKey[Build MinIO Key:<br/>{tenantId}/{date}/{timestamp}-{messageId}.json]
        Store[Store to MinIO]
    end

    subgraph MinIO["MinIO Object Storage"]
        Bucket[Bucket: webhooks-inbound]
        Objects[Objects Structure:<br/>├─ tenant-001/<br/>│  ├─ 2024-01-29/<br/>│  │  ├─ 1706534400-wamid.ABC123.json<br/>│  │  ├─ 1706534401-wamid.ABC124.json<br/>│  │  └─ ...<br/>│  └─ 2024-01-30/<br/>├─ tenant-002/<br/>└─ ...]
    end

    subgraph Benefits["Storage Benefits"]
        Audit[📋 Audit Trail<br/>Complete history of<br/>all incoming webhooks]
        Replay[🔄 Replay Capability<br/>Re-process messages<br/>if needed]
        Debug[🐛 Debugging<br/>Troubleshoot issues<br/>with raw data]
        Compliance[✓ Compliance<br/>Meet data retention<br/>requirements]
        Analytics[📊 Analytics<br/>Historical analysis<br/>and reporting]
    end

    Receive --> Validate --> ExtractMeta --> BuildKey --> Store
    Store --> Bucket
    Bucket --> Objects
    Objects --> Audit
    Objects --> Replay
    Objects --> Debug
    Objects --> Compliance
    Objects --> Analytics

    style Bucket fill:#C72E49,color:#fff
    style Store fill:#C72E49,color:#fff
    style Objects fill:#f0f0f0
    style Audit fill:#90EE90
    style Replay fill:#90EE90
    style Debug fill:#90EE90
    style Compliance fill:#90EE90
    style Analytics fill:#90EE90
```

## MinIO Storage Details

### Object Metadata
Each stored webhook includes:

```json
{
  "object": "whatsapp_business_account",
  "entry": [...],
  "metadata": {
    "stored_at": "2024-01-29T10:30:00.000Z",
    "tenant_id": "tenant-001",
    "webhook_signature": "sha256=...",
    "source_ip": "31.13.84.51",
    "user_agent": "WhatsApp/1.0"
  }
}
```

### Bucket Lifecycle Policy
- **Transition to Cold Storage:** After 7 days
- **Delete:** After 30 days (configurable)
- **Versioning:** Enabled (for accidental deletion recovery)

### Access Patterns
1. **Write:** Webhook service stores immediately after validation
2. **Read (Replay):** Admin dashboard or CLI tools can fetch and replay
3. **Read (Debug):** Support team retrieves for troubleshooting
4. **Bulk Read:** Analytics jobs for reporting

## Complete Data Flow Architecture

```mermaid
flowchart TB
    subgraph External["External Systems"]
        Customer[👤 Customer]
        MetaAPI[Meta WhatsApp API]
        GenesysCloud[Genesys Cloud]
    end

    subgraph Services["Microservices Layer"]
        WHWebhook[WhatsApp Webhook :3009]
        InboundTrans[Inbound Transformer :3002]
        StateManager[State Manager :3005]
        GenesysAPI[Genesys API :3010]
        AuthService[Auth Service :3004]
    end

    subgraph Storage["Data Storage Layer"]
        direction TB

        subgraph Redis["Redis Cache 🔴"]
            RedisTokens["Token Cache<br/>• Genesys OAuth<br/>• WhatsApp tokens<br/>TTL: 3300s"]
            RedisMappings["Mapping Cache<br/>• wa_id → conv_id<br/>• conv_id → wa_id<br/>TTL: 3600s"]
            RedisConfig["Config Cache<br/>• Tenant settings<br/>TTL: 3600s"]
        end

        subgraph PostgreSQL["PostgreSQL Database 🟦"]
            DBMappings["conversation_mappings<br/>• wa_id<br/>• conversation_id<br/>• last_activity_at<br/><br/>Operations:<br/>✓ SELECT (read)<br/>✓ INSERT (create)<br/>✓ UPDATE (activity)"]
            DBMessages["message_tracking<br/>• message_id<br/>• status<br/>• timestamps<br/><br/>Operations:<br/>✓ INSERT (track)<br/>✓ UPDATE (status)"]
            DBCreds["tenant_credentials<br/>• OAuth credentials<br/>• API tokens<br/><br/>Operations:<br/>✓ SELECT (read)"]
        end

        subgraph MinIO["MinIO Object Storage 🟥"]
            MinIOWebhooks["webhooks-inbound/<br/>Raw webhook payloads<br/><br/>Operations:<br/>✓ PUT (store)<br/>✓ GET (replay)"]
            MinIOMediaIn["media-inbound/<br/>Downloaded media<br/><br/>Operations:<br/>✓ PUT (store)<br/>✓ GET (signed URL)"]
        end
    end

    Customer -->|"1. Send message"| MetaAPI
    MetaAPI -->|"2. Webhook POST"| WHWebhook

    WHWebhook -->|"3. Store raw payload"| MinIOWebhooks
    WHWebhook -->|"4. Check tenant config"| RedisConfig
    WHWebhook -->|"5. Queue message"| InboundTrans

    InboundTrans -->|"6a. Check mapping"| RedisMappings
    InboundTrans -->|"6b. If cache miss"| StateManager

    StateManager -->|"7a. Query mappings"| DBMappings
    StateManager -->|"7b. Update activity"| DBMappings
    StateManager -->|"7c. Cache result"| RedisMappings

    InboundTrans -->|"8a. If media present"| MinIOMediaIn
    InboundTrans -->|"8b. Send message"| GenesysAPI

    GenesysAPI -->|"9a. Check token"| RedisTokens
    GenesysAPI -->|"9b. If cache miss"| AuthService

    AuthService -->|"10a. Check cache"| RedisTokens
    AuthService -->|"10b. Get credentials"| DBCreds
    AuthService -->|"10c. Cache token"| RedisTokens

    GenesysAPI -->|"11. POST message"| GenesysCloud
    GenesysCloud -->|"12. Deliver"| Customer

    InboundTrans -->|"13. Track message"| DBMessages

    style RedisTokens fill:#dc382d,color:#fff
    style RedisMappings fill:#dc382d,color:#fff
    style RedisConfig fill:#dc382d,color:#fff
    style DBMappings fill:#336791,color:#fff
    style DBMessages fill:#336791,color:#fff
    style DBCreds fill:#336791,color:#fff
    style MinIOWebhooks fill:#C72E49,color:#fff
    style MinIOMediaIn fill:#C72E49,color:#fff
```

## Data Access Patterns Summary

### 1. Token Management (Redis First)
```
┌─────────────────────────────────────────┐
│ Service needs auth token                │
└────────────┬────────────────────────────┘
             │
             ▼
      ┌──────────────┐
      │ Check Redis  │ ← Key: tenant:{id}:oauth:token
      └──────┬───────┘
             │
        ┌────┴────┐
        │         │
     Found     Not Found
        │         │
        ▼         ▼
   Use Cache  Query Auth Service
        │         │
        │         ├─→ Check PostgreSQL
        │         ├─→ Request from OAuth provider
        │         └─→ Cache in Redis (TTL: 3300s)
        │         │
        └────┬────┘
             │
             ▼
        Use Token
```

### 2. Conversation Mapping (Redis + PostgreSQL)
```
┌─────────────────────────────────────────┐
│ Need conversationId for wa_id           │
└────────────┬────────────────────────────┘
             │
             ▼
      ┌──────────────┐
      │ Check Redis  │ ← Key: mapping:wa:{waId}
      └──────┬───────┘
             │
        ┌────┴────┐
        │         │
     Found     Not Found
        │         │
        ▼         ▼
   Return    Query PostgreSQL
    Value    (SELECT from conversation_mappings)
        │         │
        │         ├─→ UPDATE last_activity_at
        │         └─→ Cache in Redis (TTL: 3600s)
        │         │
        └────┬────┘
             │
             ▼
    Return conversationId
```

### 3. Media Handling (MinIO)
```
┌─────────────────────────────────────────┐
│ Message contains media (image/video)    │
└────────────┬────────────────────────────┘
             │
             ▼
      ┌──────────────┐
      │ Download from│
      │  Meta API    │
      └──────┬───────┘
             │
             ▼
      ┌──────────────┐
      │ Store to     │ ← Bucket: media-inbound
      │   MinIO      │   Key: {tenant}/{date}/{id}.ext
      └──────┬───────┘
             │
             ▼
      ┌──────────────┐
      │ Generate     │
      │ Signed URL   │ ← Expires: 1 hour
      └──────┬───────┘
             │
             ▼
      ┌──────────────┐
      │ Append URL   │
      │ to Genesys   │
      │  payload     │
      └──────────────┘
```

## Performance Metrics

```mermaid
flowchart LR
    subgraph Latency["Expected Latency"]
        L1["Webhook Receipt<br/>< 100ms"]
        L2["Queue Publish<br/>< 50ms"]
        L3["Transform<br/>< 200ms"]
        L4["State Lookup<br/>< 100ms (cached)<br/>< 500ms (DB)"]
        L5["Genesys API Call<br/>< 1000ms"]
        L6["Total End-to-End<br/>< 2 seconds"]
    end

    subgraph Throughput["Throughput"]
        T1["Webhook: 1000 req/s"]
        T2["Transformer: 500 msg/s"]
        T3["State Manager: 2000 req/s"]
    end

    style L6 fill:#90EE90
```

---

## Key Components

### Services Involved
1. **API Gateway (3000)** - Entry point and routing
2. **WhatsApp Webhook Service (3009)** - Receives Meta webhooks
3. **Inbound Transformer (3002)** - Message format conversion
4. **State Manager (3005)** - Conversation mapping
5. **Auth Service (3004)** - OAuth token management
6. **Genesys API Service (3010)** - Sends to Genesys Cloud

### Message Queue
- **Queue:** `INBOUND_WHATSAPP_MESSAGES`
- **Purpose:** Decouple webhook from transformation
- **Benefits:** Async processing, retry logic, scalability

### Data Stores

#### Redis Cache
Used by: All services
- **Token Cache:**
  - `tenant:{tenantId}:oauth:token` - Genesys OAuth tokens (TTL: ~3300s)
  - `tenant:{tenantId}:whatsapp:token` - WhatsApp API tokens (TTL: 24h)
- **Conversation Mappings:**
  - `mapping:wa:{waId}` - WhatsApp ID → Conversation ID (TTL: 3600s)
  - `mapping:conv:{conversationId}` - Conversation ID → WhatsApp ID (TTL: 3600s)
- **Tenant Config:**
  - `tenant:{tenantId}:config` - Tenant configuration cache (TTL: 3600s)
- **Rate Limiting:**
  - `ratelimit:{tenantId}:{minute}` - Per-tenant rate limit counters (TTL: 60s)

#### PostgreSQL Database
Used by: State Manager, Auth Service, Tenant Service

**Tables:**
1. **conversation_mappings**
   - Stores wa_id ↔ conversationId mappings
   - Tracks last_activity_at for active conversations
   - Indexed on wa_id, conversation_id, tenant_id

2. **message_tracking**
   - Tracks all messages (inbound/outbound)
   - Stores message status (received, delivered, read, failed)
   - Links meta_message_id ↔ genesys_message_id

3. **tenant_credentials**
   - Stores Genesys and WhatsApp credentials per tenant
   - JSONB format for flexible credential storage

**Operations:**
- **State Manager queries PostgreSQL** for conversation mappings (cache miss)
- **State Manager updates PostgreSQL** on every message activity (last_activity_at)
- **State Manager inserts into PostgreSQL** for new conversation creation
- **Auth Service queries PostgreSQL** for tenant credentials
- **Message tracking inserts** for audit trail

#### MinIO Object Storage
Used by: WhatsApp Webhook, Inbound Transformer, Outbound Transformer

**Buckets:**

1. **webhooks-inbound**
   - **Key Pattern:** `{tenantId}/{yyyy-MM-dd}/{timestamp}-{messageId}.json`
   - **Content:** Complete raw webhook payload from Meta
   - **Purpose:**
     - Audit trail and compliance
     - Replay capability for debugging
     - Data recovery if processing fails
     - Analytics and troubleshooting
   - **Retention:** 30 days (configurable)
   - **Lifecycle:** Transition to cold storage after 7 days

2. **media-inbound**
   - **Key Pattern:** `{tenantId}/{mediaType}/{yyyy-MM-dd}/{messageId}.{ext}`
   - **Content:** Media files from WhatsApp (images, videos, documents, audio)
   - **Purpose:**
     - Store downloaded media from Meta
     - Generate signed URLs for Genesys access
     - Media archival
   - **Retention:** 90 days (compliance)
   - **Access:** Signed URLs with 1-hour expiry

3. **media-outbound**
   - **Key Pattern:** `{tenantId}/{mediaType}/{yyyy-MM-dd}/{uuid}.{ext}`
   - **Content:** Media files to be sent via WhatsApp
   - **Purpose:**
     - Store media before sending to Meta
     - Generate public URLs for Meta access
   - **Retention:** 30 days
   - **Access:** Signed URLs with 24-hour expiry

### External APIs
- **Meta WhatsApp API:** Source of inbound messages
- **Genesys Cloud API:** Destination for transformed messages
