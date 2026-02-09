# Real Credentials Configuration

**Date**: 2026-02-05
**Status**: ✅ All credentials updated

---

## Genesys Cloud Credentials

### Configuration Details
```
Client ID: 7c513299-40e9-4c51-a34f-935bd56cfb56
Client Secret: -Yn-vPj1HCDq8HvYeadbLVBAx0I5wVkvcVKdS1MqRXo
Region: aps1
Open Messaging Secret: fK93hs2@dL!92kQ
Open Messaging Integration ID: 953973be-eb1f-4a3b-8541-62b3e809c803
```

### Genesys Base URL
```
https://api.aps1.pure.cloud
```

### OAuth Redirect URI
```
http://localhost:3014/auth/callback
```

### Services Updated
- ✅ Auth Service (.env)
- ✅ Genesys API Service (.env)
- ✅ Genesys Webhook Service (.env)
- ✅ Customer Portal Backend (.env)
- ✅ Database (tenant_credentials table)

---

## Meta WhatsApp Business API Credentials

### Configuration Details
```
App ID: 1162288675766205
Business Account ID: 790704466912512
Phone Number ID: 888340727686839
Access Token: EAAQhGGulP70BPmNwdzOALJ3CPc6ivZCr41oECVDfifZBbIotzMgQL7dKRUyaWSZBpOPZC9mkGkZBKrs0ITG1G6TuLnxLBG0oFCqSLuA8ZA62BLirO5snyjxkkjJx4oJYnzlmg9ijPRiACoox0zpU3e237BlObJ9nHFquHSM69qURKF6cDtcK6SsKgGGaVbvHnjhwZDZD
Verify Token: whatsapp_webhook_verify_token_2024
```

### Meta Graph API URL
```
https://graph.facebook.com/v21.0
```

### Webhook Configuration (for Meta Developer Console)
```
Webhook URL: <YOUR_PUBLIC_URL>/webhook/whatsapp
Verify Token: whatsapp_webhook_verify_token_2024
```

### Services Updated
- ✅ WhatsApp Webhook Service (.env)
- ✅ WhatsApp API Service (.env)
- ✅ Customer Portal Frontend (.env)
- ✅ Database (tenant_credentials table)

---

## Database Credentials

### Demo Tenant
```
Tenant ID: 00000000-0000-0000-0000-000000000001
Name: Demo Tenant
Status: Active
```

### Credential Storage
Both Genesys and WhatsApp credentials are stored in the `tenant_credentials` table as JSONB:

```sql
-- View current credentials
SELECT
  tenant_id,
  credential_type,
  credentials,
  is_active,
  updated_at
FROM tenant_credentials
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
```

---

## Infrastructure Credentials

### PostgreSQL
```
Host: localhost
Port: 5432
Database: waba_mvp
User: postgres
Password: your_secure_password
```

### Redis
```
URL: redis://localhost:6379
```

### RabbitMQ
```
URL: amqp://admin:admin123@localhost:5672
Management UI: http://localhost:15672
Username: admin
Password: admin123
```

### MinIO
```
Endpoint: http://localhost:9000
Console: http://localhost:9001
Access Key: admin
Secret Key: admin123
```

---

## Service Environment Files Updated

### 1. services/auth-service/.env
```env
GENESYS_CLIENT_ID=7c513299-40e9-4c51-a34f-935bd56cfb56
GENESYS_CLIENT_SECRET=-Yn-vPj1HCDq8HvYeadbLVBAx0I5wVkvcVKdS1MqRXo
GENESYS_REGION=aps1
GENESYS_OPEN_MSG_SECRET=fK93hs2@dL!92kQ
GENESYS_OPEN_MSG_INTEGRATION_ID=953973be-eb1f-4a3b-8541-62b3e809c803
```

### 2. services/genesys-api-service/.env
```env
GENESYS_CLIENT_ID=7c513299-40e9-4c51-a34f-935bd56cfb56
GENESYS_CLIENT_SECRET=-Yn-vPj1HCDq8HvYeadbLVBAx0I5wVkvcVKdS1MqRXo
GENESYS_REGION=aps1
GENESYS_OPEN_MSG_SECRET=fK93hs2@dL!92kQ
GENESYS_OPEN_MSG_INTEGRATION_ID=953973be-eb1f-4a3b-8541-62b3e809c803
```

### 3. services/genesys-webhook-service/.env
```env
GENESYS_CLIENT_ID=7c513299-40e9-4c51-a34f-935bd56cfb56
GENESYS_CLIENT_SECRET=-Yn-vPj1HCDq8HvYeadbLVBAx0I5wVkvcVKdS1MqRXo
GENESYS_REGION=aps1
GENESYS_OPEN_MSG_SECRET=fK93hs2@dL!92kQ
GENESYS_OPEN_MSG_INTEGRATION_ID=953973be-eb1f-4a3b-8541-62b3e809c803
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
```

### 4. services/agent-portal-service/.env
```env
GENESYS_CLIENT_ID=7c513299-40e9-4c51-a34f-935bd56cfb56
GENESYS_CLIENT_SECRET=-Yn-vPj1HCDq8HvYeadbLVBAx0I5wVkvcVKdS1MqRXo
GENESYS_REGION=aps1
GENESYS_OPEN_MSG_SECRET=fK93hs2@dL!92kQ
GENESYS_OPEN_MSG_INTEGRATION_ID=953973be-eb1f-4a3b-8541-62b3e809c803
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
```

### 5. services/whatsapp-webhook-service/.env
```env
META_APP_ID=1162288675766205
META_VERIFY_TOKEN=whatsapp_webhook_verify_token_2024
WHATSAPP_BUSINESS_ID=667044745953003
WHATSAPP_PHONE_NUMBER_ID=888340727686839
WHATSAPP_ACCESS_TOKEN=EAAQhGGulP70...
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
```

### 6. services/whatsapp-api-service/.env
```env
META_APP_ID=1162288675766205
WHATSAPP_BUSINESS_ID=667044745953003
WHATSAPP_PHONE_NUMBER_ID=888340727686839
WHATSAPP_ACCESS_TOKEN=EAAQhGGulP70...
```

### 7. services/agent-portal/.env (Frontend)
```env
VITE_API_URL=http://localhost:3015
VITE_META_APP_ID=1162288675766205
VITE_GENESYS_REGION=aps1
```

---

## Next Steps to Complete Setup

### 1. Configure Webhooks in Meta Developer Console

1. Go to: https://developers.facebook.com/apps/1162288675766205
2. Navigate to WhatsApp → Configuration
3. Set Webhook URL:
   - **URL**: `https://your-public-domain.com/webhook/whatsapp`
   - **Verify Token**: `whatsapp_webhook_verify_token_2024`
4. Subscribe to webhook fields:
   - `messages` ✅
   - `message_status` ✅

### 2. Configure Webhooks in Genesys Cloud

1. Log into Genesys Cloud: https://apps.aps1.pure.cloud
2. Navigate to: Admin → Integrations → Open Messaging
3. Find your integration: `953973be-eb1f-4a3b-8541-62b3e809c803`
4. Set Outbound Notification Webhook URL:
   - **URL**: `https://your-public-domain.com/webhook/genesys`

### 3. Set Up Public URLs (Choose One)

**Option A: ngrok (Development/Testing)**
```bash
# Install ngrok
brew install ngrok

# Start tunnels
ngrok http 3009 --subdomain=whatsapp-webhook  # WhatsApp Webhook
ngrok http 3011 --subdomain=genesys-webhook   # Genesys Webhook
```

**Option B: Production Domain**
- Set up reverse proxy (nginx/caddy)
- Configure SSL certificates
- Point domain to your server
- Update webhook URLs in Meta and Genesys

### 4. Test Token Generation

**Test Genesys OAuth:**
```bash
curl -X POST http://localhost:3004/auth/genesys/token \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"00000000-0000-0000-0000-000000000001"}'
```

**Expected Response:**
```json
{
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

### 5. Verify WhatsApp Credentials

**Test sending a message:**
```bash
curl -X POST http://localhost:3008/whatsapp/send \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "to": "+1234567890",
    "type": "text",
    "text": {
      "body": "Test message from XYPR"
    }
  }'
```

---

## Security Notes

### ⚠️ Important Security Considerations

1. **Access Tokens**: The WhatsApp access token shown here is a long-lived token. In production:
   - Rotate tokens regularly
   - Use environment variables
   - Never commit to version control

2. **Secrets Management**: Consider using:
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault
   - Kubernetes Secrets

3. **Webhook Verification**:
   - WhatsApp webhook service validates using `META_VERIFY_TOKEN`
   - Genesys webhook service validates using `GENESYS_OPEN_MSG_SECRET`

4. **JWT Secrets**:
   - Update `JWT_SECRET` in production
   - Use strong, random values (32+ characters)

5. **Database Passwords**:
   - Change `your_secure_password` to a strong password
   - Use different passwords for each environment

---

## Credential Validation Status

### ✅ Configuration Complete
- [x] Genesys credentials in all services
- [x] WhatsApp credentials in all services
- [x] Database credentials updated
- [x] Infrastructure credentials set
- [x] Frontend environment variables updated

### ⚠️ Pending External Configuration
- [ ] Set up public webhook URLs (ngrok or domain)
- [ ] Configure webhooks in Meta Developer Console
- [ ] Configure webhooks in Genesys Cloud Admin
- [ ] Test end-to-end message flow
- [ ] Verify OAuth flow with Customer Portal

---

## Testing Checklist

### Before Webhooks
- [ ] Auth service generates Genesys tokens
- [ ] WhatsApp API service sends messages
- [ ] Genesys API service sends messages
- [ ] Customer Portal loads successfully
- [ ] All services respond to health checks

### After Webhook Configuration
- [ ] WhatsApp → Genesys message flow
- [ ] Genesys → WhatsApp message flow
- [ ] Message status updates
- [ ] Conversation state tracking
- [ ] Media attachments (images, videos)
- [ ] Delivery receipts
- [ ] Read receipts

---

**Last Updated**: 2026-02-05
**Updated By**: Claude (Credentials configuration completed)
