# Agent Portal

Web application for Genesys-licensed users to manage WhatsApp customer conversations in the Xypr platform.

## Overview

The Agent Portal is part of the **Xypr App** - a SAAS middleware that bridges Genesys Contact Management Software and WhatsApp Business API.

**Key Architecture:**
- **Multi-tenant**: Multiple organizations use the platform
- **Organization-centric**: One WhatsApp Business Account per organization (shared by all agents)
- **Genesys Integration**: Agents authenticate via Genesys OAuth and are auto-linked to their organization
- **Auto-provisioning**: New users are automatically created on first Genesys login

## User Types

1. **Genesys Administrators**: Manage organization settings, view all conversations
2. **Genesys Supervisors**: Assign/transfer conversations, access reports
3. **Genesys Agents**: View assigned conversations, send/receive messages

## Features

- ✅ **Auto-provisioning**: No manual signup - users created on first Genesys login
- ✅ **Organization linking**: Automatically linked to organization via Genesys OAuth
- ✅ **Shared WABA**: All agents in an organization use the same WhatsApp account
- ✅ **Conversation management**: View, assign, and manage customer conversations
- ✅ **Message sending**: Send text and template messages to customers
- ✅ **Real-time notifications**: Agent widget for inbound message alerts
- ✅ **Role-based access**: Different permissions for admins, supervisors, and agents

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **Real-time**: Socket.io Client
- **HTTP Client**: Axios

## Development Setup

### Prerequisites

- Node.js 18+
- Backend services running (agent-portal-service, auth-service, etc.)
- Organization must be set up in admin-dashboard first (WhatsApp configured)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your configuration
```

### Environment Variables

```bash
VITE_API_GATEWAY=http://localhost:3000
VITE_AGENT_WIDGET_URL=ws://localhost:3012
VITE_GENESYS_REGION=aps1.mypurecloud.com
```

### Running Locally

```bash
# Development mode with hot reload
npm run dev

# Access at http://localhost:3014
```

## Usage Flow

### First-Time Login (Auto-Provisioning)

1. Navigate to `http://localhost:3014/login`
2. Click "Sign in with Genesys Cloud"
3. Genesys OAuth popup opens
4. Enter your Genesys credentials
5. **Auto-provisioning happens**:
   - Backend fetches your Genesys user info
   - Finds your organization by Genesys organization ID
   - Creates your user account automatically
   - Links you to your organization
6. Redirected to workspace

**No manual signup required!**

### Workspace

- View list of conversations (assigned to you or your organization)
- Click conversation to view message history
- Send messages to customers (using organization's WhatsApp account)
- Receive real-time notifications when customers reply
- Assign conversations to yourself
- (Supervisors/Admins) Transfer conversations between agents

### Profile

- View your user information
- See your organization details
- Check WhatsApp connection status (read-only)
- Note: WhatsApp is configured by organization admin, not individual agents

## Key Differences from Initial Implementation

> [!IMPORTANT]
> **Corrected Architecture**:
> - ❌ **No individual agent signup** → ✅ Auto-provisioning on first Genesys login
> - ❌ **Agents don't set up WhatsApp** → ✅ Organization admin configures WABA once
> - ❌ **Each agent has own WABA** → ✅ One WABA per organization (shared)
> - ❌ **Optional tenant linking** → ✅ Required (every user belongs to a tenant)

## Project Structure

```
agent-portal/
├── src/
│   ├── pages/
│   │   ├── Login.jsx             # Genesys OAuth login
│   │   ├── Workspace.jsx         # Main workspace
│   │   └── Profile.jsx           # User profile
│   ├── components/
│   │   ├── AgentWidget.jsx       # Notification widget
│   │   ├── AuthCallback.jsx      # OAuth callback
│   │   ├── ConversationComponents.jsx # Conversation UI
│   │   └── ProtectedRoute.jsx    # Auth guard
│   ├── services/
│   │   ├── authService.js        # Authentication
│   │   ├── conversationService.js # Conversations
│   │   ├── messageService.js     # Messages
│   │   ├── socketService.js      # WebSocket
│   │   └── whatsappService.js    # WhatsApp status
│   ├── App.jsx
│   └── main.jsx
├── Dockerfile
├── vite.config.js
└── tailwind.config.js
```

## Docker

```bash
# Build
docker build -t agent-portal .

# Run
docker run -p 3014:80 \
  -e VITE_API_GATEWAY=http://api-gateway:3000 \
  agent-portal
```

## Troubleshooting

### "Organization not found" Error

**Cause**: The organization hasn't been set up in the admin-dashboard yet.

**Solution**: Contact your Xypr administrator to create your organization first.

### WhatsApp Not Connected

**Cause**: Organization admin hasn't set up WhatsApp yet.

**Solution**: Contact your organization administrator to complete WhatsApp embedded signup in the admin-dashboard.

### Popup Blocked

If OAuth popup doesn't open, allow popups for localhost:3014 in browser settings.

## License

MIT
