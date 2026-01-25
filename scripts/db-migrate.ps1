# Database Migration Script
# Runs database migrations for PostgreSQL

param(
    [ValidateSet("up", "down", "status")]
    [string]$Action = "up"
)

# Add Docker to PATH
$env:PATH = "E:\docker\resources\bin;$env:PATH"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Database Migration" -ForegroundColor Cyan
Write-Host "Action: $Action" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL container is running
$pgStatus = docker inspect -f '{{.State.Status}}' whatsapp-postgres 2>$null

if ($pgStatus -ne "running") {
    Write-Host "✗ PostgreSQL container is not running!" -ForegroundColor Red
    Write-Host "Start the infrastructure services first:" -ForegroundColor Yellow
    Write-Host "  docker compose -f docker-compose.infra.yml up -d" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ PostgreSQL container is running" -ForegroundColor Green
Write-Host ""

switch ($Action) {
    "up" {
        Write-Host "Running migrations..." -ForegroundColor Yellow
        
        # Re-run the init script (idempotent)
        docker exec -i whatsapp-postgres psql -U postgres -d whatsapp_genesys < docker/postgres/init.sql
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✓ Migrations completed successfully!" -ForegroundColor Green
        } else {
            Write-Host "✗ Migration failed!" -ForegroundColor Red
            exit 1
        }
    }
    
    "down" {
        Write-Host "Rolling back migrations..." -ForegroundColor Yellow
        Write-Host "⚠ This will drop all tables!" -ForegroundColor Red
        
        $confirm = Read-Host "Are you sure? (yes/no)"
        if ($confirm -eq "yes") {
            $dropCmd = @"
DROP TABLE IF EXISTS message_logs CASCADE;
DROP TABLE IF EXISTS conversation_states CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
"@
            
            $dropCmd | docker exec -i whatsapp-postgres psql -U postgres -d whatsapp_genesys
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Tables dropped successfully!" -ForegroundColor Green
            } else {
                Write-Host "✗ Rollback failed!" -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "Rollback cancelled" -ForegroundColor Yellow
        }
    }
    
    "status" {
        Write-Host "Database schema status:" -ForegroundColor Yellow
        Write-Host ""
        
        docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys -c "\dt"
        
        Write-Host ""
        Write-Host "Table row counts:" -ForegroundColor Yellow
        docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys -c "SELECT 'tenants' as table_name, COUNT(*) as row_count FROM tenants UNION ALL SELECT 'conversation_states', COUNT(*) FROM conversation_states UNION ALL SELECT 'message_logs', COUNT(*) FROM message_logs;"
    }
}
