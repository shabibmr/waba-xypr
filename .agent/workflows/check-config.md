---
description: Verify WhatsApp and Genesys configurations exist in .env and DB, validate with live curl calls, and produce a pass/fail report with fix recommendations.
---

# /check-config Workflow

Check and validate all critical service configurations (WhatsApp & Genesys) against both environment variables and the database, then verify each with a live API call.

---

## Step 1 — Read .env values

// turbo
Read the `.env` file and extract the following keys:

**WhatsApp:**
- `META_PHONE_NUMBER_ID`
- `META_WABA_ID`
- `META_ACCESS_TOKEN`
- `META_VERIFY_TOKEN`

**Genesys:**
- `GENESYS_BASE_URL`
- `GENESYS_REGION`
- `GENESYS_CLIENT_ID`
- `GENESYS_CLIENT_SECRET`
- `GENESYS_PORTAL_CLIENT_ID`
- `GENESYS_PORTAL_CLIENT_SECRET`

---

## Step 2 — Check DB for WhatsApp config

// turbo
```bash
docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys -c \
  "SELECT tenant_id, phone_number_id, waba_id, LEFT(access_token,30) as token_preview, verify_token, is_active FROM tenant_whatsapp_config;"
```

✅ Check: Row exists, `is_active = true`, `phone_number_id` and `waba_id` match `.env`, `verify_token` is not NULL.

---

## Step 3 — Check DB for Genesys config

// turbo
```bash
docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys -c \
  "SELECT tenant_id, credentials->>'client_id' as client_id, LEFT(credentials->>'client_secret',20) as secret_preview, credentials->>'region' as region, is_active FROM tenant_credentials;"
```

✅ Check: Row exists, `is_active = true`, `client_id` matches `GENESYS_CLIENT_ID` (NOT the portal client), region matches `GENESYS_REGION`.

---

## Step 4 — Validate WhatsApp access token via curl

// turbo
```bash
curl -s "https://graph.facebook.com/v18.0/${META_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating&access_token=${META_ACCESS_TOKEN}"
```

✅ Pass: Response contains `display_phone_number` (HTTP 200).  
❌ Fail: Response contains `"error"` with `code: 190` → token expired. Must regenerate from Meta Business Manager.

---

## Step 5 — Validate Genesys OAuth via curl

// turbo
```bash
curl -s --max-time 10 -X POST "https://login.${GENESYS_REGION}/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${GENESYS_CLIENT_ID}&client_secret=${GENESYS_CLIENT_SECRET}"
```

✅ Pass: Response contains `access_token`.  
❌ Fail: `invalid_client` → wrong credentials or wrong region.  
❌ Fail: `unauthorized_client` → portal client stored instead of API client (client_credentials not enabled).  
❌ Fail: curl exit code 6 → DNS failure, `GENESYS_BASE_URL` or `GENESYS_REGION` is wrong. Correct format: `aps1.pure.cloud`.

---

## Step 6 — Report findings

Produce a summary table with the following columns:

| # | Component | Check | Status | Issue | Fix |
|---|-----------|-------|--------|-------|-----|

**Status color codes:**
- ✅ PASS — config exists and API verified working
- ⚠️ WARNING — config exists but misconfigured (e.g. NULL field, wrong value)
- ❌ CRITICAL — API call failed or config missing

**Common fixes to include in report if issues found:**

| Issue | Fix |
|-------|-----|
| WhatsApp token expired (code 190/463) | Regenerate long-lived token in Meta Business Manager → System Users. Update `.env` `META_ACCESS_TOKEN` and run: `UPDATE tenant_whatsapp_config SET access_token = '<new>' WHERE tenant_id = '<id>';` |
| `verify_token` NULL in DB | `UPDATE tenant_whatsapp_config SET verify_token = '<env_value>' WHERE tenant_id = '<id>';` |
| DB has portal client instead of API client | `UPDATE tenant_credentials SET credentials = jsonb_set(jsonb_set(credentials, '{client_id}', '"<GENESYS_CLIENT_ID>"'), '{client_secret}', '"<GENESYS_CLIENT_SECRET>"') WHERE tenant_id = '<id>';` |
| `GENESYS_BASE_URL` unresolvable | Change `.env` to `https://aps1.pure.cloud` (or correct region prefix) |
