# Service Dependency & Startup Order

This document outlines the logical dependency order for the WhatsApp-Genesys Integration microservices. Services should be started in this order to ensure dependent systems are available.

## 1. Infrastructure Layer (Required First)
These systems must be running before ANY application services start.
1.  **PostgreSQL** (Port 5432) - Primary database for tenants and state.
2.  **Redis** (Port 6379) - Caching for tokens, state, and rate limiting.
3.  **RabbitMQ** (Port 5672/15672) - Message queue for async processing.

## 2. Core Service Layer (Foundation)
These services provide authentication, configuration, and state management required by business logic services.
4.  **Tenant Service**
    *   *Port:* 3007
    *   *Dependencies:* PostgreSQL, Redis
    *   *Role:* Provides tenant credentials (API keys, secrets) to other services.
5.  **Auth Service**
    *   *Port:* 3004
    *   *Dependencies:* Redis, Genesys Cloud (External)
    *   *Role:* Manages OAuth tokens. Critical for any service communicating with Genesys.
6.  **State Manager**
    *   *Port:* 3005
    *   *Dependencies:* PostgreSQL, Redis
    *   *Role:* Manages conversation context and mappings. Critical for routing messages correctly.

## 3. Integration Layer (External Connectors)
These services handle direct communication with external platforms.
7.  **WhatsApp API Service**
    *   *Port:* 3008
    *   *Dependencies:* RabbitMQ, Tenant Service (for credentials)
    *   *Role:* Sends outgoing messages to Meta.
8.  **Genesys API Service**
    *   *Port:* 3010
    *   *Dependencies:* RabbitMQ, Auth Service (for tokens), Tenant Service
    *   *Role:* Sends incoming messages to Genesys Open Messaging.
9.  **WhatsApp Webhook Service**
    *   *Port:* 3009
    *   *Dependencies:* RabbitMQ, State Manager, Tenant Service (for signature validation)
    *   *Role:* Receives webhooks from Meta.
10. **Genesys Webhook Service**
    *   *Port:* 3011
    *   *Dependencies:* RabbitMQ, State Manager
    *   *Role:* Receives webhooks from Genesys.

## 4. Processing Layer (Business Logic)
These services transform and route messages between the connectors.
11. **Inbound Transformer**
    *   *Port:* 3002
    *   *Dependencies:* RabbitMQ, State Manager, Genesys API Service
    *   *Role:* Converts WhatsApp JSON -> Genesys Open Messaging format.
12. **Outbound Transformer**
    *   *Port:* 3003
    *   *Dependencies:* RabbitMQ, State Manager, WhatsApp API Service
    *   *Role:* Converts Genesys JSON -> WhatsApp JSON format.
13. **Webhook Handler** (Legacy/Generic)
    *   *Port:* 3001
    *   *Dependencies:* RabbitMQ, State Manager
    *   *Role:* Generic processing if not using specific services above.

## 5. Gateway Layer (Entry Point)
14. **API Gateway**
    *   *Port:* 3000
    *   *Dependencies:* Redis (Rate limiting), All Services types (for proxying)
    *   *Role:* Single entry point for external traffic and frontend applications.

## 6. Frontend Layer (UI)
15. **Admin Dashboard**
    *   *Port:* 3006 / 80
    *   *Dependencies:* API Gateway
    *   *Role:* UI for monitoring and configuration.
16. **Agent Widget**
    *   *Port:* 3012
    *   *Dependencies:* API Gateway, Genesys Cloud (Embedding)
    *   *Role:* UI for agents to see customer context.

---

### Startup Sequence Summary
`Infrastructure` -> `Tenant/Auth/State` -> `API/Webhook Services` -> `Transformers` -> `Gateway` -> `Frontend`
