# Real WhatsApp Message Testing Guide

## 🎯 Goal
Send an actual WhatsApp message from your phone and watch it flow through the entire system.

---

## 📋 Prerequisites Checklist

### ✅ Required Setup
- [ ] **WhatsApp Business Account** with Meta
- [ ] **Phone Number ID:** `882555404932892` (currently configured)
- [ ] **Access Token:** Valid Meta System User token
- [ ] **Verify Token:** For webhook verification
- [ ] **Public Webhook URL:** Meta needs to reach your service

### ✅ Current Status
```
Tenant ID: t_a3eecb94bb822a92
Phone Number: 882555404932892
Local Webhook: http://localhost:3009/webhook/whatsapp ❌ (not public)
Token Status: Demo token (needs replacement)
```

---

## 🚀 Quick Start: Testing with ngrok

### 1. Start ngrok Tunnel
```bash
# Install ngrok (one-time)
brew install ngrok

# Create public tunnel to local webhook
ngrok http 3009

# You'll see output like:
# Forwarding: https://abc123def.ngrok.io -> http://localhost:3009
#                     ^^^^^^^^^^^^^^^^^^^
#                     Copy this URL!
```

### 2. Configure Meta Developer Portal

**Location:** https://developers.facebook.com/apps → Your App → WhatsApp → Configuration

**Webhook Settings:**
```
Callback URL: https://abc123def.ngrok.io/webhook/whatsapp
Verify Token: <your META_VERIFY_TOKEN from .env>
```

**Click "Verify and Save"**

**Subscribe to Fields:**
- ✅ `messages` (required)
- ✅ `message_status` (optional, for delivery receipts)

### 3. Send Test Message

**From your phone:**
1. Open WhatsApp
2. Send message to: **+[your business number]** (882555404932892)
3. Type: "Hello, testing the integration!"

### 4. Watch the Flow in Real-Time

**Terminal 1: ngrok (keep running)**
```bash
ngrok http 3009
```

**Terminal 2: Watch Logs**
```bash
docker compose logs -f \
  whatsapp-webhook-service \
  state-manager \
  inbound-transformer \
  genesys-api-service
```

**Terminal 3: Monitor Database**
```bash
# Watch for new messages
watch -n 1 'docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys \
  -c "SELECT id, wa_id, conversation_id, created_at FROM conversation_mappings ORDER BY created_at DESC LIMIT 3;"'
```

---

## 🔍 What You'll See

### Step 1: Webhook Received
```
whatsapp-webhook | [INFO] Incoming webhook from Meta
whatsapp-webhook | [INFO] Message from: 919876543210
whatsapp-webhook | [INFO] Message text: "Hello, testing the integration!"
whatsapp-webhook | [INFO] Queued to inbound-whatsapp-messages
```

### Step 2: State Manager Processing
```
state-manager | Processing inbound message
state-manager | wa_id: 919876543210
state-manager | Creating new conversation mapping
state-manager | mapping_id: <uuid>
state-manager | Published to inbound-processed queue
```

### Step 3: Inbound Transformer
```
inbound-transformer | Processing inbound message
inbound-transformer | Transforming WhatsApp → Genesys format
inbound-transformer | Published to genesys.outbound.ready
```

### Step 4: Genesys API Service
```
genesys-api | Message delivered to Genesys
genesys-api | conversationId: <genesys-uuid>
genesys-api | Correlation event published
```

### Step 5: Database Verification
```sql
-- Check conversation mapping
SELECT * FROM conversation_mappings
WHERE wa_id = '919876543210'
ORDER BY created_at DESC LIMIT 1;

-- Check message tracking
SELECT * FROM message_tracking
WHERE wamid LIKE '%your-phone%'
ORDER BY created_at DESC LIMIT 1;
```

---

## ⚙️ Alternative: Check Current Meta Configuration

Your webhook might already be configured in Meta. Let's check:

### Option A: Check via Meta Graph API
```bash
# Get current webhook configuration
curl -X GET \
  "https://graph.facebook.com/v18.0/882555404932892/subscribed_apps?access_token=YOUR_TOKEN"
```

### Option B: Check Meta Developer Portal
1. Go to: https://developers.facebook.com/apps
2. Select your app
3. Navigate to: **WhatsApp → Configuration**
4. Check **Webhook** section

---

## 🐛 Troubleshooting

### Issue 1: Webhook Verification Fails
```
Error: Verification token mismatch
```

**Fix:**
1. Check your `.env` file: `META_VERIFY_TOKEN`
2. Ensure it matches the token in Meta Developer Portal
3. Restart services: `docker compose restart whatsapp-webhook-service`

### Issue 2: ngrok Session Expired
```
Error: Session expired
```

**Fix:**
```bash
# Free ngrok URLs expire after 2 hours
# Restart ngrok to get a new URL
ngrok http 3009

# Update Meta Developer Portal with new URL
```

### Issue 3: No Messages Received
```
No logs appearing after sending message
```

**Debug Steps:**
```bash
# 1. Check ngrok is running
curl https://your-ngrok-url.ngrok.io/webhook/whatsapp

# 2. Check webhook service is accessible
docker compose ps | grep webhook

# 3. Check Meta webhook subscription
# Go to Meta Developer Portal → WhatsApp → Configuration

# 4. Send verification request
curl -X GET "https://your-ngrok-url.ngrok.io/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE"
```

### Issue 4: 401 Unauthorized from Meta
```
Error: Invalid access token
```

**Fix:**
You need a **valid Meta access token**. Current token is demo/expired.

**Get new token:**
1. Meta Developer Portal → Your App → System Users
2. Generate new token with permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
3. Update database:
```bash
docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys \
  -c "UPDATE tenant_whatsapp_config
      SET access_token = 'YOUR_NEW_TOKEN'
      WHERE tenant_id = 't_a3eecb94bb822a92';"
```

---

## 📊 Success Metrics

After sending a real WhatsApp message, you should see:

### ✅ Inbound Flow Complete
- [x] Webhook received from Meta
- [x] Message parsed and validated
- [x] Conversation mapping created (`wa_id → conversationId`)
- [x] Message tracked in database
- [x] Transformed to Genesys format
- [x] Delivered to Genesys API (or attempted if no real Genesys connection)

### 📈 Database State
```sql
-- New conversation mapping
conversation_mappings: +1 row

-- New message tracked
message_tracking: +1 row (direction=INBOUND, status=received)

-- Queue processing
RabbitMQ: messages consumed successfully
```

---

## 🎯 Full Round-Trip Test (Inbound + Outbound)

Once inbound works, test the complete loop:

### 1. Send WhatsApp Message (Inbound)
"Hello, I need help with my order #12345"

### 2. Simulate Agent Response (Outbound)
```bash
# Get the conversation ID from logs or database
CONV_ID="<from-logs>"

# Send agent response via test script
./test-genesys-webhook.sh
# (Update script with actual conversation ID)
```

### 3. Watch for WhatsApp Message Delivery
Check WhatsApp API service logs for delivery attempt

---

## 🔐 Security Notes

### ngrok URLs are Public!
- Anyone with your ngrok URL can send webhooks
- For production, use proper domain + authentication
- ngrok free tier URLs change every session

### Production Recommendations
1. **Use permanent domain:** `webhooks.yourdomain.com`
2. **Enable signature validation:** Verify `x-hub-signature-256` header
3. **Rate limiting:** Prevent webhook flooding
4. **Monitoring:** Alert on unusual webhook patterns

---

## 📚 References

### Meta Documentation
- **Webhooks Setup:** https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
- **Message Format:** https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
- **Testing:** https://developers.facebook.com/docs/whatsapp/cloud-api/guides/test-api

### Internal Documentation
- `CLAUDE.md` - Architecture overview
- `services/whatsapp-webhook-service/docs/whatsapp-webhook-frd.md`
- `END_TO_END_TEST_RESULTS.md` - Simulated test results

---

## ✅ Quick Decision Guide

**Do you have:**
- [ ] Valid Meta access token?
- [ ] WhatsApp Business phone number configured?
- [ ] 5 minutes to set up ngrok?

**If YES:** → **Start ngrok testing now!**
**If NO:** → Stick with simulated tests using `./test-webhook.sh`

---

## 🚦 Next Steps

### Ready to Test?
```bash
# 1. Start ngrok
ngrok http 3009

# 2. Copy ngrok URL

# 3. Configure Meta webhook with ngrok URL

# 4. Send WhatsApp message

# 5. Watch logs
docker compose logs -f whatsapp-webhook-service state-manager
```

### Questions?
- Need help getting Meta credentials?
- Want to set up a permanent webhook domain?
- Need to debug webhook issues?

Just ask! 🚀
