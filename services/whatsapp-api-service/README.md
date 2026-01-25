# WhatsApp API Service

A service wrapper for the Meta/WhatsApp Graph API. It handles authentication, credential management via `tenant-service`, and provides a simplified REST API for sending various types of WhatsApp messages.

## Features

- **Multi-Tenant Architecture**: Automatically resolves tenant credentials
- **Simplified API**: REST endpoints for Text, Templates, Images, Documents, Locations, and Buttons
- **Media Handling**: Proxy for securely fetching and downloading WhatsApp media
- **Centralized Error Handling**: Standardized error responses
- **Structured Logging**: Tenant-aware logging

## Architecture

This service sits between your application logic (e.g., `state-manager`, `outbound-transformer`) and the Meta Graph API.

```
[Inbound/State Manager] -> [WhatsApp API Service] -> [Meta Graph API]
                                     |
                                     v
                             [Tenant Service]
```

## Prerequisites

- **Node.js**: v18+
- **Redis**: For tenant resolution middleware
- **Tenant Service**: Must be running to provide credentials

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service Port | `3008` |
| `TENANT_SERVICE_URL` | URL of the Tenant Service | `http://tenant-service:3007` |
| `REDIS_URL` | Redis Connection URL | `redis://localhost:6379` |

## Installation & Running

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

## API Reference

All endpoints (except health) require tenant identification via `X-API-Key`, `Authorization` (JWT), or Subdomain.

### Sending Messages

**Base URL**: `/whatsapp`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/send/text` | Send a text message |
| POST | `/send/template` | Send a template message |
| POST | `/send/image` | Send an image |
| POST | `/send/document` | Send a document (PDF, etc.) |
| POST | `/send/location` | Send a location |
| POST | `/send/buttons` | Send interactive buttons |
| POST | `/mark-read` | Mark a message as read |

**Example: Send Text**
```json
POST /whatsapp/send/text
{
  "to": "1234567890",
  "text": "Hello World"
}
```

### Media Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/media/:mediaId` | Get media URL and metadata |
| GET | `/media/:mediaId/download` | Download media binary stream |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health status |

## Project Structure

```
src/
├── config/         # Configuration
├── controllers/    # Request handlers (logic)
├── middleware/     # Error handling
├── routes/         # Express definitions
├── services/       # Business logic (WhatsApp Wrapper, Tenant Fetching)
├── utils/          # Logger, helpers
└── index.js        # Entry point
```

## Dependencies
- `express`
- `axios`
- `../../shared/middleware/tenantResolver` (Shared project middleware)
