# WhatsApp-Genesys Shutdown Script
# This script stops all running containers

# Add Docker to PATH
if ($env:PATH -notlike "*E:\docker\resources\bin*") {
    $env:PATH = "E:\docker\resources\bin;$env:PATH"
}

Write-Host "Stopping all services..." -ForegroundColor Yellow
docker compose -f docker-compose.yml -f docker-compose.dev.yml down

Write-Host "Stopping infrastructure..." -ForegroundColor Yellow
docker compose -f docker-compose.infra.yml down

Write-Host "`nAll services stopped." -ForegroundColor Green
