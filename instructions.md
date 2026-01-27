## Instructions

#Xypr App (Application - MVP)
- This is a middleware application that bridges between Genesys Contact Management Software and Whatsapp Business API. 
- It provides a web interface for agents to interact with customers via Whatsapp Business API. 
- Every Organization(tenant) will have multiple Agents under it. 
- An Organization(tenant) will have one Genesys account. Any agents loging in will come under the organization. 
 -An organization will have one WABA account through which all agents will interact with customers.
- Xyper app uses Open Messaging Protocol to connect with Genesys Contact Management Software.
- Xyper will be added as an Integration to Genesys Contact Management Software.
- Xyper app is a SAAS application.
# Users/Roles
1. Xyper Administrators : They are the ones who manage the Xyper app.
2. Genesys Users.
    2.1 Genesys Administrators
    2.2 Genesys Supervisors
    2.3 Genesys Agents
3. End Customers : They communicate via thier personal whatsapp account.

## Services

* Whatsapp Webhook Service
    - Receives Message from WhatsApp.
    - Gets Tenant Id from Redis Cache or Tenant Service.
    - Publishes Message to RabbitMQ.
* Whatsapp API Service
    - Receives Message from RabbitMQ.
    - Gets WhatsApp Secrets by Tenant Id from Redis Cache or Tenant Service.
    - Sends Message to WhatsApp API.
* Genesys Webhook Service
    - Receives Outbound Open Messages from Genesys.
    - Gets Tenant Id from Redis Cache or Tenant Service.
    - Publishes Message to RabbitMQ.
* Genesys API Service
    - Receives Message from Outbound Transformer Service.
    - Gets Genesys token if exists from Redis Cache.
    - If token not exists, Gets Genesys Secrets by Tenant Id from Tenant Service.
    - Updates Genesys token in Redis Cache.
    - Sends Message to Genesys API.
* Inbound Transformer Service
    - Receives Message from RabbitMQ.
    - Transforms Message to Genesys Format.
    - Sends Message to Genesys API.
* Outbound Transformer Service
    - Receives Message from RabbitMQ.
    - Transforms Message to Genesys Format.
    - Sends Message to Genesys API.
* Agent Widget
    - Provides a web interface for agents to interact with customers via WhatsApp Business API.
    - Will be set as Agent Interaction Widget in Genesys.
* Admin Dashboard Service
    - Provides a web interface for administrators to manage tenants and users.
* API Gateway Service
    - Gateway for all external APIs.
    - Handles rate limiting and authentication.    
* Auth Service
    - Handles authentication and authorization.
    - Generates and validates tokens.
* Tenant Service
    - Manages tenant information. 
    - Creates tenant and stores in Redis Cache and PostgreSQL (onboarding).
    - Stores tenant secrets.
* State Manager Service
    - **Features**:
        - **Conversation Mapping**: Maps WhatsApp user IDs (wa_id) to internal conversation IDs and Genesys interactions using both Redis and PostgreSQL.
        - **Context Management**: Stores contextual information for active conversations (no caching currently).
        - **Message Tracking**: Logs incoming and outgoing message metadata and direction.
        - **Statistics**: Provides basic system counters.
        - **Media Mapping**: Maps media file URLs to internal conversation IDs.
        - **Context Caching**: Missing Redis layer for context data.

## Storage

* MinIO : For storing media files.
* Redis : For caching and state management.
* PostgreSQL : For storing tenant information and conversation mapping.