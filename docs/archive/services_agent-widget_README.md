# Agent Widget Service

The Agent Widget Service provides an embedded customer context widget for Genesys Cloud agents. It allows agents to view WhatsApp conversation history, customer details, and send templates directly from the Genesys interface.

## Architecture

This service follows a modular architecture:

- **Config**: Centralized configuration and environment variables.
- **Routes**: API endpoint definitions.
- **Controllers**: Request handling and response formatting.
- **Services**: Business logic and external API communication.

## API Endpoints

### Widget UI
- `GET /widget`: Serves the main widget HTML page.
- `GET /widget/config`: Returns widget configuration (URLs, features).

### Conversation Data
- `GET /widget/api/conversation/:conversationId`: Get conversation details and mapping.
- `GET /widget/api/customer/:waId`: Get customer context by WhatsApp ID.
- `GET /widget/api/conversation/:conversationId/history`: Get message history.
- `GET /widget/api/conversation/:conversationId/analytics`: Get conversation stats.

### Actions
- `POST /widget/api/send-template`: Send a WhatsApp template message.
- `POST /widget/api/send-quick-reply`: Send a quick reply text message.
- `GET /widget/api/templates`: Get available message templates.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file based on `.env.example`:
   ```bash
   PORT=3012
   STATE_SERVICE_URL=http://state-manager:3005
   WHATSAPP_API_URL=http://whatsapp-api:3008
   PUBLIC_URL=http://localhost:3012
   ```

3. **Run Service**:
   ```bash
   npm start
   ```

## Development

- Run in dev mode with nodemon:
  ```bash
  npm run dev
  ```
