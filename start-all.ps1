# WhatsApp-Genesys Startup Script
# This script starts both infrastructure and application services

# Add Docker to PATH (adjust if your installation path is different)
if ($env:PATH -notlike "*E:\docker\resources\bin*") {
    $env:PATH = "E:\docker\resources\bin;$env:PATH"
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   WhatsApp-Genesys System Startup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Start Infrastructure (DB, Cache, MQ)
Write-Host "`n[1/2] Starting Infrastructure Services..." -ForegroundColor Yellow
docker compose -f docker-compose.infra.yml up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: Failed to start infrastructure services." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 2. Start Application Services (Dev Mode with Hot Reload)
Write-Host "`n[2/2] Starting Application Services (Development Mode)..." -ForegroundColor Yellow
Write-Host "This will build and start all microservices. First run might take a while." -ForegroundColor Gray
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: Failed to start application services." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host "   System started successfully!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

# Run health check if existing script is available
if (Test-Path ".\scripts\health-check.ps1") {
    Write-Host "Running health check..." -ForegroundColor Cyan
    .\scripts\health-check.ps1
} else {
    docker compose ps
}

Write-Host "`nUseful Commands:" -ForegroundColor Cyan
Write-Host "  View logs:      docker compose logs -f" -ForegroundColor White
Write-Host "  Stop services:  docker compose down" -ForegroundColor White
Write-Host ""
