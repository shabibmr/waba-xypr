---
description: Restart a specific core or infrastructure service
---
# Restart Service Workflow

This workflow safely restarts a service, explicitly using the correct docker-compose files for the environment.

1. Check if the service is defined in `docker-compose.remote.yml` or `docker-compose.infra.yml`.
// turbo
2. Run the restart command targeting the correct compose file:
   ```bash
   # If it's a core service:
   docker-compose -f docker-compose.remote.yml restart <service_name>
   
   # If it's an infrastructure service (postgres, redis, rabbitmq):
   docker-compose -f docker-compose.infra.yml restart <service_name>
   ```

3. Instantly tail the logs to ensure it comes back up cleanly:
   ```bash
   docker logs -f whatsapp-<service_name> --tail 50
   ```
