# Agent Portal

The frontend application for Genesys agents. Provides a unified interface for handling WhatsApp conversations, viewing customer history, and managing active sessions.

- **Auto-Provisioning**: Agents are automatically created on first login via Genesys OAuth.
- **Unified Workspace**: Single view for all assigned WhatsApp conversations.
- **Real-Time Updates**: WebSocket integration for instant message delivery and status changes.
- **Organization Aware**: Multi-tenant support ensures agents only see data for their organization.

## Architecture

```
┌─────────────────┐       ┌────────────────────┐       ┌─────────────────┐
│  Genesys Cloud  │──────▶│    Agent Portal    │──────▶│   API Gateway   │
│  (OAuth Auth)   │       │   (React / Vite)   │       │                 │
└─────────────────┘       └────────────────────┘       └─────────────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │ Microservices   │
                                                  │ (Agent/Auth/etc)│
                                                  └─────────────────┘
```

## Project Structure

```
src/
├── components/      # Reusable UI components
├── pages/           # Route pages (Login, Workspace)
├── services/        # API service adapters
│   ├── auth.service.js
│   ├── conversation.service.js
│   └── socket.service.js
├── store/           # State management
├── utils/           # Helper functions
├── App.jsx          # Main component
└── main.jsx         # Entry point
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_GATEWAY` | API Gateway URL | `http://localhost:3000` |
| `VITE_AGENT_WIDGET_URL` | WebSocket URL | `ws://localhost:3012` |
| `VITE_GENESYS_REGION` | Genesys Region | `aps1.mypurecloud.com` |

## Development

### Installation
```bash
npm install
```

### Running Locally
```bash
npm run dev
```
Access at `http://localhost:3014`

### Building
```bash
npm run build
```

## Docker Deployment

Build the image:
```bash
docker build -t agent-portal .
```

Run the container:
```bash
docker run -p 3014:80 \
  -e VITE_API_GATEWAY=http://api-gateway:3000 \
  agent-portal
```

## Dependencies

- **react**: UI library
- **vite**: Build tool
- **tailwindcss**: Styling
- **socket.io-client**: Real-time communication
- **axios**: HTTP client
