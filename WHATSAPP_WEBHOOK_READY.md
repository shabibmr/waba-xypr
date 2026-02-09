# WhatsApp Webhook - Ready for Testing

**Status**: ✅ **CONFIGURED AND READY**
**Date**: 2026-02-05 17:36 UTC

---

## ✅ Configuration Complete

### Meta Developer Console
- ✅ Webhook URL configured
- ✅ Verify token validated
- ✅ Webhook fields subscribed (messages, message_status)

### Local Services
- ✅ WhatsApp Webhook Service running (port 3009)
- ✅ ngrok tunnel active and verified
- ✅ Credentials loaded (new App ID, Phone Number, Access Token)
- ✅ Database updated with latest credentials

---

## 📋 Current Configuration

### WhatsApp Business API
```
App ID: 1207750114647396
Phone Number ID: 882555404932892
Business Account ID: 790704466912512
Access Token: EAARKcTyPnWQ... (active)
```

### Webhook
```
URL: https://conscriptional-skye-solidillu.ngrok-free.dev/webhook/whatsapp
Verify Token: whatsapp_webhook_verify_token_2024
Status: ✅ Verified by Meta
```

### Local Service
```
Port: 3009
Health: ✅ Healthy
ngrok: ✅ Active
Logs: /tmp/whatsapp-webhook.log
```

---

## 🧪 Testing Your Webhook

### Test 1: Send a WhatsApp Message

**How to test:**
1. Open WhatsApp on your phone
2. Send a message to: **+882555404932892**
3. Type any text message (e.g., "Hello")

**What should happen:**
1. Meta receives your message
2. Meta sends webhook POST request to your ngrok URL
3. Your local service receives and processes it
4. You'll see the request in ngrok web interface

**Monitor the request:**
```bash
# Watch in real-time
open http://localhost:4040

# Or check logs
tail -f /tmp/whatsapp-webhook.log
```

### Test 2: Check ngrok Web Interface

**URL:** http://localhost:4040

**What to look for:**
- POST requests to `/webhook/whatsapp`
- Status code: 200 OK
- Request body contains WhatsApp message data
- Response from your service

### Test 3: Verify Webhook Logs

```bash
# View recent logs
tail -20 /tmp/whatsapp-webhook.log

# Follow logs in real-time
./logs-mvp.sh whatsapp-webhook

# Or manually
tail -f /tmp/whatsapp-webhook.log
```

**Expected log entries:**
```
[INFO] Webhook request received
[INFO] Message validated
[INFO] Processing WhatsApp message
```

---

## 📊 Monitoring Tools

### 1. ngrok Web Interface
**URL:** http://localhost:4040

**Features:**
- View all incoming requests
- See request/response details
- Replay requests for testing
- Check request timing

### 2. Service Logs
```bash
# Real-time logs
tail -f /tmp/whatsapp-webhook.log

# Last 50 lines
tail -50 /tmp/whatsapp-webhook.log

# Search for errors
grep -i error /tmp/whatsapp-webhook.log

# Search for specific message
grep "message_id" /tmp/whatsapp-webhook.log
```

### 3. Service Health Check
```bash
curl http://localhost:3009/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "whatsapp-webhook",
  "rabbitmq": "disconnected",
  "timestamp": "2026-02-05T17:36:38.430Z"
}
```

---

## 🔍 Message Flow Diagram

```
WhatsApp User                    Your System
     │                                │
     │  1. Send message to           │
     │     +882555404932892          │
     │                                │
     ▼                                │
Meta WhatsApp API                    │
     │                                │
     │  2. POST webhook               │
     │     to ngrok URL               │
     ├───────────────────────────────►│
     │                                │
     │                           ngrok Tunnel
     │                                │
     │                                ▼
     │                    WhatsApp Webhook Service
     │                            (port 3009)
     │                                │
     │                                │ 3. Validate signature
     │                                │ 4. Parse message
     │                                │ 5. Log event
     │                                │
     │  6. Return 200 OK              │
     │◄───────────────────────────────┤
     │                                │
```

---

## 🎯 What to Test

### Basic Tests
1. ✅ **Text Message**
   - Send: "Hello World"
   - Check: Webhook receives message

2. ✅ **Emoji Message**
   - Send: "👋 Hello! 🎉"
   - Check: Webhook handles emojis

3. ✅ **Multiple Messages**
   - Send several messages quickly
   - Check: All messages received

### Advanced Tests
4. **Image Message**
   - Send a photo
   - Check: Webhook receives image metadata

5. **Video/Audio**
   - Send video or voice message
   - Check: Media messages handled

6. **Reply to Message**
   - Reply to a previous message
   - Check: Reply context preserved

---

## 📝 Example Webhook Payload

When you send "Hello" to the number, Meta will POST this to your webhook:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "790704466912512",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "882555404932892",
              "phone_number_id": "882555404932892"
            },
            "contacts": [
              {
                "profile": {
                  "name": "User Name"
                },
                "wa_id": "919876543210"
              }
            ],
            "messages": [
              {
                "from": "919876543210",
                "id": "wamid.ABC123",
                "timestamp": "1733420000",
                "text": {
                  "body": "Hello"
                },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

---

## 🛠️ Troubleshooting

### "No webhook received"

**Check:**
1. ngrok is running: `curl http://localhost:4040/api/tunnels`
2. Service is running: `curl http://localhost:3009/health`
3. URL in Meta console matches ngrok URL
4. Phone number is correct: `+882555404932892`

**Solution:**
```bash
# Restart everything
./restart-mvp.sh
./setup-ngrok.sh
# Re-verify in Meta console
```

### "Webhook returns error"

**Check logs:**
```bash
tail -50 /tmp/whatsapp-webhook.log | grep -i error
```

**Common issues:**
- Invalid signature (check App Secret)
- Wrong verify token
- Service crashed (restart it)

### "Message not processed"

**Check:**
1. Service logs: `tail -f /tmp/whatsapp-webhook.log`
2. ngrok interface: http://localhost:4040
3. Meta webhook subscriptions are active

---

## 🔐 Security Notes

### Webhook Signature Validation

Your service validates incoming webhooks using:
- **X-Hub-Signature-256** header from Meta
- **META_APP_SECRET** in your environment

**This ensures:**
- Only Meta can send valid webhooks
- Requests are not tampered with
- Prevents replay attacks

### Verify Token

Used during webhook setup:
- Meta sends: `hub.verify_token`
- Your service checks: `META_VERIFY_TOKEN`
- Must match to complete setup

---

## 📈 Next Steps

### 1. Process Incoming Messages
Currently, your webhook:
- ✅ Receives messages
- ✅ Validates signatures
- ✅ Logs events
- ⏳ Needs: Message processing logic

### 2. Send Replies
Use the WhatsApp API Service to send replies:

```bash
curl -X POST http://localhost:3008/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "919876543210",
    "type": "text",
    "text": {
      "body": "Thanks for your message!"
    }
  }'
```

### 3. Connect to Genesys
Once messages are flowing:
- Transform WhatsApp → Genesys format (Inbound Transformer)
- Send to Genesys Cloud (Genesys API Service)
- Create conversation in Genesys

---

## 🔗 Quick Reference

### URLs
- **Webhook URL:** https://conscriptional-skye-solidillu.ngrok-free.dev/webhook/whatsapp
- **ngrok Interface:** http://localhost:4040
- **Service Health:** http://localhost:3009/health
- **Meta App:** https://developers.facebook.com/apps/1207750114647396

### Test Number
- **WhatsApp Number:** +882555404932892

### Files
- **Service Logs:** `/tmp/whatsapp-webhook.log`
- **ngrok Logs:** `/tmp/ngrok.log`
- **Config:** `/tmp/ngrok-webhook-urls.txt`

### Commands
```bash
# View logs
./logs-mvp.sh whatsapp-webhook

# Check status
./status-mvp.sh

# Restart service
kill $(lsof -ti:3009)
cd services/whatsapp-webhook-service && npm run dev > /tmp/whatsapp-webhook.log 2>&1 &

# Restart ngrok
./setup-ngrok.sh
```

---

## ✅ Validation Checklist

Before testing, verify:

- [x] Meta Developer Console configured
- [x] Webhook URL set and verified
- [x] Webhook fields subscribed (messages, message_status)
- [x] WhatsApp Webhook Service running
- [x] ngrok tunnel active
- [x] Credentials loaded (App ID: 1207750114647396)
- [x] Phone Number ID: 882555404932892
- [x] Logs accessible

**Status:** 🎉 **ALL CHECKS PASSED - READY FOR TESTING!**

---

**Test it now!** Send a message to **+882555404932892** and watch it arrive! 📱→💻
