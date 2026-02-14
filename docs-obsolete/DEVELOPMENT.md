# Development Guide

Complete guide for developing and contributing to the WhatsApp-Genesys Cloud Integration Platform.

## Local Development Setup

### Prerequisites

- **Node.js** 20+ and npm
- **Docker Desktop** with Docker Compose
- **Git** for version control
- **PowerShell** 7+ (Windows) or Bash (Linux/Mac)
- **Code Editor** (VS Code recommended)

### Initial Setup

1. **Clone Repository**:
   ```bash
   git clone <repository-url>
   cd whatsapp-genesys-integration
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   ```powershell
   # Copy example environment file
   cp .env.example .env
   
   # Edit .env with your credentials
   # Required: META_APP_SECRET, META_VERIFY_TOKEN, GENESYS_CLIENT_ID, GENESYS_CLIENT_SECRET
   ```

4. **Start Infrastructure**:
   ```powershell
   docker-compose -f docker-compose.infra.yml up -d
   ```

5. **Run Database Migrations**:
   ```powershell
   .\scripts\db-migrate.ps1 -Action up
   ```

6. **Start Services**:
   ```powershell
   # Development mode with hot reload
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
   ```

7. **Verify Setup**:
   ```powershell
   .\scripts\health-check.ps1
   ```

## Development Workflow

### Running Services Locally

#### Option 1: All Services in Docker (Recommended)
```powershell
# Start all services with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View logs
docker-compose logs -f [service-name]

# Restart specific service
docker-compose restart [service-name]
```

#### Option 2: Hybrid (Infrastructure in Docker, Services Locally)
```powershell
# Start infrastructure only
docker-compose -f docker-compose.infra.yml up -d

# Run service locally
cd services/api-gateway
npm install
npm run dev
```

### Hot Reload Configuration

Development mode enables hot reload using `nodemon`:

```json
// package.json
{
  "scripts": {
    "dev": "nodemon src/index.js"
  }
}
```

**Nodemon Configuration** (`nodemon.json`):
```json
{
  "watch": ["src"],
  "ext": "js,json",
  "ignore": ["src/**/*.test.js"],
  "exec": "node src/index.js"
}
```

### Debugging

#### VS Code Debug Configuration

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Docker: Attach to Node",
      "remoteRoot": "/app",
      "localRoot": "${workspaceFolder}/services/api-gateway",
      "port": 9229,
      "restart": true,
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

**Enable Debug Mode**:
```yaml
# docker-compose.dev.yml
services:
  api-gateway:
    command: node --inspect=0.0.0.0:9229 src/index.js
    ports:
      - "9229:9229"
```

#### Console Debugging
```javascript
// Add debug logs
console.log('[DEBUG]', { tenantId, messageId, timestamp });

// Use DEBUG environment variable
DEBUG=* npm run dev
```

## Code Organization

### Service Structure

All services follow this standard structure:

```
service-name/
├── src/
│   ├── config/           # Configuration
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Custom middleware
│   ├── models/           # Database models (if applicable)
│   ├── routes/           # Express routes
│   ├── services/         # Business logic
│   ├── utils/            # Utilities
│   └── index.js          # Entry point
├── tests/
│   ├── api/              # API tests
│   ├── fixtures/         # Test data
│   ├── mocks/            # Mocks
│   └── setup.js          # Test setup
├── Dockerfile
├── package.json
├── README.md
└── .env.example
```

### Naming Conventions

**Files**:
- `camelCase.js` for modules
- `PascalCase.js` for classes
- `kebab-case.js` for routes

**Variables**:
```javascript
const CONSTANT_VALUE = 'value';     // Constants
const variableName = 'value';       // Variables
function functionName() {}          // Functions
class ClassName {}                  // Classes
```

**Database**:
- Tables: `snake_case` (e.g., `conversation_mappings`)
- Columns: `snake_case` (e.g., `tenant_id`, `created_at`)

## Adding New Services

### 1. Create Service Directory

```powershell
mkdir services/new-service
cd services/new-service
npm init -y
```

### 2. Install Dependencies

```bash
npm install express axios dotenv
npm install --save-dev nodemon jest supertest
```

### 3. Create Standard Structure

```powershell
mkdir src src/config src/controllers src/routes src/services src/utils
mkdir tests tests/api tests/mocks
```

### 4. Create Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

### 5. Add to Docker Compose

```yaml
# docker-compose.yml
services:
  new-service:
    build: ./services/new-service
    ports:
      - "3013:3000"
    environment:
      - PORT=3000
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
```

### 6. Add to Shared Constants

```javascript
// shared/constants/services.js
NEW_SERVICE: {
  name: 'new-service',
  port: 3013,
  url: 'http://new-service:3000'
}
```

### 7. Create README

See [service README template](../services/api-gateway/README.md) for reference.

## Database Management

### Running Migrations

```powershell
# Apply all pending migrations
.\scripts\db-migrate.ps1 -Action up

# Rollback last migration
.\scripts\db-migrate.ps1 -Action down

# Check migration status
.\scripts\db-migrate.ps1 -Action status
```

### Creating Migrations

```sql
-- migrations/001_create_tenants.sql
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenants_status ON tenants(status);
```

### Database Access

```bash
# Connect to PostgreSQL
docker exec -it postgres psql -U postgres -d whatsapp_genesys

# Run query
SELECT * FROM tenants;

# Export data
docker exec -it postgres pg_dump -U postgres whatsapp_genesys > backup.sql
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific service
cd services/api-gateway
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Writing Tests

```javascript
// tests/api/service.test.js
const request = require('supertest');
const app = require('../../src/index');
const MockHelpers = require('../../../tests/utils/mock-helpers');

describe('API Gateway', () => {
  beforeAll(() => MockHelpers.activateAll());
  afterAll(() => MockHelpers.deactivateAll());
  beforeEach(() => MockHelpers.resetAll());

  it('should return health status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });
});
```

### Using Mocks

See [tests/MOCK_USAGE.md](../tests/MOCK_USAGE.md) for detailed mock usage examples.

## Environment Management

### Environment Files

- `.env` - Local development (gitignored)
- `.env.example` - Template with all variables
- `.env.production` - Production values (gitignored)

### Required Variables

```bash
# Meta WhatsApp
META_APP_SECRET=your_app_secret
META_VERIFY_TOKEN=your_verify_token

# Genesys Cloud
GENESYS_CLIENT_ID=your_client_id
GENESYS_CLIENT_SECRET=your_client_secret
GENESYS_REGION=mypurecloud.com

# Infrastructure
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
DATABASE_URL=postgresql://postgres:password@localhost:5432/whatsapp_genesys
```

### Loading Environment

```javascript
// Load at app startup
require('dotenv').config();

const port = process.env.PORT || 3000;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
```

## Git Workflow

### Branch Strategy

```
main
  ├── develop
  │   ├── feature/add-new-service
  │   ├── feature/improve-logging
  │   └── bugfix/fix-webhook-validation
  └── hotfix/critical-security-patch
```

### Commit Messages

Follow conventional commits:

```
feat: add support for WhatsApp stickers
fix: resolve token caching issue
docs: update API documentation
refactor: extract message transformer logic
test: add integration tests for webhooks
chore: update dependencies
```

### Pull Request Process

1. Create feature branch from `develop`
2. Make changes and commit
3. Write/update tests
4. Update documentation
5. Push and create PR
6. Request code review
7. Address feedback
8. Merge after approval

## Code Quality

### Linting

```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint:fix
```

**ESLint Configuration** (`.eslintrc.json`):
```json
{
  "env": {
    "node": true,
    "es2021": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 12
  },
  "rules": {
    "indent": ["error", 2],
    "quotes": ["error", "single"],
    "semi": ["error", "always"]
  }
}
```

### Code Review Checklist

- [ ] Code follows project conventions
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] No console.logs in production code
- [ ] Error handling implemented
- [ ] Environment variables documented
- [ ] No hardcoded credentials
- [ ] Shared constants used where applicable

## Performance Optimization

### Profiling

```javascript
// Add timing logs
const start = Date.now();
await processMessage(message);
console.log(`Processing took ${Date.now() - start}ms`);
```

### Caching Strategy

```javascript
// Check cache first
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// Fetch and cache
const data = await fetchFromAPI();
await redis.setEx(cacheKey, 3600, JSON.stringify(data));
return data;
```

### Database Optimization

```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_messages_tenant_id ON messages(tenant_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
```

## Deployment

### Building for Production

```powershell
# Build all services
.\scripts\build-all.ps1 -Environment production

# Build specific service
docker build -t api-gateway:latest ./services/api-gateway
```

### Deployment Script

```powershell
# Deploy to production
.\scripts\deploy.ps1 -Action start -Build

# Stop services
.\scripts\deploy.ps1 -Action stop

# Restart services
.\scripts\deploy.ps1 -Action restart
```

## Useful Commands

### Docker

```powershell
# View running containers
docker ps

# View all containers
docker ps -a

# View logs
docker logs -f container-name

# Execute command in container
docker exec -it container-name sh

# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Full cleanup
docker system prune -a
```

### Database

```bash
# Backup
docker exec -it postgres pg_dump -U postgres whatsapp_genesys > backup.sql

# Restore
docker exec -i postgres psql -U postgres whatsapp_genesys < backup.sql

# Reset database
docker exec -it postgres psql -U postgres -c "DROP DATABASE whatsapp_genesys;"
docker exec -it postgres psql -U postgres -c "CREATE DATABASE whatsapp_genesys;"
```

### Redis

```bash
# Monitor commands
docker exec -it redis redis-cli MONITOR

# Clear cache
docker exec -it redis redis-cli FLUSHDB

# Get memory usage
docker exec -it redis redis-cli INFO memory
```

## Resources

- [Architecture Overview](architecture/README.md)
- [API Documentation](api-documentation.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)
- [Testing Guide](../tests/README.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
