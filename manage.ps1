# WhatsApp-Genesys Management Script
# Unified tool for Start, Stop, Restart, Status, and Clean operations.

param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("start", "stop", "restart", "status", "clean", "logs")]
    [string]$Command,

    [switch]$InfraOnly,
    [switch]$Prod
)

# Configuration
$Env:PATH = "E:\docker\resources\bin;$Env:PATH"
$ComposeDev = "docker-compose.yml", "docker-compose.dev.yml"
$ComposeProd = "docker-compose.prod.yml"
$ComposeInfra = "docker-compose.infra.yml"

# Ports to check/kill during restart
$PortsToCheck = @(5432, 6379, 5672, 3000, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012)

function Get-ComposeFiles {
    if ($InfraOnly) { return @($ComposeInfra) }
    if ($Prod) { return @($ComposeProd) }
    # Dev mode: Start Infra + Dev Services
    # Note: docker compose can merge files. "docker-compose.infra.yml" + "docker-compose.yml" + "docker-compose.dev.yml"
    return @($ComposeInfra, "docker-compose.yml", "docker-compose.dev.yml")
}

function Get-ComposeArgs {
    $files = Get-ComposeFiles
    $args = @()
    foreach ($file in $files) {
        $args += "-f"
        $args += $file
    }
    return $args
}

function Kill-Port {
    param([int]$Port)
    $tcp = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($tcp) {
        Write-Host "Killing process on port $Port..." -ForegroundColor Yellow
        foreach ($conn in $tcp) {
            try {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            } catch {
                Write-Host "  Could not kill process $($conn.OwningProcess): $_" -ForegroundColor Red
            }
        }
    }
}

function Start-Services {
    Write-Host "Starting services..." -ForegroundColor Cyan
    $args = Get-ComposeArgs
    # We pass the array of arguments to docker compose
    # In PowerShell, we can use the call operator & or just execute command
    $cmd = "docker compose $($args -join ' ') up -d"
    Invoke-Expression $cmd
}

function Stop-Services {
    param([switch]$RemoveVolumes)
    Write-Host "Stopping services..." -ForegroundColor Yellow
    $args = Get-ComposeArgs
    $cmd = "docker compose $($args -join ' ') down"
    if ($RemoveVolumes) { $cmd += " -v" }
    Invoke-Expression $cmd
}

function Check-Health {
    Write-Host "Checking Service Health..." -ForegroundColor Cyan
    $args = Get-ComposeArgs
    $cmd = "docker compose $($args -join ' ') ps"
    Invoke-Expression $cmd
    
    # Custom additional checks if simple ps isn't enough (ported from health-check.ps1 logic)
    # For now, `docker compose ps` gives a good overview.
}

# --- Main Logic ---

switch ($Command) {
    "start" {
        Start-Services
    }
    "stop" {
        Stop-Services
    }
    "restart" {
        Write-Host "Restarting environment..." -ForegroundColor Magenta
        
        # 1. Stop normally first
        Stop-Services

        # 2. Kill lingering processes on ports
        Write-Host "Ensuring ports are free..."
        foreach ($port in $PortsToCheck) {
            Kill-Port -Port $port
        }

        # 3. Start
        Start-Services
    }
    "clean" {
        Write-Host "Cleaning environment (stopping containers, removing volumes)..." -ForegroundColor Red
        Stop-Services -RemoveVolumes
        
        # Add log file cleanup here if specific log directories exist
        # if (Test-Path ".\logs") { Remove-Item ".\logs\*" -Recurse -Force }
        Write-Host "Cleanup complete." -ForegroundColor Green
    }
    "status" {
        Check-Health
    }
    "logs" {
        $args = Get-ComposeArgs
        $cmd = "docker compose $($args -join ' ') logs -f"
        Invoke-Expression $cmd
    }
}
