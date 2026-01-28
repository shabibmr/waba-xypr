# Quick Start Script - Local Testing
# This script automates the local testing setup process

param(
    [switch]$StopOnly,
    [switch]$CleanAll,
    [switch]$SkipInfra
)

# Add Docker to PATH
$env:PATH = "E:\docker\resources\bin;$env:PATH"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "WhatsApp-Genesys Local Testing" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if Docker is running
function Test-DockerRunning {
    try {
        docker ps | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Check if Docker Desktop is running
Write-Host "Checking Docker status..." -NoNewline
if (-not (Test-DockerRunning)) {
    Write-Host " ✗ Docker Desktop is not running" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start Docker Desktop and wait for it to be ready, then run this script again." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To start Docker Desktop:" -ForegroundColor Cyan
    Write-Host "  1. Open Docker Desktop from Start Menu" -ForegroundColor White
    Write-Host "  2. Wait for the whale icon in system tray to be stable" -ForegroundColor White
    Write-Host "  3. Run this script again" -ForegroundColor White
    Write-Host ""
    exit 1
}
Write-Host " ✓ Docker is running" -ForegroundColor Green

# Handle cleanup
if ($CleanAll) {
    Write-Host ""
    Write-Host "Cleaning up all containers and volumes..." -ForegroundColor Yellow
    docker compose down -v
    docker compose -f docker-compose.infra.yml down -v
    Write-Host "✓ Cleanup complete" -ForegroundColor Green
    exit 0
}

# Handle stop only
if ($StopOnly) {
    Write-Host ""
    Write-Host "Stopping all services..." -ForegroundColor Yellow
    docker compose down
    docker compose -f docker-compose.infra.yml down
    Write-Host "✓ All services stopped" -ForegroundColor Green
    exit 0
}

# Start infrastructure services
if (-not $SkipInfra) {
    Write-Host ""
    Write-Host "Starting infrastructure services..." -ForegroundColor Cyan
    Write-Host "  - PostgreSQL" -ForegroundColor White
    Write-Host "  - Redis" -ForegroundColor White
    Write-Host "  - RabbitMQ" -ForegroundColor White
    Write-Host ""
    
    docker compose -f docker-compose.infra.yml up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to start infrastructure services" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Infrastructure services started" -ForegroundColor Green
    Write-Host ""
    Write-Host "Waiting for services to be healthy (30 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    # Check infrastructure health
    Write-Host ""
    Write-Host "Checking infrastructure health..." -ForegroundColor Cyan
    docker compose -f docker-compose.infra.yml ps
}

# Start all microservices
Write-Host ""
Write-Host "Starting all microservices..." -ForegroundColor Cyan
Write-Host "  This may take 2-3 minutes for first build..." -ForegroundColor Yellow
Write-Host ""

docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to start microservices" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running with infrastructure only:" -ForegroundColor Yellow
    Write-Host "  docker compose -f docker-compose.infra.yml up -d" -ForegroundColor White
    exit 1
}

Write-Host "✓ All services started" -ForegroundColor Green
Write-Host ""
Write-Host "Waiting for services to initialize (30 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Run health check
Write-Host ""
Write-Host "Running health check..." -ForegroundColor Cyan
Write-Host ""
.\scripts\health-check.ps1

# Display access information
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Services are ready!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Web Interfaces:" -ForegroundColor Cyan
Write-Host "  Admin Dashboard:      http://localhost:3006" -ForegroundColor White
Write-Host "  Agent Widget:         http://localhost:3012" -ForegroundColor White
Write-Host "  RabbitMQ Management:  http://localhost:15672 (admin/admin123)" -ForegroundColor White
Write-Host "  API Gateway:          http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "API Documentation (Swagger):" -ForegroundColor Cyan
Write-Host "  API Gateway:          http://localhost:3000/api-docs" -ForegroundColor White
Write-Host "  Tenant Service:       http://localhost:3007/api-docs" -ForegroundColor White
Write-Host "  WhatsApp Webhook:     http://localhost:3009/api-docs" -ForegroundColor White
Write-Host "  Genesys Webhook:      http://localhost:3011/api-docs" -ForegroundColor White
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Cyan
Write-Host "  View all logs:        docker compose logs -f" -ForegroundColor White
Write-Host "  View service logs:    docker compose logs -f [service-name]" -ForegroundColor White
Write-Host "  Stop all services:    .\scripts\start-local.ps1 -StopOnly" -ForegroundColor White
Write-Host "  Clean everything:     .\scripts\start-local.ps1 -CleanAll" -ForegroundColor White
Write-Host ""
Write-Host "For detailed testing guide, see: local_testing_guide.md" -ForegroundColor Yellow
Write-Host ""
