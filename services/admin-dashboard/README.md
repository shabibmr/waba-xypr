# Admin Dashboard

The primary management interface for the Xypr platform. Allows administrators to configure tenants, manage credentials, and monitor system health.

- **Tenant Onboarding**: Wizard-style flow to create new tenants and link Genesys/WhatsApp accounts.
- **Service Monitoring**: Real-time health checks of all microservices.
- **Configuration Management**: Update WhatsApp Business settings and Genesys OAuth credentials.
- **User Management**: View and manage system users.

## Architecture

```
┌─────────────────┐       ┌────────────────────┐       ┌─────────────────┐
│  Admin User     │──────▶│  Admin Dashboard   │──────▶│   API Gateway   │
│                 │       │   (React / Vite)   │       │                 │
└─────────────────┘       └────────────────────┘       └─────────────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │ Microservices   │
                                                  │ (Tenant/Health) │
                                                  └─────────────────┘
```

## Project Structure

```
src/
├── components/      # UI Components (Sidebar, Forms)
├── pages/           # Dashboard Pages
│   ├── Dashboard.jsx
│   ├── Tenants.jsx
│   └── Settings.jsx
├── services/        # API communication
├── utils/           # Utilities
├── App.jsx
└── main.jsx
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_GATEWAY` | API Gateway URL | `http://localhost:3000` |
| `VITE_META_APP_ID` | Meta App ID (Signup) | *Required* |
| `VITE_META_CONFIG_ID` | Meta Config ID | *Required* |

## Development

### Installation
```bash
npm install
```

### Running Locally
```bash
npm run dev
```
Access at `http://localhost:3006`

### Building
```bash
npm run build
```

## Docker Deployment

Build the image:
```bash
docker build -t admin-dashboard .
```

Run the container:
```bash
docker run -p 3006:80 \
  -e VITE_API_GATEWAY=http://api-gateway:3000 \
  admin-dashboard
```

## Dependencies

- **react**: UI library
- **vite**: Build tool
- **lucide-react**: Icons
- **axios**: HTTP client
