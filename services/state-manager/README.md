State-Manager Service
Version: 2.0 (Enterprise Hardened) Role: Transactional Core / Identity Resolution Engine
📖 Overview
The State-Manager is the central "brain" of the integration. It is a high-throughput, stateful microservice responsible for maintaining the authoritative link between external WhatsApp identities (wa_id) and internal Genesys conversation contexts (conversation_id). It ensures message correlation, prevents duplicate conversations via distributed locking, and maintains a distinct audit trail for every message processed.
Unlike other stateless services in this architecture, the State Manager manages persistence across physically isolated tenant databases.
🔑 Key Responsibilities
• Identity Resolution: Resolves wa_id to conversation_id (Inbound) and conversation_id to wa_id (Outbound) with <50ms latency.
• Correlation: Updates temporary mapping records with actual Genesys Conversation IDs once created via the Open Messaging API.
• Audit Logging: Persists the lifecycle state (Sent, Delivered, Read, Failed) of every message.
• Idempotency: Uses Redis distributed locks to prevent race conditions when creating new conversations.
• Tenant Isolation: Dynamically connects to specific tenant PostgreSQL instances based on traffic context.
🛠 Tech Stack
• Runtime: Node.js / Go (Recommended)
• Primary Store: PostgreSQL (Per-Tenant Isolated Instances)
• Caching/Locking: Redis (Shared Cluster with tenant-scoped keys)
• Messaging: RabbitMQ (inboundQueue, outboundQueue, statusQueue)
🚀 Setup & Configuration
Environment Variables
NODE_ENV=production
# Redis Configuration
REDIS_HOST=10.0.0.5
REDIS_PORT=6379
# Platform DB (For tenant lookup only)
PLATFORM_DB_URL=postgres://user:pass@host:5432/platform_db
# Master Key for Decrypting Tenant DB Credentials
ENCRYPTION_KEY=... 

--------------------------------------------------------------------------------