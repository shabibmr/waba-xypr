---
description: Safely deploy a small code change to the remote staging environment
---
# Deploy Hotfix Remote

This workflow safely rebuilds and restarts a single container after a hotfix without taking down the rest of the application stack.

// turbo
1. Rebuild and deploy the specific service containing the code changes:
   ```bash
   # Replace <service_name> with the name of the service (e.g., genesys-api)
   docker-compose -f docker-compose.remote.yml up -d --build --no-deps <service_name>
   ```

2. Watch the logs immediately to ensure the newly deployed hotfix image comes up healthy:
   ```bash
   docker logs -f <service_name> --tail 100
   ```

3. Clean up any dangling Docker images left behind by the rebuild (optional but recommended):
   ```bash
   docker image prune -f
   ```
