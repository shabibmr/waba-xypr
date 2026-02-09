# WhatsApp Business Account ID Update

**Date**: 2026-02-05
**Update**: Corrected WhatsApp Business Account ID

---

## ✅ What Was Updated

### Previous Configuration
```
Business Account ID: 667044745953003  ❌ (Incorrect)
Phone Number ID: 888340727686839      ✓ (Correct)
```

### Updated Configuration
```
Business Account ID: 790704466912512  ✓ (Correct)
Phone Number ID: 888340727686839      ✓ (Correct)
```

---

## 📝 Changes Made

### 1. WhatsApp Webhook Service ✅
**File**: `services/whatsapp-webhook-service/.env`
```bash
WHATSAPP_BUSINESS_ID=790704466912512  # Updated
WHATSAPP_PHONE_NUMBER_ID=888340727686839
```

### 2. WhatsApp API Service ✅
**File**: `services/whatsapp-api-service/.env`
```bash
WHATSAPP_BUSINESS_ID=790704466912512  # Updated
WHATSAPP_PHONE_NUMBER_ID=888340727686839
```

### 3. Database ✅
**Table**: `tenant_credentials`
```sql
-- Updated for tenant: 00000000-0000-0000-0000-000000000001
business_account_id: "790704466912512"  -- Updated
waba_id: "790704466912512"              -- Updated
phone_number_id: "888340727686839"      -- Unchanged
```

### 4. Documentation ✅
**File**: `CREDENTIALS_UPDATED.md`
- Updated Business Account ID reference

---

## 🔍 Verification

### Check Database
```bash
docker exec -it whatsapp-postgres psql -U postgres -d waba_mvp -c "
SELECT
  credentials->>'phone_number_id' as phone_number_id,
  credentials->>'business_account_id' as business_account_id,
  credentials->>'waba_id' as waba_id
FROM tenant_credentials
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND credential_type = 'whatsapp';
"
```

**Expected Output:**
```
 phone_number_id | business_account_id |     waba_id
-----------------+---------------------+-----------------
 888340727686839 | 790704466912512     | 790704466912512
```

### Check Environment Files
```bash
# WhatsApp Webhook Service
grep WHATSAPP_BUSINESS_ID services/whatsapp-webhook-service/.env

# WhatsApp API Service
grep WHATSAPP_BUSINESS_ID services/whatsapp-api-service/.env
```

**Expected Output:**
```
WHATSAPP_BUSINESS_ID=790704466912512
WHATSAPP_BUSINESS_ID=790704466912512
```

---

## 🔄 Next Steps

### If Services Are Running
Restart the WhatsApp services to pick up the new configuration:

```bash
# Option 1: Restart specific services
kill $(lsof -ti:3008,3009)
cd services/whatsapp-webhook-service && npm run dev > /tmp/whatsapp-webhook.log 2>&1 &
cd services/whatsapp-api-service && npm run dev > /tmp/whatsapp-api.log 2>&1 &

# Option 2: Restart all services
./restart-mvp.sh
```

### Verify in Meta Developer Console
1. Go to: https://developers.facebook.com/apps/1162288675766205
2. Navigate to: **WhatsApp → API Setup**
3. Verify that:
   - **Phone Number ID**: `888340727686839` ✓
   - **WhatsApp Business Account ID**: `790704466912512` ✓

---

## 📊 Complete WhatsApp Configuration

### Correct Values
```bash
# Meta App
META_APP_ID=1162288675766205

# WhatsApp Business Account
WHATSAPP_BUSINESS_ID=790704466912512        # ← UPDATED
WHATSAPP_PHONE_NUMBER_ID=888340727686839

# Access Token
WHATSAPP_ACCESS_TOKEN=EAAQhGGulP70BPmNwdzOALJ3CPc6ivZCr41oECVDfifZBbIotzMgQL7dKRUyaWSZBpOPZC9mkGkZBKrs0ITG1G6TuLnxLBG0oFCqSLuA8ZA62BLirO5snyjxkkjJx4oJYnzlmg9ijPRiACoox0zpU3e237BlObJ9nHFquHSM69qURKF6cDtcK6SsKgGGaVbvHnjhwZDZD

# Webhook Verification
META_VERIFY_TOKEN=whatsapp_webhook_verify_token_2024
```

### Where These Values Are Used

| Service | Business ID Used? | Phone Number ID Used? |
|---------|-------------------|----------------------|
| WhatsApp Webhook | ✓ | ✓ |
| WhatsApp API | ✓ | ✓ |
| Tenant Service (DB) | ✓ | ✓ |
| Auth Service | - | - |

---

## 🧪 Testing

### Test Sending a Message
```bash
curl -X POST http://localhost:3008/api/messages/send \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "to": "+1234567890",
    "type": "text",
    "text": {
      "body": "Test message from updated configuration"
    }
  }'
```

### Test Webhook Reception
1. Set up ngrok: `./setup-ngrok.sh`
2. Configure webhook in Meta console
3. Send a test message to: `+888340727686839`
4. Check logs: `./logs-mvp.sh whatsapp-webhook`

---

## 📋 Summary

✅ **Completed:**
- Updated Business Account ID in WhatsApp Webhook Service
- Updated Business Account ID in WhatsApp API Service
- Updated Business Account ID in database (both `business_account_id` and `waba_id`)
- Updated documentation

⏭️ **Action Required:**
- Restart WhatsApp services if currently running
- Test message sending/receiving
- Verify in Meta Developer Console

---

## 🔗 Related Files

- `services/whatsapp-webhook-service/.env` - Webhook service config
- `services/whatsapp-api-service/.env` - API service config
- `CREDENTIALS_UPDATED.md` - Main credentials reference
- `NGROK_SETUP_GUIDE.md` - Webhook setup guide

---

**Update Completed By**: Claude
**Timestamp**: 2026-02-05 16:32 UTC
