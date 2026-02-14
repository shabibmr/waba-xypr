# WhatsApp API Service

A wrapper around the Meta WhatsApp Graph API. Handles strict type checking, token management (via Tenant Service), and provides a clean REST API for sending messages.

- **Unified Messaging**: Simple endpoints for Text, Image, Document, Location, and Templates.
- **Tenant Resolution**: Automatically injects the correct OAuth token based on the request.
- **Media Proxy**: Securely fetches media binaries from Meta's signed URLs.
- **Error Normalization**: Standardizes Meta API errors into clean HTTP responses.

## Architecture

```
┌────────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│ Outbound Trans. /  │─────▶│ WhatsApp API Service │─────▶│  Meta Graph API  │
│ Agent Portal       │      └──────────┬───────────┘      └──────────────────┘
└────────────────────┘                 │
                                       ▼
                              ┌──────────────────┐
                              │  Tenant Service  │
                              │ (Get Credentials)│
                              └──────────────────┘
```

## Project Structure

```
src/
├── config/
│   └── index.js
├── controllers/
│   ├── media.controller.js      # Media download proxy
│   └── message.controller.js    # Send message handlers
├── services/
│   ├── whatsapp.service.js      # Meta API wrapper
│   └── tenant.service.js        # Credential fetching
├── routes/
│   └── index.js
└── index.js
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service Port | `3008` |
| `NODE_ENV` | Environment | `development` |
| `TENANT_SERVICE_URL` | Tenant Service URL | `http://tenant-service:3007` |
| `REDIS_URL` | Redis URL | `redis://localhost:6379` |

## API Endpoints

### Sending Messages
```
POST /whatsapp/send/text        # Send text
POST /whatsapp/send/template    # Send template (HSM)
POST /whatsapp/send/image       # Send image
POST /whatsapp/send/document    # Send document (PDF, etc)
POST /whatsapp/send/location    # Send location
POST /whatsapp/send/buttons     # Send interactive buttons
POST /whatsapp/mark-read        # Mark message as read
```

### Media
```
GET /whatsapp/media/:mediaId            # Get media metadata
GET /whatsapp/media/:mediaId/download   # Proxy media binary
```

### System
```
GET /health   # Health check
```

## Development

### Installation
```bash
npm install
```

### Running Locally
```bash
npm run dev
```

### Running in Production
```bash
npm start
```

### Testing
```bash
npm test
```

## Docker Deployment

Build the image:
```bash
docker build -t whatsapp-api-service .
```

Run the container:
```bash
docker run -p 3008:3008 --env-file .env whatsapp-api-service
```

## Dependencies

- **express**: Web framework
- **axios**: HTTP client
- **dotenv**: Environment configuration
