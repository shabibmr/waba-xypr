# Build All Services Script
# Builds all Docker images for the WhatsApp-Genesys integration

param(
    [string]$Environment = "development",
    [switch]$NoCache,
    [switch]$Parallel
)

# Add Docker to PATH
$env:PATH = "E:\docker\resources\bin;$env:PATH"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Building WhatsApp-Genesys Services" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Set Docker Compose file based on environment
$composeFile = switch ($Environment) {
    "development" { "docker-compose.dev.yml" }
    "production" { "docker-compose.prod.yml" }
    default { "docker-compose.yml" }
}

# Build command
$buildCmd = "docker compose -f $composeFile build"

if ($NoCache) {
    $buildCmd += " --no-cache"
}

if ($Parallel) {
    $buildCmd += " --parallel"
}

Write-Host "Executing: $buildCmd" -ForegroundColor Yellow
Write-Host ""

# Execute build
try {
    Invoke-Expression $buildCmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=====================================" -ForegroundColor Green
        Write-Host "✓ Build completed successfully!" -ForegroundColor Green
        Write-Host "=====================================" -ForegroundColor Green
        Write-Host ""
        
        # List built images
        Write-Host "Built images:" -ForegroundColor Cyan
        docker images | Select-String "whatsapp"
    } else {
        Write-Host ""
        Write-Host "=====================================" -ForegroundColor Red
        Write-Host "✗ Build failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "=====================================" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host "Error during build: $_" -ForegroundColor Red
    exit 1
}
