# Auth Service

OAuth 2.0 token management service for Genesys Cloud integration. Handles authentication, token caching, and OAuth flows for the WhatsApp-Genesys integration platform.

- **OAuth 2.0 Client Credentials**: Automatic token generation and management.
- **Token Caching**: Redis-based caching to minimize latency and API calls.
- **Authorization Code Flow**: Support for user-initiated Genesys login.
- **Token Validation**: Utilities to verify token validity.

## Architecture

```
┌─────────────────┐       ┌──────────────────┐      ┌─────────────────┐
│  Genesys API    │──────▶│   Auth Service   │─────▶│  Genesys Cloud  │
│  Service        │       └──────────────────┘      │  OAuth Server   │
└─────────────────┘                │                └─────────────────┘
                                   │
                                   ▼
                            ┌─────────────┐
                            │ Redis Cache │
                            └─────────────┘
```

## Project Structure

```
src/
├── controllers/
│   ├── auth.controller.js      # Auth endpoints
│   └── health.controller.js    # Health check
├── services/
│   ├── auth.service.js         # Token logic
│   ├── genesys-auth.service.js # Genesys API interaction
│   └── redis.service.js        # Cache management
├── routes/
│   └── index.js                # Route definitions
└── index.js                    # App entry point
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service Port | `3004` |
| `NODE_ENV` | Environment | `development` |
| `REDIS_URL` | Redis Connection URL | `redis://localhost:6379` |
| `GENESYS_CLIENT_ID` | Genesys OAuth Client ID | *Required* |
| `GENESYS_CLIENT_SECRET` | Genesys OAuth Client Secret | *Required* |
| `GENESYS_REGION` | Genesys Cloud Region | `mypurecloud.com` |
| `GENESYS_REDIRECT_URI` | OAuth Callback URI | `http://localhost:3006/auth/callback` |

## API Endpoints

### Token Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/token` | Get valid OAuth token (cached or new) |
| POST | `/auth/refresh` | Force token refresh (clears cache) |
| POST | `/auth/validate` | Validate a token string |
| GET | `/auth/info` | Get cached token details |

### OAuth Flow

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/genesys/login` | Initiate user login flow |
| GET | `/auth/genesys/callback` | Handle OAuth callback |

### System
```
GET /health
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
docker build -t auth-service .
```

Run the container:
```bash
docker run -p 3004:3004 --env-file .env auth-service
```

## Dependencies

- **express**: Web framework
- **axios**: HTTP client
- **redis**: Token caching
- **dotenv**: Environment configuration
