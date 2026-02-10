# ngrok Setup Guide for WhatsApp Webhook

Complete guide to expose your local WhatsApp Webhook service to the internet using ngrok.

---

## 📋 Overview

**Why ngrok?**
- Meta WhatsApp requires a **public HTTPS URL** for webhooks
- Your local service runs on `http://localhost:3009`
- ngrok creates a secure tunnel to make it publicly accessible

**What gets exposed:**
- WhatsApp Webhook Service (port 3009) → Public HTTPS URL
- Genesys Webhook Service (port 3011) → Public HTTPS URL (optional)

---

## 🚀 Quick Start

### Prerequisites

1. **ngrok installed**
   ```bash
   # Install via Homebrew
   brew install ngrok/ngrok/ngrok

   # Or download from https://ngrok.com/download
   ```

2. **ngrok account** (free)
   - Sign up at: https://dashboard.ngrok.com/signup
   - Get your authtoken: https://dashboard.ngrok.com/get-started/your-authtoken

3. **Authenticate ngrok**
   ```bash
   ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
   ```

4. **WhatsApp Webhook service running**
   ```bash
   cd services/whatsapp-webhook-service
   npm run dev
   ```

### Automated Setup (Recommended)

```bash
# Run the setup script
./setup-ngrok.sh
```

The script will:
1. ✅ Check if ngrok is installed
2. ✅ Check if webhook services are running
3. ✅ Ask which tunnels to create (WhatsApp, Genesys, or both)
4. ✅ Start ngrok tunnels
5. ✅ Display webhook URLs and configuration instructions
6. ✅ Save URLs to file for reference

---

## 📝 Manual Setup

### Step 1: Start WhatsApp Webhook Service

```bash
cd services/whatsapp-webhook-service
npm run dev
```

**Verify it's running:**
```bash
curl http://localhost:3009/health
# Should return: {"status":"healthy","service":"whatsapp-webhook-service"}
```

### Step 2: Start ngrok Tunnel

```bash
# Basic tunnel (single webhook)
ngrok http 3009

# Or with custom subdomain (requires paid plan)
ngrok http 3009 --subdomain=my-whatsapp-webhook
```

### Step 3: Get Public URL

After starting ngrok, you'll see output like:
```
Session Status                online
Account                       your-email@example.com
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok.io -> http://localhost:3009
```

**Your public URL is:** `https://abc123.ngrok.io`

### Step 4: Configure Meta WhatsApp

1. Go to **Meta Developer Console**: https://developers.facebook.com/apps/1162288675766205

2. Navigate to **WhatsApp → Configuration**

3. In the **Webhook** section, click **Edit**

4. Enter:
   - **Callback URL**: `https://abc123.ngrok.io/webhook/whatsapp`
   - **Verify Token**: `whatsapp_webhook_verify_token_2024`

5. Click **Verify and Save**

6. Subscribe to webhook fields:
   - ✅ `messages`
   - ✅ `message_status`

7. Click **Save** or **Update**

---

## 🔧 Advanced Configuration

### Multiple Tunnels (WhatsApp + Genesys)

Create an ngrok config file:

```bash
cat > /tmp/ngrok-config.yml << 'EOF'
version: "2"
tunnels:
  whatsapp:
    proto: http
    addr: 3009
  genesys:
    proto: http
    addr: 3011
EOF
```

Start both tunnels:
```bash
ngrok start --config=/tmp/ngrok-config.yml whatsapp genesys
```

### Static Subdomain (Paid Plan)

```bash
ngrok http 3009 --subdomain=my-company-whatsapp
# URL will be: https://my-company-whatsapp.ngrok.io
```

### Custom Domain (Paid Plan)

```bash
ngrok http 3009 --hostname=webhooks.mycompany.com
# URL will be: https://webhooks.mycompany.com
```

---

## 🧪 Testing the Webhook

### Test Webhook Verification (Meta will call this)

```bash
curl "https://YOUR_NGROK_URL.ngrok.io/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=whatsapp_webhook_verify_token_2024&hub.challenge=test123"

# Should return: test123
```

### Test Receiving a Message

1. Send a WhatsApp message to your test number: `+888340727686839`

2. Check ngrok web interface: http://localhost:4040
   - You'll see the incoming POST request
   - View the full request/response

3. Check service logs:
   ```bash
   tail -f /tmp/whatsapp-webhook.log
   ```

---

## 📊 Monitoring

### ngrok Web Interface

Access: **http://localhost:4040**

Features:
- 📋 View all HTTP requests
- 🔍 Inspect request/response details
- ↩️ Replay requests
- 📈 See request timing
- 🐛 Debug webhook issues

### Service Logs

```bash
# WhatsApp Webhook logs
tail -f /tmp/whatsapp-webhook.log

# Or use the log viewer
./logs-mvp.sh whatsapp-webhook
```

---

## 🔒 Security Considerations

### Webhook Verification

The WhatsApp Webhook service validates incoming requests:

1. **Verify Token** (during setup)
   - Configured in `.env`: `META_VERIFY_TOKEN=whatsapp_webhook_verify_token_2024`
   - Meta sends this during webhook verification

2. **Signature Validation** (for messages)
   - Meta signs each request with `X-Hub-Signature-256` header
   - Service validates using `META_APP_SECRET`
   - Only valid requests are processed

### Best Practices

1. **Use unique verify token**
   ```bash
   # Generate a random token
   openssl rand -hex 32
   # Update in .env and Meta console
   ```

2. **Rotate tokens regularly**
   - Update `META_VERIFY_TOKEN` in `.env`
   - Update in Meta Developer Console
   - Restart webhook service

3. **Monitor ngrok dashboard**
   - Watch for suspicious requests
   - Check for unauthorized access attempts

4. **Production: Use real domain**
   - Don't use ngrok in production
   - Set up proper domain with SSL
   - Use reverse proxy (nginx/caddy)

---

## ❌ Troubleshooting

### "ngrok not found"

**Problem:** Command not found: ngrok

**Solution:**
```bash
# Install ngrok
brew install ngrok/ngrok/ngrok

# Or download from https://ngrok.com/download
```

### "ngrok failed to start"

**Problem:** Authentication error

**Solution:**
```bash
# Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
ngrok config add-authtoken YOUR_AUTHTOKEN

# Verify it worked
ngrok config check
```

### "Webhook verification failed"

**Problem:** Meta can't verify webhook

**Possible causes:**

1. **Wrong verify token**
   ```bash
   # Check your .env file
   grep META_VERIFY_TOKEN services/whatsapp-webhook-service/.env
   # Should match what you entered in Meta console
   ```

2. **Service not running**
   ```bash
   curl http://localhost:3009/health
   # Should return status:healthy
   ```

3. **Wrong ngrok URL**
   - Make sure URL includes `/webhook/whatsapp`
   - Use HTTPS, not HTTP
   - Example: `https://abc123.ngrok.io/webhook/whatsapp`

4. **Firewall blocking ngrok**
   - Check firewall settings
   - Ensure ngrok can make outbound connections

### "Tunnel not found"

**Problem:** ngrok tunnel disappeared

**Causes:**
- Free ngrok URLs expire after 2 hours of inactivity
- ngrok process was killed
- Network connection lost

**Solution:**
```bash
# Restart ngrok
./setup-ngrok.sh

# Update webhook URL in Meta console with new URL
```

### "502 Bad Gateway"

**Problem:** ngrok shows 502 error

**Causes:**
- WhatsApp Webhook service is not running
- Service crashed
- Port 3009 is in use by different process

**Solution:**
```bash
# Check if service is running
lsof -ti:3009

# Restart service
cd services/whatsapp-webhook-service
npm run dev

# Check logs
tail -f /tmp/whatsapp-webhook.log
```

### "Connection refused"

**Problem:** Can't reach local service through ngrok

**Solution:**
```bash
# Verify service is listening on 0.0.0.0 or 127.0.0.1
lsof -ti:3009

# Check if service accepts connections
curl http://localhost:3009/health

# Restart ngrok and service
./restart-mvp.sh
./setup-ngrok.sh
```

---

## 🔄 Workflow Examples

### Daily Development

```bash
# 1. Start infrastructure
docker compose -f docker-compose.infra.yml up -d

# 2. Start all services
./start-mvp.sh

# 3. Start ngrok (in separate terminal)
./setup-ngrok.sh

# 4. Update webhook URL in Meta console if it changed

# 5. Test by sending WhatsApp message

# 6. Monitor in ngrok UI: http://localhost:4040
```

### After System Restart

```bash
# ngrok URLs change when restarted
./setup-ngrok.sh

# Copy new webhook URL
# Example: https://xyz789.ngrok.io/webhook/whatsapp

# Update in Meta Developer Console:
# 1. Go to: https://developers.facebook.com/apps/1162288675766205
# 2. WhatsApp → Configuration → Edit Webhook
# 3. Update Callback URL
# 4. Verify and Save
```

### Production Deployment

**Don't use ngrok in production!** Instead:

1. **Get a domain**
   - Purchase domain: mycompany.com
   - Create subdomain: webhooks.mycompany.com

2. **Set up SSL**
   ```bash
   # Using Let's Encrypt
   sudo certbot --nginx -d webhooks.mycompany.com
   ```

3. **Configure reverse proxy**
   ```nginx
   # /etc/nginx/sites-available/webhooks
   server {
       listen 443 ssl;
       server_name webhooks.mycompany.com;

       ssl_certificate /etc/letsencrypt/live/webhooks.mycompany.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/webhooks.mycompany.com/privkey.pem;

       location /webhook/whatsapp {
           proxy_pass http://localhost:3009;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }

       location /webhook/genesys {
           proxy_pass http://localhost:3011;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

4. **Update Meta console**
   - Use permanent URL: `https://webhooks.mycompany.com/webhook/whatsapp`

---

## 📁 Files Reference

### ngrok-Related Files

```
/tmp/ngrok-mvp.yml              # ngrok config (generated by setup script)
/tmp/ngrok.log                  # ngrok logs
/tmp/ngrok-webhook-urls.txt     # Saved webhook URLs
```

### Service Configuration

```
services/whatsapp-webhook-service/.env
  META_APP_ID=1162288675766205
  META_VERIFY_TOKEN=whatsapp_webhook_verify_token_2024
  WHATSAPP_BUSINESS_ID=667044745953003
  WHATSAPP_PHONE_NUMBER_ID=888340727686839
```

---

## 🔗 Useful Links

- **ngrok Dashboard**: https://dashboard.ngrok.com
- **ngrok Documentation**: https://ngrok.com/docs
- **Meta Developer Console**: https://developers.facebook.com/apps/1162288675766205
- **WhatsApp API Docs**: https://developers.facebook.com/docs/whatsapp
- **ngrok Web Interface**: http://localhost:4040

---

## 💡 Tips & Best Practices

1. **Keep ngrok running**
   - Start ngrok in a dedicated terminal
   - Or run in background: `ngrok http 3009 > /tmp/ngrok.log 2>&1 &`

2. **Save webhook URLs**
   - URLs are saved to `/tmp/ngrok-webhook-urls.txt`
   - Bookmark ngrok web interface: http://localhost:4040

3. **Use static subdomains (paid)**
   - Free plan: Random URLs that change on restart
   - Paid plan: Fixed subdomain, no need to update Meta

4. **Monitor both interfaces**
   - ngrok UI: View incoming webhook requests
   - Service logs: View application processing

5. **Test verification first**
   - Always test webhook verification before sending messages
   - Ensure verify token matches exactly

6. **Understand free tier limits**
   - 1 agent (1 tunnel per account)
   - Random URLs
   - 2-hour timeout if no traffic
   - Upgrade for static URLs and more tunnels

---

## 🎯 Quick Reference

### Start ngrok
```bash
./setup-ngrok.sh
```

### Check ngrok status
```bash
curl http://localhost:4040/api/tunnels | jq .
```

### Stop ngrok
```bash
pkill ngrok
```

### View webhook URL
```bash
cat /tmp/ngrok-webhook-urls.txt
```

### Test webhook
```bash
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*' | head -1)
curl "$NGROK_URL/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=whatsapp_webhook_verify_token_2024&hub.challenge=test"
```

---

**Questions or Issues?**
- Check ngrok logs: `cat /tmp/ngrok.log`
- Check service logs: `./logs-mvp.sh whatsapp-webhook`
- Visit ngrok web UI: http://localhost:4040
