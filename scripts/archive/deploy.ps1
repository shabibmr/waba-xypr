# Deploy Script
# Deploys services to production environment

param(
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action = "start",
    [switch]$Build,
    [switch]$Detached = $true
)

# Add Docker to PATH
$env:PATH = "E:\docker\resources\bin;$env:PATH"

$composeFile = "docker-compose.prod.yml"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "WhatsApp-Genesys Deployment" -ForegroundColor Cyan
Write-Host "Action: $Action" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

switch ($Action) {
    "start" {
        Write-Host "Starting services..." -ForegroundColor Yellow
        
        if ($Build) {
            Write-Host "Building images first..." -ForegroundColor Yellow
            docker compose -f $composeFile build
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Build failed!" -ForegroundColor Red
                exit 1
            }
        }
        
        $startCmd = "docker compose -f $composeFile up"
        if ($Detached) {
            $startCmd += " -d"
        }
        
        Invoke-Expression $startCmd
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✓ Services started successfully!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Checking health status..." -ForegroundColor Yellow
            Start-Sleep -Seconds 10
            & "$PSScriptRoot\health-check.ps1"
        } else {
            Write-Host "Failed to start services!" -ForegroundColor Red
            exit 1
        }
    }
    
    "stop" {
        Write-Host "Stopping services..." -ForegroundColor Yellow
        docker compose -f $composeFile down
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Services stopped successfully!" -ForegroundColor Green
        } else {
            Write-Host "Failed to stop services!" -ForegroundColor Red
            exit 1
        }
    }
    
    "restart" {
        Write-Host "Restarting services..." -ForegroundColor Yellow
        docker compose -f $composeFile restart
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Services restarted successfully!" -ForegroundColor Green
        } else {
            Write-Host "Failed to restart services!" -ForegroundColor Red
            exit 1
        }
    }
    
    "status" {
        Write-Host "Service status:" -ForegroundColor Yellow
        Write-Host ""
        docker compose -f $composeFile ps
        Write-Host ""
        & "$PSScriptRoot\health-check.ps1"
    }
}
