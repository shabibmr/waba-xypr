---
description: Validate Genesys Client Credentials are correct and active
---
# Verify Genesys OAuth

This workflow runs a direct validation of Genesys Cloud OAuth credentials to bypass internal service layers.

1. Fetch the tenant's exact Client ID and Secret (from the user or the database).

2. Determine the correct Genesys Region (e.g., `login.mypurecloud.com`, `login.aps1.pure.cloud`).

3. Execute a direct cURL POST to the Genesys Cloud `/oauth/token` endpoint (Replace placeholders before running):
   ```bash
   curl -X POST https://<GENESYS_LOGN_URL>/oauth/token \
   -H "Content-Type: application/x-www-form-urlencoded" \
   -H "Authorization: Basic <BASE64_ENCODED_CLIENT_ID_AND_SECRET>" \
   -d "grant_type=client_credentials"
   ```

4. If successful, check the `auth-service` logs to see why the internal exchange might be failing:
   ```bash
   docker logs --tail 50 whatsapp-auth-service | grep -i "oauth"
   ```
