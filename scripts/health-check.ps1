# Health Check Script
# Verifies all services are healthy and responding

param(
    [string]$Environment = "development",
    [int]$Timeout = 60
)

# Add Docker to PATH
$env:PATH = "E:\docker\resources\bin;$env:PATH"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Health Check - WhatsApp-Genesys Services" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Services to check
$services = @(
    @{Name="PostgreSQL"; Container="whatsapp-postgres"; Port=5432},
    @{Name="Redis"; Container="whatsapp-redis"; Port=6379},
    @{Name="RabbitMQ"; Container="whatsapp-rabbitmq"; Port=5672},
    @{Name="Tenant Service"; Container="whatsapp-tenant-service"; Port=3007},
    @{Name="Auth Service"; Container="whatsapp-auth-service"; Port=3004},
    @{Name="State Manager"; Container="whatsapp-state-manager"; Port=3005},
    @{Name="WhatsApp Webhook"; Container="whatsapp-webhook"; Port=3009},
    @{Name="WhatsApp API"; Container="whatsapp-api"; Port=3008},
    @{Name="Genesys Webhook"; Container="genesys-webhook"; Port=3011},
    @{Name="Genesys API"; Container="genesys-api"; Port=3010},
    @{Name="Inbound Transformer"; Container="whatsapp-inbound-transformer"; Port=3002},
    @{Name="Outbound Transformer"; Container="whatsapp-outbound-transformer"; Port=3003},
    @{Name="API Gateway"; Container="whatsapp-api-gateway"; Port=3000},
    @{Name="Agent Widget"; Container="whatsapp-agent-widget"; Port=3012},
    @{Name="Admin Dashboard"; Container="whatsapp-admin-dashboard"; Port=80}
)

$healthyCount = 0
$unhealthyCount = 0

foreach ($service in $services) {
    Write-Host "Checking $($service.Name)..." -NoNewline
    
    # Check if container is running
    $containerStatus = docker inspect -f '{{.State.Status}}' $service.Container 2>$null
    
    if ($containerStatus -eq "running") {
        # Check health status if available
        $healthStatus = docker inspect -f '{{.State.Health.Status}}' $service.Container 2>$null
        
        if ($healthStatus -eq "healthy" -or $healthStatus -eq "") {
            Write-Host " ✓ Healthy" -ForegroundColor Green
            $healthyCount++
        } else {
            Write-Host " ⚠ Unhealthy (Status: $healthStatus)" -ForegroundColor Yellow
            $unhealthyCount++
        }
    } else {
        Write-Host " ✗ Not Running" -ForegroundColor Red
        $unhealthyCount++
    }
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Healthy: $healthyCount" -ForegroundColor Green
Write-Host "  Unhealthy: $unhealthyCount" -ForegroundColor $(if ($unhealthyCount -gt 0) { "Red" } else { "Green" })
Write-Host "=====================================" -ForegroundColor Cyan

if ($unhealthyCount -gt 0) {
    exit 1
} else {
    Write-Host ""
    Write-Host "✓ All services are healthy!" -ForegroundColor Green
    exit 0
}
