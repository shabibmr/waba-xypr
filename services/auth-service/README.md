# Auth Service

OAuth 2.0 token management service for Genesys Cloud integration. Handles authentication, token caching, and OAuth flows for the WhatsApp-Genesys integration platform.

## Features

- **OAuth 2.0 Client Credentials Flow**: Automatic token generation and renewal
- **Token Caching**: Redis-based caching to minimize API calls
- **OAuth Authorization Code Flow**: Support for user-initiated Genesys login
- **Token Validation**: Endpoint to verify token validity
- **Health Monitoring**: Redis connection health checks

## Architecture

This service acts as the central authentication provider for all Genesys Cloud API interactions.

```
[Genesys API Service] ──┐
[Genesys Webhook]      ──┼──> [Auth Service] ──> [Genesys Cloud OAuth]
[State Manager]        ──┘          |
                                    v
                                [Redis Cache]
```

## Prerequisites

- **Node.js**: v18+
- **Redis**: For token caching
- **Genesys Cloud Credentials**: Client ID and Secret

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service Port | `3004` |
| `REDIS_URL` | Redis Connection URL | `redis://localhost:6379` |
| `GENESYS_CLIENT_ID` | Genesys OAuth Client ID | *Required* |
| `GENESYS_CLIENT_SECRET` | Genesys OAuth Client Secret | *Required* |
| `GENESYS_REGION` | Genesys Cloud Region | `mypurecloud.com` |
| `GENESYS_REDIRECT_URI` | OAuth Callback URI | `http://localhost:3006/auth/callback` |

## Installation & Running

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run in production
npm start

# Run tests
npm test
```

## API Reference

### Token Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/token` | Get valid OAuth token (cached or new) |
| POST | `/auth/refresh` | Force token refresh (clears cache) |
| POST | `/auth/validate` | Validate a token |
| GET | `/auth/info` | Get cached token information |

**Example: Get Token**
```bash
GET /auth/token
Response:
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "type": "Bearer"
}
```

**Example: Validate Token**
```bash
POST /auth/validate
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
Response:
{
  "valid": true
}
```

### OAuth Authorization Flow

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/genesys/login` | Initiate OAuth login flow |
| GET | `/auth/genesys/callback` | OAuth callback handler |

**OAuth Flow**:
1. User navigates to `/auth/genesys/login`
2. Redirected to Genesys login page
3. After authentication, Genesys redirects to `/auth/genesys/callback`
4. Service exchanges authorization code for tokens
5. Returns organization details to client via `postMessage`

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service and Redis health status |

## Token Caching Strategy

- Tokens are cached in Redis with a TTL of 23 hours (Genesys tokens expire in 24 hours)
- Automatic refresh when cached token expires
- Cache key: `genesys:oauth:token`

## Error Handling

All endpoints return standardized error responses:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Invalid request
- `401`: Invalid token
- `500`: Server error
- `503`: Service unhealthy (Redis disconnected)

## Project Structure

```
src/
└── index.js        # Main service file with all endpoints and logic
tests/
├── api/            # API integration tests
├── fixtures/       # Test data
├── mocks/          # Service mocks (Redis)
└── setup.js        # Test configuration
```

## Dependencies

- `express`: Web framework
- `axios`: HTTP client for Genesys API calls
- `redis`: Token caching
- `dotenv`: Environment configuration

## Docker

```bash
# Build image
docker build -t auth-service .

# Run container
docker run -p 3004:3004 \
  -e GENESYS_CLIENT_ID=your_client_id \
  -e GENESYS_CLIENT_SECRET=your_secret \
  -e REDIS_URL=redis://redis:6379 \
  auth-service
```

## Security Considerations

- **Never expose** `GENESYS_CLIENT_SECRET` in logs or responses
- Use HTTPS in production for OAuth callbacks
- Implement rate limiting for token endpoints
- Rotate client credentials periodically
