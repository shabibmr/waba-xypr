# Outbound Message Flow - Complete Sequence Diagram

This document contains detailed sequence diagrams for the outbound message flow from Genesys to WhatsApp, including all storage operations, caching strategies, and media handling.

## Complete Flow - Text Message

```mermaid
sequenceDiagram
    autonumber
    participant A as 👨‍💼 Agent
    participant GC as Genesys Cloud
    participant AG as API Gateway
    participant GW as Genesys Webhook
    participant MinIO as MinIO Storage
    participant RMQ as RabbitMQ
    participant OT as Outbound Transformer
    participant SM as State Manager
    participant R as Redis
    participant DB as PostgreSQL
    participant WA as WhatsApp API
    participant M as Meta API
    participant C as 👤 Customer

    %% Agent sends message
    Note over A,GC: Agent responds to customer
    A->>GC: Send message in Genesys Agent Desktop<br/>"We can help you with that"

    %% Genesys processes and sends webhook
    Note over GC: Genesys processes outbound message<br/>Triggers webhook to integration
    GC->>AG: POST /webhook/genesys<br/>Body: {<br/>  channel: {platform: 'Open', messageId, conversationId},<br/>  type: 'Text',<br/>  text: 'We can help you with that',<br/>  direction: 'Outbound'<br/>}

    %% API Gateway routes
    AG->>GW: Route to Genesys Webhook Service

    %% Webhook validation
    rect rgb(255, 240, 240)
        Note over GW: Webhook Validation
        GW->>GW: Validate webhook signature<br/>(if configured)

        GW->>R: GET tenant by integrationId<br/>Key: integration:{integrationId}

        alt Integration config in Redis
            R-->>GW: {tenant_id, status: 'active', config}
        else Not in cache
            GW->>DB: SELECT * FROM tenants<br/>WHERE genesys_integration_id = ?
            DB-->>GW: {tenant_id, config}
            GW->>R: SET integration:{integrationId}<br/>TTL: 3600s
        end
    end

    %% Store raw webhook to MinIO
    rect rgb(200, 100, 100)
        Note over GW,MinIO: Store Raw Webhook Payload
        GW->>MinIO: PUT /webhooks-outbound/<br/>{tenantId}/{yyyy-MM-dd}/{timestamp}-{convId}.json<br/>Content: Complete Genesys webhook payload
        MinIO-->>GW: 200 OK (Object stored)
    end

    %% Queue message
    GW->>RMQ: Publish message to queue<br/>Queue: OUTBOUND_GENESYS_MESSAGES<br/>Payload: {conversationId, messageId, type, text, tenantId}

    %% ACK back to Genesys
    GW-->>AG: 200 OK
    AG-->>GC: 200 OK (Webhook acknowledged)

    Note over RMQ,OT: Async Processing Begins

    %% Outbound Transformer consumes
    RMQ->>OT: Consume message from queue

    %% State Manager - Reverse Mapping (conversationId → wa_id)
    rect rgb(255, 255, 200)
        Note over OT,DB: Reverse Conversation Mapping<br/>(conversationId → wa_id)
        OT->>SM: GET /state/conversation/:conversationId<br/>Path: /state/conversation/abc-123

        Note over SM: Check Redis cache first (reverse lookup)
        SM->>R: GET mapping:conv:abc-123

        alt Mapping found in Redis cache
            R-->>SM: {waId: '+919876543210', tenantId: 'tenant-001'}
            Note over SM: Cache hit - Update activity in DB
            SM->>DB: UPDATE conversation_mappings<br/>SET last_activity_at = NOW()<br/>WHERE conversation_id = 'abc-123'
            DB-->>SM: 1 row updated
        else Mapping not in cache
            Note over SM: Cache miss - Query database
            SM->>DB: SELECT wa_id, tenant_id, contact_name<br/>FROM conversation_mappings<br/>WHERE conversation_id = 'abc-123'<br/>AND tenant_id = 'tenant-001'

            alt Mapping exists in database
                DB-->>SM: {wa_id: '+919876543210', tenant_id: 'tenant-001'}

                SM->>DB: UPDATE conversation_mappings<br/>SET last_activity_at = NOW()<br/>WHERE conversation_id = 'abc-123'
                DB-->>SM: 1 row updated

                Note over SM: Cache the mapping (bidirectional)
                SM->>R: SET mapping:conv:abc-123<br/>Value: {waId, tenantId}<br/>TTL: 3600s
                SM->>R: SET mapping:wa:+919876543210<br/>Value: {conversationId, tenantId}<br/>TTL: 3600s
            else No mapping exists
                Note over SM: ERROR: No WhatsApp mapping found
                DB-->>SM: Empty result (0 rows)
                SM-->>OT: 404 Not Found<br/>Error: No WhatsApp mapping for conversationId
                Note over OT: Log error and skip message<br/>Conversation exists only in Genesys
            end
        end

        SM-->>OT: 200 OK<br/>{waId: '+919876543210', tenantId: 'tenant-001'}
    end

    %% Transform message
    Note over OT: Transform Message Format<br/>Genesys Open Messaging → Meta WhatsApp

    OT->>OT: Build Meta WhatsApp payload:<br/>{<br/>  messaging_product: 'whatsapp',<br/>  recipient_type: 'individual',<br/>  to: '+919876543210',<br/>  type: 'text',<br/>  text: {<br/>    preview_url: false,<br/>    body: 'We can help you with that'<br/>  }<br/>}

    %% Send to WhatsApp API Service
    OT->>WA: POST /whatsapp/send<br/>Body: {to, type, text, tenantId}

    %% WhatsApp API - Token Management
    rect rgb(220, 220, 255)
        Note over WA,DB: WhatsApp Token Retrieval with Redis Caching

        Note over WA: Check Redis for cached WhatsApp token
        WA->>R: GET tenant:tenant-001:whatsapp:token

        alt Token found in Redis
            R-->>WA: {<br/>  accessToken: 'EAAJ...',<br/>  phoneNumberId: '123456789',<br/>  businessAccountId: 'BA123',<br/>  cachedAt: timestamp<br/>}
            Note over WA: ✓ Use cached token<br/>No DB query needed
        else Token not in cache
            Note over WA: Cache miss - Query database
            WA->>DB: SELECT whatsapp_config<br/>FROM tenant_credentials<br/>WHERE tenant_id = 'tenant-001'<br/>AND credential_type = 'whatsapp'<br/>AND is_active = true
            DB-->>WA: {<br/>  access_token: 'EAAJ...',<br/>  phone_number_id: '123456789',<br/>  business_account_id: 'BA123',<br/>  waba_id: 'WABA123'<br/>}

            Note over WA: Cache token (24 hour TTL)
            WA->>R: SET tenant:tenant-001:whatsapp:token<br/>Value: {accessToken, phoneNumberId, ...}<br/>TTL: 86400s (24 hours)
            R-->>WA: OK
        end
    end

    %% Send message to Meta WhatsApp API
    rect rgb(37, 211, 102)
        Note over WA,M: Send to Meta WhatsApp Business API
        WA->>M: POST https://graph.facebook.com/v18.0<br/>/{phone_number_id}/messages<br/>Authorization: Bearer EAAJ...<br/>Content-Type: application/json<br/>Body: {<br/>  messaging_product: 'whatsapp',<br/>  to: '+919876543210',<br/>  type: 'text',<br/>  text: {body: '...'}}<br/>}

        Note over M: Meta processes message<br/>Validates recipient<br/>Delivers to WhatsApp server
        M-->>WA: 200 OK<br/>{<br/>  messaging_product: 'whatsapp',<br/>  contacts: [{wa_id: '919876543210'}],<br/>  messages: [{id: 'wamid.XYZ123'}]<br/>}
    end

    WA-->>OT: 200 OK<br/>{<br/>  messageId: 'wamid.XYZ123',<br/>  status: 'sent'<br/>}

    %% Track message in database
    rect rgb(200, 255, 200)
        Note over OT,DB: Message Tracking & Audit
        OT->>SM: POST /state/message<br/>Body: {<br/>  metaMessageId: 'wamid.XYZ123',<br/>  genesysMessageId: 'gmsg-456',<br/>  conversationId: 'abc-123',<br/>  tenantId: 'tenant-001',<br/>  direction: 'outbound',<br/>  status: 'sent'<br/>}

        SM->>DB: INSERT INTO message_tracking (<br/>  meta_message_id, genesys_message_id,<br/>  conversation_id, tenant_id,<br/>  direction, status, created_at<br/>) VALUES (<br/>  'wamid.XYZ123', 'gmsg-456',<br/>  'abc-123', 'tenant-001',<br/>  'outbound', 'sent', NOW()<br/>)
        DB-->>SM: 1 row inserted

        SM-->>OT: 200 OK
    end

    %% Deliver to customer
    Note over M,C: Message Delivery
    M->>C: Deliver WhatsApp message<br/>"We can help you with that"

    Note over C: Customer receives message<br/>on WhatsApp app

    %% Status updates (async)
    rect rgb(230, 230, 230)
        Note over M,DB: Status Updates (Async)

        Note over M: Meta sends status webhook
        M-->>GW: POST /webhook/meta (status update)<br/>Body: {<br/>  statuses: [{<br/>    id: 'wamid.XYZ123',<br/>    status: 'delivered',<br/>    timestamp: '...'<br/>  }]<br/>}

        GW->>SM: PATCH /state/message/wamid.XYZ123<br/>Body: {status: 'delivered'}

        SM->>DB: UPDATE message_tracking<br/>SET status = 'delivered',<br/>    delivered_at = NOW()<br/>WHERE meta_message_id = 'wamid.XYZ123'
        DB-->>SM: 1 row updated

        SM-->>GW: 200 OK

        Note over M: Later, when customer reads
        M-->>GW: POST /webhook/meta (read receipt)<br/>Body: {statuses: [{status: 'read'}]}

        GW->>SM: PATCH /state/message/wamid.XYZ123<br/>Body: {status: 'read'}

        SM->>DB: UPDATE message_tracking<br/>SET status = 'read',<br/>    read_at = NOW()
        DB-->>SM: 1 row updated
    end
```

## Complete Flow - Message with Media (Image/Document)

```mermaid
sequenceDiagram
    autonumber
    participant A as 👨‍💼 Agent
    participant GC as Genesys Cloud
    participant AG as API Gateway
    participant GW as Genesys Webhook
    participant MinIO as MinIO Storage
    participant RMQ as RabbitMQ
    participant OT as Outbound Transformer
    participant SM as State Manager
    participant R as Redis
    participant DB as PostgreSQL
    participant WA as WhatsApp API
    participant M as Meta API
    participant C as 👤 Customer

    %% Agent sends message with attachment
    Note over A,GC: Agent sends document
    A->>GC: Send message with attachment<br/>File: "invoice.pdf"

    %% Genesys webhook with attachment
    GC->>AG: POST /webhook/genesys<br/>Body: {<br/>  type: 'Structured',<br/>  conversationId: 'abc-123',<br/>  content: [{<br/>    contentType: 'Attachment',<br/>    attachment: {<br/>      mediaType: 'application/pdf',<br/>      url: 'https://genesys.../file123',<br/>      filename: 'invoice.pdf',<br/>      size: 245678<br/>    }<br/>  }]<br/>}
    AG->>GW: Route to webhook service

    %% Validation
    GW->>GW: Validate webhook
    GW->>R: GET tenant config
    R-->>GW: {tenant_id, config}

    %% Store raw webhook
    rect rgb(200, 100, 100)
        Note over GW,MinIO: Store Raw Webhook
        GW->>MinIO: PUT /webhooks-outbound/{tenantId}/{date}/{convId}.json
        MinIO-->>GW: 200 OK
    end

    %% Queue message
    GW->>RMQ: Publish to OUTBOUND_GENESYS_MESSAGES<br/>Include attachment metadata
    GW-->>AG: 200 OK
    AG-->>GC: 200 OK

    Note over RMQ,OT: Async Processing

    RMQ->>OT: Consume message

    %% Reverse mapping
    rect rgb(255, 255, 200)
        Note over OT,DB: Get wa_id from conversationId
        OT->>SM: GET /state/conversation/abc-123
        SM->>R: GET mapping:conv:abc-123

        alt Cache hit
            R-->>SM: {waId, tenantId}
            SM->>DB: UPDATE last_activity_at
        else Cache miss
            SM->>DB: SELECT wa_id FROM conversation_mappings
            DB-->>SM: {waId}
            SM->>DB: UPDATE last_activity_at
            SM->>R: SET mapping (TTL: 3600s)
        end

        SM-->>OT: {waId: '+919876543210'}
    end

    %% Download and store media
    rect rgb(200, 100, 100)
        Note over OT,MinIO: Download & Store Media

        Note over OT: Need to download attachment from Genesys

        OT->>R: GET tenant:{tenantId}:oauth:token

        alt Genesys token in cache
            R-->>OT: {accessToken, expiresAt}
        else Token not cached
            OT->>DB: SELECT genesys_credentials
            DB-->>OT: {clientId, clientSecret, region}
            OT->>GC: POST /oauth/token
            GC-->>OT: {access_token, expires_in}
            OT->>R: SET oauth:token (TTL: 3300s)
        end

        Note over OT: Download attachment from Genesys
        OT->>GC: GET https://genesys.../file123<br/>Authorization: Bearer {token}
        GC-->>OT: Binary data (application/pdf)

        Note over OT: Store to MinIO for WhatsApp delivery
        OT->>OT: Generate storage key:<br/>tenant-001/outbound/documents/<br/>2024-01-29/{uuid}.pdf

        OT->>MinIO: PUT /media-outbound/{key}<br/>Content-Type: application/pdf<br/>Metadata: {<br/>  originalFilename: 'invoice.pdf',<br/>  tenantId: 'tenant-001',<br/>  conversationId: 'abc-123'<br/>}<br/>Content: [binary PDF data]
        MinIO-->>OT: 200 OK<br/>ETag: "abc123..."

        Note over OT: Generate presigned URL (24h expiry)
        OT->>MinIO: Generate presigned GET URL<br/>Bucket: media-outbound<br/>Key: {key}<br/>Expires: 86400s (24 hours)
        MinIO-->>OT: Presigned URL:<br/>https://minio.internal:9000/media-outbound/...<br/>?X-Amz-Expires=86400&X-Amz-Signature=...
    end

    %% Transform with media
    Note over OT: Transform Message<br/>Include media as document

    OT->>OT: Build Meta WhatsApp payload:<br/>{<br/>  messaging_product: 'whatsapp',<br/>  to: '+919876543210',<br/>  type: 'document',<br/>  document: {<br/>    link: '{presignedUrl}',<br/>    filename: 'invoice.pdf'<br/>  }<br/>}

    %% Send to WhatsApp API
    OT->>WA: POST /whatsapp/send

    rect rgb(220, 220, 255)
        Note over WA,R: Check WhatsApp token cache
        WA->>R: GET tenant:{tenantId}:whatsapp:token

        alt Token cached
            R-->>WA: {accessToken, phoneNumberId}
        else Need to fetch
            WA->>DB: SELECT whatsapp_config
            DB-->>WA: {access_token, phone_number_id}
            WA->>R: SET whatsapp:token (TTL: 86400s)
        end
    end

    %% Meta downloads and sends
    rect rgb(37, 211, 102)
        Note over WA,M: Send to Meta with Document Link
        WA->>M: POST /{phone_number_id}/messages<br/>Authorization: Bearer {token}<br/>Body: {<br/>  type: 'document',<br/>  document: {link: '{presignedUrl}', filename}<br/>}

        Note over M: Meta downloads document from MinIO
        M->>MinIO: GET {presignedUrl}<br/>(No auth - signature in URL)
        MinIO-->>M: Binary PDF data

        Note over M: Validate file, process
        M-->>WA: 200 OK<br/>{messages: [{id: 'wamid.DOC456'}]}
    end

    WA-->>OT: Success

    %% Track message
    OT->>SM: POST /state/message
    SM->>DB: INSERT INTO message_tracking<br/>(..., media_type: 'document', media_url)
    SM-->>OT: OK

    %% Deliver to customer
    M->>C: Deliver document to WhatsApp<br/>"invoice.pdf"

    Note over C: Customer receives document<br/>Can download and view
```

## WhatsApp Token Caching - Detailed Flow

```mermaid
sequenceDiagram
    autonumber
    participant WA as WhatsApp API Service
    participant R as Redis Cache
    participant DB as PostgreSQL
    participant Conf as Config/Credentials

    Note over WA: Need to send message to Meta

    WA->>WA: Extract tenant_id from request

    WA->>R: GET tenant:{tenantId}:whatsapp:token

    alt Token found in Redis
        R-->>WA: JSON: {<br/>  accessToken: 'EAAJ...',<br/>  phoneNumberId: '123456789',<br/>  businessAccountId: 'BA123',<br/>  wabaId: 'WABA123',<br/>  cachedAt: timestamp<br/>}

        Note over WA: ✓ Token cached (no DB query)<br/>Valid for 24 hours

        WA->>WA: Use cached credentials

    else Token not in cache (first time or expired)
        R-->>WA: null (key not found)

        Note over WA: Cache miss - Query database

        WA->>DB: SELECT credentials<br/>FROM tenant_credentials<br/>WHERE tenant_id = ?<br/>AND credential_type = 'whatsapp'<br/>AND is_active = true<br/>LIMIT 1

        DB-->>WA: Row: {<br/>  credentials: {<br/>    access_token: 'EAAJ...',<br/>    phone_number_id: '123456789',<br/>    business_account_id: 'BA123',<br/>    waba_id: 'WABA123',<br/>    app_id: 'APP123'<br/>  },<br/>  created_at: '...',<br/>  updated_at: '...'<br/>}

        Note over WA: Extract credentials from JSONB

        WA->>WA: Parse credentials JSON:<br/>{<br/>  accessToken: credentials.access_token,<br/>  phoneNumberId: credentials.phone_number_id,<br/>  businessAccountId: credentials.business_account_id,<br/>  wabaId: credentials.waba_id<br/>}

        Note over WA: Cache for 24 hours

        WA->>R: SET tenant:{tenantId}:whatsapp:token<br/>Value: JSON credentials<br/>EX 86400 (24 hours)

        R-->>WA: OK

        Note over WA: Credentials now cached
    end

    Note over WA: Use credentials to call Meta API

    WA->>WA: Build Meta API request:<br/>POST /{phoneNumberId}/messages<br/>Authorization: Bearer {accessToken}
```

## State Manager Reverse Mapping - Detailed

```mermaid
sequenceDiagram
    autonumber
    participant OT as Outbound Transformer
    participant SM as State Manager
    participant R as Redis
    participant DB as PostgreSQL

    Note over OT,SM: Request: GET /state/conversation/:conversationId

    OT->>SM: GET /state/conversation/abc-123<br/>Header: X-Tenant-ID: tenant-001

    rect rgb(255, 200, 200)
        Note over SM: Step 1: Check Redis Cache (Reverse Lookup)
        SM->>R: GET mapping:conv:abc-123

        alt Cache HIT
            R-->>SM: JSON: {<br/>  waId: '+919876543210',<br/>  tenantId: 'tenant-001',<br/>  contactName: 'John Doe',<br/>  cachedAt: timestamp<br/>}

            Note over SM: Cache hit! Update activity in DB
            rect rgb(200, 200, 255)
                SM->>DB: UPDATE conversation_mappings<br/>SET last_activity_at = NOW()<br/>WHERE conversation_id = 'abc-123'<br/>AND tenant_id = 'tenant-001'

                Note over DB: Track last outbound message time
                DB-->>SM: UPDATE 1 (1 row affected)
            end

            SM-->>OT: 200 OK<br/>{<br/>  waId: '+919876543210',<br/>  tenantId: 'tenant-001',<br/>  contactName: 'John Doe'<br/>}

        else Cache MISS
            R-->>SM: null (key not found)

            Note over SM: Step 2: Query Database (Reverse Lookup)
            rect rgb(200, 200, 255)
                SM->>DB: SELECT wa_id, tenant_id, contact_name,<br/>       phone_number_id, display_phone_number<br/>FROM conversation_mappings<br/>WHERE conversation_id = 'abc-123'<br/>AND tenant_id = 'tenant-001'<br/>LIMIT 1

                alt Mapping EXISTS in database
                    DB-->>SM: Row: {<br/>  wa_id: '+919876543210',<br/>  tenant_id: 'tenant-001',<br/>  contact_name: 'John Doe',<br/>  phone_number_id: '123456789'<br/>}

                    Note over SM: Step 3: Update activity timestamp
                    SM->>DB: UPDATE conversation_mappings<br/>SET last_activity_at = NOW()<br/>WHERE conversation_id = 'abc-123'
                    DB-->>SM: UPDATE 1

                    Note over SM: Step 4: Cache in Redis (bidirectional)
                    SM->>R: SET mapping:conv:abc-123<br/>Value: {waId, tenantId, contactName}<br/>EX 3600
                    R-->>SM: OK

                    SM->>R: SET mapping:wa:+919876543210<br/>Value: {conversationId, tenantId}<br/>EX 3600
                    R-->>SM: OK

                    SM-->>OT: 200 OK<br/>{waId: '+919876543210'}

                else Mapping NOT FOUND
                    DB-->>SM: Empty result (0 rows)

                    Note over SM: ERROR: No WhatsApp mapping found<br/>This conversation only exists in Genesys

                    SM-->>OT: 404 Not Found<br/>{<br/>  error: 'No WhatsApp mapping found',<br/>  conversationId: 'abc-123',<br/>  message: 'Conversation has no linked WhatsApp ID'<br/>}

                    Note over OT: Log error, skip message,<br/>notify monitoring
                end
            end
        end
    end

    Note over OT,DB: Mapping retrieved (or error returned)
```

## MinIO Media Storage - Outbound Detailed

```mermaid
sequenceDiagram
    autonumber
    participant OT as Outbound Transformer
    participant GC as Genesys Cloud
    participant MinIO as MinIO Storage
    participant WA as WhatsApp API
    participant M as Meta API
    participant C as Customer

    Note over OT: Message has attachment from Genesys

    OT->>OT: Parse Genesys attachment:<br/>{<br/>  contentType: 'Attachment',<br/>  attachment: {<br/>    mediaType: 'image/jpeg',<br/>    url: 'https://api.genesys.../media/abc',<br/>    filename: 'screenshot.jpg'<br/>  }<br/>}

    rect rgb(200, 100, 100)
        Note over OT,MinIO: Download from Genesys & Store to MinIO

        Note over OT: Step 1: Download from Genesys
        OT->>GC: GET https://api.genesys.../media/abc<br/>Authorization: Bearer {genesys_token}

        Note over GC: Genesys serves media file
        GC-->>OT: 200 OK<br/>Content-Type: image/jpeg<br/>Content-Length: 156789<br/>[binary image data]

        Note over OT: Step 2: Generate MinIO storage key
        OT->>OT: Build storage path:<br/>• tenantId: 'tenant-001'<br/>• direction: 'outbound'<br/>• mediaType: 'images'<br/>• date: '2024-01-29'<br/>• uuid: uuid.v4()<br/>• ext: 'jpg'<br/><br/>key = 'tenant-001/outbound/images/2024-01-29/{uuid}.jpg'

        Note over OT: Step 3: Upload to MinIO
        OT->>MinIO: PUT /media-outbound/{key}<br/>Bucket: media-outbound<br/>Key: tenant-001/outbound/images/2024-01-29/{uuid}.jpg<br/>Content-Type: image/jpeg<br/>Metadata: {<br/>  originalFilename: 'screenshot.jpg',<br/>  tenantId: 'tenant-001',<br/>  conversationId: 'abc-123',<br/>  genesysMediaId: 'abc',<br/>  direction: 'outbound',<br/>  uploadedAt: '2024-01-29T10:30:00Z'<br/>}<br/>Content: [binary image data]

        Note over MinIO: Store object with metadata<br/>Calculate ETag<br/>Apply lifecycle policy
        MinIO-->>OT: 200 OK<br/>ETag: "d41d8cd98f00b204e9800998ecf8427e"

        Note over OT: Step 4: Generate presigned URL (24h expiry)
        OT->>MinIO: Generate presigned GET URL<br/>Request:<br/>• Bucket: media-outbound<br/>• Key: tenant-001/outbound/images/2024-01-29/{uuid}.jpg<br/>• Expires: 86400 seconds (24 hours)<br/>• Method: GET

        Note over MinIO: Generate AWS Signature V4<br/>Include expiry in query params
        MinIO-->>OT: Presigned URL:<br/>https://minio.internal:9000/media-outbound/<br/>tenant-001/outbound/images/2024-01-29/{uuid}.jpg?<br/>X-Amz-Algorithm=AWS4-HMAC-SHA256&<br/>X-Amz-Credential=minioadmin/20240129/us-east-1/s3/aws4_request&<br/>X-Amz-Date=20240129T103000Z&<br/>X-Amz-Expires=86400&<br/>X-Amz-SignedHeaders=host&<br/>X-Amz-Signature=abcdef123456...
    end

    Note over OT: Build WhatsApp message with media link

    OT->>OT: Build Meta payload:<br/>{<br/>  messaging_product: 'whatsapp',<br/>  to: '+919876543210',<br/>  type: 'image',<br/>  image: {<br/>    link: '{presignedUrl}',<br/>    caption: 'Screenshot'<br/>  }<br/>}

    OT->>WA: POST /whatsapp/send<br/>Body: {to, type, image}

    WA->>M: POST /{phone_number_id}/messages<br/>Authorization: Bearer {whatsapp_token}<br/>Body: {image: {link}}

    rect rgb(200, 100, 100)
        Note over M,MinIO: Meta Downloads Media

        Note over M: Meta validates request<br/>Downloads media from provided link

        M->>MinIO: GET {presignedUrl}<br/>(No additional auth - signature in URL)

        Note over MinIO: Validate AWS Signature<br/>Check expiry timestamp<br/>Serve file if valid
        MinIO-->>M: 200 OK<br/>Content-Type: image/jpeg<br/>Content-Length: 156789<br/>[binary image data]

        Note over M: Validate image:<br/>• Check file type matches<br/>• Scan for malware<br/>• Verify size limits<br/>• Process for WhatsApp delivery
    end

    M-->>WA: 200 OK<br/>{messages: [{id: 'wamid.IMG789'}]}

    WA-->>OT: Success

    Note over M,C: Deliver to Customer

    M->>C: Deliver image via WhatsApp<br/>Thumbnail + full resolution

    Note over C: Customer receives image<br/>Can view and download
```

## Database Operations Summary

```mermaid
sequenceDiagram
    autonumber
    participant App as Application Layer<br/>(Webhook/Transformer/API)
    participant SM as State Manager
    participant R as Redis
    participant DB as PostgreSQL

    Note over App,DB: All Database Operations Flow Through State Manager

    rect rgb(255, 230, 230)
        Note over App,SM: Operation 1: Reverse Lookup (conversationId → wa_id)

        App->>SM: GET /state/conversation/{conversationId}

        SM->>R: GET mapping:conv:{conversationId}

        alt Cache hit
            R-->>SM: {waId, tenantId}
        else Cache miss
            SM->>DB: SELECT wa_id, tenant_id<br/>FROM conversation_mappings<br/>WHERE conversation_id = ?
            DB-->>SM: {wa_id, tenant_id}
            SM->>R: SET mapping:conv:{conversationId}<br/>TTL: 3600s
        end

        SM->>DB: UPDATE conversation_mappings<br/>SET last_activity_at = NOW()
        DB-->>SM: UPDATE 1

        SM-->>App: {waId, tenantId}
    end

    rect rgb(230, 255, 230)
        Note over App,DB: Operation 2: Track Outbound Message

        App->>SM: POST /state/message<br/>Body: {metaMessageId, genesysMessageId,<br/>conversationId, direction: 'outbound'}

        SM->>DB: INSERT INTO message_tracking (<br/>  meta_message_id,<br/>  genesys_message_id,<br/>  conversation_id,<br/>  tenant_id,<br/>  direction,<br/>  status,<br/>  created_at<br/>) VALUES (?, ?, ?, ?, 'outbound', 'sent', NOW())

        DB-->>SM: INSERT 1

        SM-->>App: 201 Created
    end

    rect rgb(230, 230, 255)
        Note over App,DB: Operation 3: Update Message Status

        App->>SM: PATCH /state/message/{messageId}<br/>Body: {status: 'delivered'}

        SM->>DB: UPDATE message_tracking<br/>SET status = ?,<br/>    delivered_at = NOW(),<br/>    updated_at = NOW()<br/>WHERE meta_message_id = ?

        DB-->>SM: UPDATE 1

        SM-->>App: 200 OK
    end

    Note over App,DB: All operations include error handling<br/>and transaction management
```

## Performance Metrics - Timing Breakdown

```mermaid
gantt
    title Outbound Message Processing Timeline
    dateFormat  X
    axisFormat  %L ms

    section Webhook
    Receive & Validate          :0, 20
    Tenant Lookup (Redis)       :20, 50
    Store to MinIO              :50, 150
    Queue to RabbitMQ           :150, 200
    Return 200 OK               :200, 220

    section Async Processing
    RabbitMQ Delivery           :220, 270
    Reverse Mapping (Cache Hit) :270, 320
    DB Update (Activity)        :320, 400
    Transform Message           :400, 500

    section WhatsApp Delivery
    Token Check (Cache Hit)     :500, 550
    POST to Meta                :550, 1050
    Meta Processing             :1050, 1300

    section Total
    End-to-End Latency         :0, 1300
```

### Latency Breakdown

| Operation | Best Case | Worst Case | Notes |
|-----------|-----------|------------|-------|
| Webhook validation | 20ms | 100ms | Signature check + tenant lookup |
| MinIO storage | 100ms | 500ms | Object storage write |
| RabbitMQ publish | 20ms | 100ms | Queue write |
| **Webhook ACK** | **150ms** | **700ms** | **Total sync time** |
| Reverse mapping (cache hit) | 10ms | 50ms | Redis GET |
| Reverse mapping (cache miss) | 100ms | 500ms | PostgreSQL query |
| DB activity update | 50ms | 200ms | PostgreSQL UPDATE |
| Message transform | 10ms | 100ms | JSON transformation |
| WhatsApp token check (cache hit) | 10ms | 50ms | Redis GET |
| WhatsApp token check (cache miss) | 100ms | 300ms | PostgreSQL query |
| Meta API call | 200ms | 1000ms | Network + Meta processing |
| **Total (cache hit)** | **550ms** | **2000ms** | **End-to-end** |
| **Total (cache miss)** | **800ms** | **3000ms** | **With DB lookups** |

### Cache Hit Rates (Expected)

- **WhatsApp token cache:** 98%+ (tokens valid for 24 hours)
- **Reverse mapping cache:** 80%+ (active conversations)
- **Tenant config:** 99%+ (rarely changes)
- **Overall:** ~92% of requests hit Redis cache

## Key Differences from Inbound Flow

1. **Reverse Mapping:** conversationId → wa_id (instead of wa_id → conversationId)
2. **WhatsApp Token:** Long-lived (24h TTL) vs Genesys OAuth (1h TTL)
3. **Media Flow:** Download from Genesys → Store in MinIO → Send link to Meta
4. **Error Handling:** Missing mapping is critical (can't send without wa_id)
5. **Webhook Source:** Genesys Cloud instead of Meta WhatsApp
