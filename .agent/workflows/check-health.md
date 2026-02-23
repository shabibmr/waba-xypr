---
description: Instantly verify the status of all core services and infra
---
# Check Service Health

This workflow quickly assesses the health of the entire WABA Genesys integration stack across both compose files.

// turbo-all
1. Check the status of core application services:
   ```bash
   docker-compose -f docker-compose.remote.yml ps
   ```

2. Check the status of infrastructure services:
   ```bash
   docker-compose -f docker-compose.infra.yml ps
   ```

3. Ensure API Gateway is routing correctly:
   ```bash
   curl -I http://${REMOTE_HOST:-localhost}:3000/health
   ```
