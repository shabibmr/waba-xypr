---
description: Run a comprehensive diagnostic suite across all services
---
# Orchestrate System Diagnostics

This workflow acts as an orchestrator, automating the execution of multiple diagnostic and health-check workflows consecutively to provide a complete system root cause analysis (RCA).

1. Execute the `check-health` workflow to verify container up-time and API Gateway routing:
   ```bash
   docker-compose -f docker-compose.infra.yml ps
   docker-compose -f docker-compose.remote.yml ps
   curl -I http://${REMOTE_HOST:-localhost}:3000/health
   ```

2. Execute the `audit-cors-and-csp` workflow to ensure the frontend Widget iframe policies are intact:
   ```bash
   curl -i -X OPTIONS -H "Origin: http://${REMOTE_HOST:-192.168.29.124}:3014" -H "Access-Control-Request-Method: GET" http://localhost:3000/health
   ```

3. Execute the `analyze-rabbitmq-dlq` workflow to ensure there are no stuck or dropped messages in the queues:
   ```bash
   docker exec -it whatsapp-rabbitmq rabbitmqadmin list queues vhost name messages
   ```

4. Execute the `generate-error-report` workflow to scan the last 2 hours of logs for hidden exceptions:
   ```bash
   for container in $(docker ps -a --format '{{.Names}}' | grep "whatsapp\|genesys"); do 
     echo "--- Errors in $container ---" 
     # Look at recent logs for errors, ignore the rest
     docker logs --since 2h $container 2>&1 | grep -iE "exception|error|stack|trace|fail" | head -n 10
   done
   ```

5. Synthesize the findings from all 4 steps into a single, structured markdown report detailing:
   - What services are offline or flapping.
   - Any CORS/CSP regressions.
   - How many messages are stuck in Dead Letter Queues.
   - The top 3 recurring errors across the system logs over the last 2 hours.
