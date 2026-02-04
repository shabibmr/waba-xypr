# WABA-Genesys Integration Platform

**Context**: This project is a microservices-based middleware platform integrating the WhatsApp Business API (WABA) with Genesys Cloud. It facilitates message routing, transformation, and state management, providing a unified agent interface.

## Architecture Overview

The system operates as a set of decoupled microservices, communicating via HTTP (REST) and likely RabbitMQ for asynchronous events (indicated by `amqplib` dependencies). A central **API Gateway** manages traffic, routing requests to appropriate backend services.

### Core Flows
1.  **Inbound (User -> Agent)**: WhatsApp Webhook -> API Gateway -> WhatsApp Webhook Service -> Inbound Transformer -> Genesys API Service -> Genesys Cloud.
2.  **Outbound (Agent -> User)**: Genesys Cloud -> Genesys Webhook Service -> Outbound Transformer -> WhatsApp API Service -> WhatsApp Cloud.

## Microservices Directory

| Service | Port | Language | Description |
| :--- | :--- | :--- | :--- |
| **api-gateway** | `3000` | JavaScript | Central entry point, router, rate limiter, and security layer. |
| **auth-service** | `3004` | JavaScript | Handles authentication and authorization. |
| **state-manager** | `3005` | JavaScript | Manages conversation state and session context. |
| **tenant-service** | `3007` | JavaScript | Manages multi-tenancy configurations and OAuth credentials. |
| **whatsapp-webhook-service** | `3009` | JavaScript | Receives incoming messages from Meta/WhatsApp. |
| **genesys-api-service** | `3010` | TypeScript | Outbound connector to Genesys Cloud API. |
| **genesys-webhook-service** | `3011` | TypeScript | Receives events (messages/status) from Genesys Cloud. |
| **agent-portal** | `3014` | React/Vite | Frontend dashboard for agents. |
| **agent-portal-service** | `?` | JavaScript | Backend API for the Agent Portal. |
| **inbound-transformer** | `?` | TypeScript | Transforms WhatsApp payloads to Genesys format. |
| **outbound-transformer** | `?` | TypeScript | Transforms Genesys payloads to WhatsApp format. |
| **admin-dashboard** | `?` | React/Vite | Administrative UI for configuring tenants and settings. |

## Development Setup

### Prerequisites
*   **Node.js**: v18+ recommended.
*   **Docker**: For containerized deployment.
*   **Redis**: Required for Rate Limiting (API Gateway) and caching.
*   **RabbitMQ**: Likely used for inter-service messaging (based on dependencies).

### Installation
The project is a monorepo-style structure where each folder is an independent service.

1.  **Install Dependencies**: Navigate to each service directory and run:
    ```bash
    npm install
    ```

2.  **Environment Configuration**:
    *   Most services have a `.env.example` file.
    *   Copy it to `.env` and populate necessary values (Database URLs, API Keys, Service URLs).
    *   *Critical*: Ensure `PORT` variables match the table above for local development connectivity.

### Running Locally
Each service can be run independently.

**Development Mode (with hot reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

### Running with Docker
Each service includes a `Dockerfile`.
```bash
docker build -t <service-name> .
docker run -p <host-port>:<container-port> --env-file .env <service-name>
```

## Testing
Jest is the standard testing framework across the project.

**Run Unit Tests:**
```bash
npm test
```

## Project Structure & Conventions

*   **Language**: Mixed JavaScript (Node.js/Express) and TypeScript.
    *   *TypeScript* is used for newer/complex services (`genesys-api-service`, transformers).
    *   *JavaScript* is used for core infrastructure (`api-gateway`, `auth-service`).
*   **Frontend**: React with Vite and Tailwind CSS.
*   **API Design**: RESTful architecture.
*   **Documentation**: Some services contain an `openapi.yaml` in a `docs/` folder.

## Key Integration Points
*   **WhatsApp**: Handled via `whatsapp-api-service` and `whatsapp-webhook-service`.
*   **Genesys**: Handled via `genesys-api-service` and `genesys-webhook-service`.
