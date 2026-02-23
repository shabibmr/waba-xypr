---
description: Debug frontend iframe or cross-origin errors
---
# Audit CORS and CSP

This workflow verifies that the `ALLOWED_ORIGINS` in `docker-compose.remote.yml` are correctly applied to the API Gateway routing mechanism, preventing iframe embedding issues for the Genesys Agent Widget.

1. Review the currently configured `ALLOWED_ORIGINS` in the `.env` file and `docker-compose.remote.yml` for `api-gateway` and `auth-service`.

2. Test an OPTIONS pre-flight request simulating the Agent Widget's domain natively:
   ```bash
   curl -i -X OPTIONS -H "Origin: http://${REMOTE_HOST:-192.168.29.124}:3014" \
        -H "Access-Control-Request-Method: GET" \
        http://localhost:3000/health
   ```

3. Confirm that the response includes:
   `Access-Control-Allow-Origin: http://${REMOTE_HOST:-192.168.29.124}:3014`

4. Search the API Gateway logs for missing CSP or CORS headers during a failed load:
   ```bash
   docker logs --tail 50 whatsapp-api-gateway | grep -iE "cors|csp|origin"
   ```
