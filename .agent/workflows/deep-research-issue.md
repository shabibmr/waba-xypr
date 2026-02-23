---
description: Autonomously research a bug by searching codebase, logs, and database state
---
# Deep Research Issue

This workflow performs autonomous deep research on a bug or symptom. It searches
source code, cross-references shared constants, inspects database/Redis state,
and proposes a root cause with actionable fix.

> **Compose files**: `docker-compose.remote.yml` (app), `docker-compose.infra.yml` (infra)
> **Key reference files:**
> - Queue names: `shared/constants/queues.js`
> - Architecture: `ARCHITECTURE_INTEGRATION.md`
> - Skills context: `.skills/waba_genesys_debugging_skills.md`

---

## Step 1 — Capture the symptom

Ask the user to describe the symptom in one sentence. Examples:
- "Outbound messages are going to DLQ"
- "Status updates not reflected in agent widget"
- "genesys-api-service returns 400 on outbound"

---

## Step 2 — Extract keywords and error codes

From the symptom description, extract:
- **Error codes**: HTTP status codes (400, 401, 403, 429, 500)
- **Service names**: which service is failing
- **Queue names**: which queue is affected
- **Identifiers**: conversation_id, genesys_message_id, wamid, tenant_id

---

## Step 3 — Search the codebase for the error pattern

Use `grep_search` to find where the error originates in source code:
```
Search for the error message text in the services/ directory
Search for the HTTP status code handling in the relevant service
Search for the queue name in shared/constants/queues.js to understand producer/consumer
```

---

## Step 4 — Inspect the service's error handling chain

For the identified service, trace the error handling:
1. Read the `rabbitmq.service` file to understand retry/DLQ logic
2. Read the main service handler to understand business logic
3. Check `config/` for environment-dependent settings

---

## Step 5 — Check runtime state

### Redis state
```bash
# Search for relevant keys
docker exec -it whatsapp-redis redis-cli KEYS "*<search_term>*" | head -n 20
# Get specific key value
docker exec -it whatsapp-redis redis-cli GET "<key>"
```

### Postgres state
```bash
# Check conversation mappings
docker exec -it whatsapp-postgres psql -U postgres -d whatsapp_genesys -c "SELECT * FROM conversation_mappings WHERE conversation_id = '<ID>' LIMIT 5;"
# Check message tracking
docker exec -it whatsapp-postgres psql -U postgres -d whatsapp_genesys -c "SELECT * FROM messages WHERE genesys_message_id = '<ID>' ORDER BY created_at DESC LIMIT 5;"
```

### Recent Docker logs
```bash
docker logs --since 30m <container_name> 2>&1 | grep -iE "error|exception|fail" | tail -n 30
```

---

## Step 6 — Cross-reference with known patterns

Check if the issue matches known bug patterns from conversation history:
- **communicationId cache bug**: `BUGFIX-communicationId-cache.md`
- **OAuth exchange failures**: `GENESYS_OAUTH_DEBUG_CONTEXT.md`
- **Credential issues**: `CREDENTIALS_UPDATED.md`

---

## Step 7 — Formulate root cause hypothesis

Based on the code analysis, runtime state, and log evidence, propose:
1. **Root Cause**: What is actually broken and why
2. **Impact**: What parts of the system are affected
3. **Fix Options**: 
   - Quick fix (config change, restart, cache flush)
   - Code fix (specific file and function to modify)
4. **Verification**: How to confirm the fix works

---

## Step 8 — Report

Present findings in a structured format:

| Section | Detail |
|---------|--------|
| **Symptom** | User-reported symptom |
| **Affected Service** | Service name + container |
| **Root Cause** | Technical explanation |
| **Evidence** | Log lines, code references, DB state |
| **Recommended Fix** | Specific actions to take |
| **Verification** | How to confirm resolution |

If the fix requires a code change, present the diff but **do not apply it** until the user approves.
If this is a new recurring pattern, recommend running `/create-workflow` to capture it.
