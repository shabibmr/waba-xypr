---
description: Create a daily or ad-hoc summary of the most critical system exceptions
---
# Generate Error Report

This workflow scrapes the logs of all containers looking for high-priority errors or crashes to aggregate into a summary report.

1. Ensure all services are healthy and note any that are exiting or failing to start:
   ```bash
   docker-compose -f docker-compose.remote.yml ps
   ```

2. Grep Docker container logs generically for extreme exceptions across all applications:
   ```bash
   for container in $(docker ps -a --format '{{.Names}}' | grep "whatsapp\|genesys"); do 
     echo "--- Errors in $container ---" 
     docker logs --tail 500 $container 2>&1 | grep -iE "exception|error|stack|trace|fail"
   done
   ```

3. Generate a `.md` summary outlining the most frequent offenders so that the engineering team or agents can systematically step through and patch them.
