---
description: Track a specific interaction across the entire pipeline
---
# Debug Communication ID

This workflow tracks the lifecycle of a specific Genesys interaction or WhatsApp message using the `communicationId` or `conversationId`.

1. Search for the specific ID across all `whatsapp` prefixed containers:
   ```bash
   # Replace <ID> with the actual communicationId, conversationId, or WABA ID
   docker logs whatsapp-webhook 2>&1 | grep -i "<ID>" | tail -n 20
   ```

2. Correlate the ID through the inbound or outbound transformer:
   ```bash
   docker logs whatsapp-inbound-transformer 2>&1 | grep -i "<ID>" | tail -n 20
   docker logs whatsapp-outbound-transformer 2>&1 | grep -i "<ID>" | tail -n 20
   ```

3. Follow the ID into the Genesys API Service:
   ```bash
   docker logs genesys-api 2>&1 | grep -i "<ID>" | tail -n 20
   ```

4. Check the `state-manager` logs to see if the state for this ID was properly saved:
   ```bash
   docker logs whatsapp-state-manager 2>&1 | grep -i "<ID>" | tail -n 20
   ```
