---
description: Triage messages in Dead Letter Queues (DLQ)
---
# Analyze RabbitMQ DLQ

This workflow inspects the Dead Letter Queue for failed events.

1. Ensure the `whatsapp-rabbitmq` container is running:
   ```bash
   docker-compose -f docker-compose.infra.yml ps rabbitmq
   ```

2. List all queues to identify the DLQs:
   ```bash
   docker exec -it whatsapp-rabbitmq rabbitmqadmin list queues vhost name messages
   ```

3. If there are messages in `genesys.dlq` or similar dead letter queues, fetch the top 5 messages for inspection:
   ```bash
   docker exec -it whatsapp-rabbitmq rabbitmqadmin get queue=genesys.dlq count=5
   ```

4. Cross-reference the payload structure with recent transformer logs:
   ```bash
   docker logs --tail 100 whatsapp-outbound-transformer | grep -i error
   docker logs --tail 100 whatsapp-inbound-transformer | grep -i error
   ```
