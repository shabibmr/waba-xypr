---
description: Ensure the Meta webhook endpoint is responding correctly to verification challenges
---
# Validate WhatsApp Webhook

This workflow simulates Meta's GET request puzzle challenge to ensure the `whatsapp-webhook-service` is correctly configured and publicly reachable.

1. Ensure the API Gateway and Webhook Service are running:
   ```bash
   docker-compose -f docker-compose.remote.yml ps api-gateway whatsapp-webhook
   ```

2. Retrieve the `META_VERIFY_TOKEN` from the `.env` file or environment variables.

3. Simulate the Meta challenge GET request against the local gateway (replace `<META_VERIFY_TOKEN>` in this request):
   ```bash
   curl -i -X GET 'http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<META_VERIFY_TOKEN>&hub.challenge=1158201444'
   ```

4. You should receive a `200 OK` response with the body `1158201444`.

5. Check the `whatsapp-webhook-service` container logs:
   ```bash
   docker logs --tail 20 whatsapp-webhook | grep -i "webhook"
   ```
