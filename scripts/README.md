# Scripts Documentation

Utility scripts for building, deploying, and managing the WhatsApp-Genesys Cloud Integration Platform.

## Overview

The `scripts/` directory contains PowerShell scripts for common development and deployment tasks. All scripts are designed to work on Windows with PowerShell 7+.

## Available Scripts

### build-all.ps1

Builds all Docker images for the platform.

**Usage**:
```powershell
.\scripts\build-all.ps1 [-Environment <string>] [-NoCache] [-Parallel]
```

**Parameters**:
- `-Environment`: Target environment (`development`, `production`). Default: `development`
- `-NoCache`: Build without using Docker cache
- `-Parallel`: Build images in parallel for faster builds

**Examples**:
```powershell
# Build for development
.\scripts\build-all.ps1

# Build for production without cache
.\scripts\build-all.ps1 -Environment production -NoCache

# Build in parallel
.\scripts\build-all.ps1 -Parallel
```

**What it does**:
1. Sets Docker path
2. Selects appropriate docker-compose file
3. Builds all service images
4. Lists built images on success

---

### deploy.ps1

Deploys services to production environment.

**Usage**:
```powershell
.\scripts\deploy.ps1 [-Action <string>] [-Build] [-Detached]
```

**Parameters**:
- `-Action`: Deployment action (`start`, `stop`, `restart`, `status`). Default: `start`
- `-Build`: Build images before starting
- `-Detached`: Run in detached mode. Default: `true`

**Examples**:
```powershell
# Start services
.\scripts\deploy.ps1 -Action start

# Start with fresh build
.\scripts\deploy.ps1 -Action start -Build

# Stop all services
.\scripts\deploy.ps1 -Action stop

# Restart services
.\scripts\deploy.ps1 -Action restart

# Check status
.\scripts\deploy.ps1 -Action status
```

**What it does**:
- **start**: Starts all production services, optionally builds first, runs health check
- **stop**: Stops all services gracefully
- **restart**: Restarts all services
- **status**: Shows service status and health

---

### health-check.ps1

Verifies all services are healthy and responding.

**Usage**:
```powershell
.\scripts\health-check.ps1 [-Environment <string>] [-Timeout <int>]
```

**Parameters**:
- `-Environment`: Target environment. Default: `development`
- `-Timeout`: Health check timeout in seconds. Default: `60`

**Examples**:
```powershell
# Check all services
.\scripts\health-check.ps1

# Check with custom timeout
.\scripts\health-check.ps1 -Timeout 120
```

**What it does**:
1. Checks if each container is running
2. Verifies health status (if health check configured)
3. Reports summary of healthy/unhealthy services
4. Exits with code 1 if any service is unhealthy

**Checked Services**:
- PostgreSQL
- Redis
- RabbitMQ
- All microservices (13 services)

**Output**:
```
Checking PostgreSQL... ✓ Healthy
Checking Redis... ✓ Healthy
Checking RabbitMQ... ✓ Healthy
...
=====================================
Summary:
  Healthy: 16
  Unhealthy: 0
=====================================
✓ All services are healthy!
```

---

### db-migrate.ps1

Manages database migrations.

**Usage**:
```powershell
.\scripts\db-migrate.ps1 [-Action <string>] [-MigrationName <string>]
```

**Parameters**:
- `-Action`: Migration action (`up`, `down`, `status`, `create`). Default: `up`
- `-MigrationName`: Name for new migration (required for `create` action)

**Examples**:
```powershell
# Apply all pending migrations
.\scripts\db-migrate.ps1 -Action up

# Rollback last migration
.\scripts\db-migrate.ps1 -Action down

# Check migration status
.\scripts\db-migrate.ps1 -Action status

# Create new migration
.\scripts\db-migrate.ps1 -Action create -MigrationName "add_user_table"
```

**What it does**:
- **up**: Applies pending migrations to database
- **down**: Rolls back the last applied migration
- **status**: Shows which migrations have been applied
- **create**: Creates a new migration file template

**Migration Files**:
```
migrations/
├── 001_create_tenants.sql
├── 002_create_conversations.sql
└── 003_create_messages.sql
```

---

## Common Workflows

### Initial Setup

```powershell
# 1. Start infrastructure
docker-compose -f docker-compose.infra.yml up -d

# 2. Run migrations
.\scripts\db-migrate.ps1 -Action up

# 3. Build services
.\scripts\build-all.ps1

# 4. Start services
.\scripts\deploy.ps1 -Action start

# 5. Verify health
.\scripts\health-check.ps1
```

### Development Workflow

```powershell
# Start development environment
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Check health
.\scripts\health-check.ps1

# View logs
docker-compose logs -f service-name

# Rebuild after changes
.\scripts\build-all.ps1
docker-compose restart service-name
```

### Production Deployment

```powershell
# Build and deploy
.\scripts\deploy.ps1 -Action start -Build

# Verify deployment
.\scripts\health-check.ps1

# Check status
.\scripts\deploy.ps1 -Action status

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Troubleshooting

```powershell
# Check service status
.\scripts\deploy.ps1 -Action status

# Run health check
.\scripts\health-check.ps1

# Restart unhealthy services
.\scripts\deploy.ps1 -Action restart

# Rebuild from scratch
.\scripts\build-all.ps1 -NoCache
.\scripts\deploy.ps1 -Action start
```

## Environment Variables

Scripts use environment variables from `.env` file:

```bash
# Docker configuration
DOCKER_PATH=E:\docker\resources\bin

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/whatsapp_genesys

# Services
COMPOSE_PROJECT_NAME=whatsapp-genesys
```

## Exit Codes

All scripts follow standard exit code conventions:

- `0`: Success
- `1`: Error or failure
- `2`: Invalid arguments

## Error Handling

Scripts include error handling for common issues:

```powershell
# Example from build-all.ps1
try {
    Invoke-Expression $buildCmd
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Build completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "✗ Build failed" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host "Error during build: $_" -ForegroundColor Red
    exit 1
}
```

## Customization

### Adding New Scripts

1. Create script in `scripts/` directory
2. Follow naming convention: `action-name.ps1`
3. Include parameter validation
4. Add error handling
5. Document in this README

### Modifying Existing Scripts

1. Test changes locally first
2. Update documentation
3. Maintain backward compatibility
4. Add version comments if breaking changes

## Script Development Guidelines

### Structure

```powershell
# Script description
# Purpose and usage

param(
    [ValidateSet("option1", "option2")]
    [string]$Parameter = "default",
    [switch]$Flag
)

# Configuration
$env:PATH = "E:\docker\resources\bin;$env:PATH"

# Header
Write-Host "Script Name" -ForegroundColor Cyan

# Main logic
try {
    # Do work
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Success" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
```

### Best Practices

1. **Use parameter validation**: `[ValidateSet()]`, `[ValidateNotNullOrEmpty()]`
2. **Provide defaults**: All parameters should have sensible defaults
3. **Include help**: Add comment-based help at top of script
4. **Handle errors**: Use try/catch and check `$LASTEXITCODE`
5. **Colorize output**: Use `-ForegroundColor` for better readability
6. **Exit with codes**: Return appropriate exit codes
7. **Document**: Update this README when adding/changing scripts

## Troubleshooting

### Docker Path Issues

If scripts can't find Docker:

```powershell
# Add Docker to PATH permanently
$env:PATH = "E:\docker\resources\bin;$env:PATH"
[Environment]::SetEnvironmentVariable("PATH", $env:PATH, "User")
```

### Permission Issues

Run PowerShell as Administrator if needed:

```powershell
# Check execution policy
Get-ExecutionPolicy

# Set execution policy (if needed)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Script Not Found

Ensure you're in the project root:

```powershell
# Check current directory
Get-Location

# Navigate to project root
cd path\to\whatsapp-genesys-integration
```

## Related Documentation

- [Development Guide](../docs/DEVELOPMENT.md)
- [Deployment Guide](../docs/deployment/refined-setup-guide.md)
- [Troubleshooting Guide](../docs/TROUBLESHOOTING.md)
