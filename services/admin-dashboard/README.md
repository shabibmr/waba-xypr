# Admin Dashboard - Quick Start Guide

## Setup & Testing Instructions

### Prerequisites Checklist

- [ ] Docker and Docker Compose installed
- [ ] Meta App created with WhatsApp Embedded Signup enabled
- [ ] Genesys Cloud OAuth Client created
- [ ] PostgreSQL and Redis running (via Docker Compose)

### Step 1: Configure Environment Variables

1. Copy the example file:
```bash
cp .env.example .env
```

2. Fill in your credentials:
```bash
# Genesys Cloud
GENESYS_CLIENT_ID=<your_genesys_client_id>
GENESYS_CLIENT_SECRET=<your_genesys_client_secret>
GENESYS_REGION=mypurecloud.com
GENESYS_REDIRECT_URI=http://localhost:3006/auth/callback

# Meta WhatsApp Embedded Signup
META_APP_ID=<your_meta_app_id>
META_APP_SECRET=<your_meta_app_secret>
META_CONFIG_ID=<your_meta_config_id>

# Frontend Environment (for Vite)
VITE_API_GATEWAY=http://localhost:3000
VITE_META_APP_ID=<your_meta_app_id>
VITE_META_CONFIG_ID=<your_meta_config_id>
```

### Step 2: Start Services

**Option A: Using Docker Compose (Recommended)**
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f admin-dashboard
```

**Option B: Manual Start (Development)**

1. Start infrastructure:
```bash
docker-compose up -d postgres redis rabbitmq
```

2. Start backend services:
```bash
# Terminal 1 - Auth Service
cd services/auth-service
npm install
npm start

# Terminal 2 - Tenant Service  
cd services/tenant-service
npm install
npm start

# Terminal 3 - API Gateway (if not already running)
cd services/api-gateway
npm start
```

3. Start admin dashboard:
```bash
# Terminal 4 - Admin Dashboard
cd services/admin-dashboard
npm install
npm run dev
```

### Step 3: Access the Dashboard

Open your browser to: **http://localhost:3006**

You should see:
- ✅ Sidebar with Dashboard, Tenants, Settings
- ✅ Dashboard page with service health monitoring
- ✅ Navigation working properly

### Step 4: Test Tenant Creation

1. Click **"Tenants"** in sidebar
2. Click **"Create Tenant"** button
3. Complete the wizard:

   **Step 1: Basic Info**
   - Tenant ID: `test-tenant`
   - Name: `Test Organization`
   - Subdomain: `test` (optional)
   - Plan: `standard`
   - Click **"Next"**

   **Step 2: Genesys OAuth**
   - Click **"Connect Genesys Cloud"**
   - Popup should open to Genesys login
   - Sign in with your Genesys credentials
   - Popup closes automatically
   - ✅ Organization details should appear
   - Click **"Next"**

   **Step 3: WhatsApp Business**
   - Click **"Connect WhatsApp Business"**
   - Meta popup should open
   - Select/create WhatsApp Business Account
   - Complete signup flow
   - ✅ WABA details should appear
   - Click **"Next"**

   **Step 4: Review**
   - Review all information
   - Click **"Create Tenant"**
   - ✅ Success message with API key
   - **SAVE THE API KEY!**

4. Verify tenant appears in the tenants list

### Step 5: Verify Database

Connect to PostgreSQL and check tables:

```sql
-- Check tenant was created
SELECT * FROM tenants WHERE tenant_id = 'test-tenant';

-- Check Genesys credentials stored
SELECT tenant_id, credential_type, created_at 
FROM tenant_credentials 
WHERE tenant_id = 'test-tenant';

-- Check WhatsApp config stored
SELECT tenant_id, waba_id, phone_number_id, display_phone_number 
FROM tenant_whatsapp_config 
WHERE tenant_id = 'test-tenant';

-- Check API key generated
SELECT api_key, tenant_id, name 
FROM tenant_api_keys 
WHERE tenant_id = 'test-tenant';
```

## Troubleshooting

### OAuth Popup Blocked
**Problem**: OAuth popup doesn't open  
**Solution**: Allow popups for localhost:3006 in browser settings

### "Tenant not found" Error
**Problem**: Tenant creation fails  
**Solution**: 
- Check tenant-service logs
- Verify database connection
- Ensure tables were created (check tenant-service startup logs)

### WhatsApp Signup Fails
**Problem**: Meta popup shows error  
**Solution**:
- Verify META_APP_ID and META_CONFIG_ID are correct
- Check Meta App is in development mode
- Ensure WhatsApp Embedded Signup is enabled in Meta App

### Genesys OAuth Fails
**Problem**: OAuth callback returns error  
**Solution**:
- Verify GENESYS_CLIENT_ID and GENESYS_CLIENT_SECRET
- Check redirect URI matches: `http://localhost:3006/auth/callback`
- Ensure OAuth client is configured in Genesys Admin

### Services Not Connecting
**Problem**: Admin dashboard can't reach backend services  
**Solution**:
- Verify all services are running:
  - Auth Service (port 3004)
  - Tenant Service (port 3007)
  - API Gateway (port 3000)
- Check Vite proxy configuration in `vite.config.js`
- Inspect browser console for CORS errors

## Testing Checklist

- [ ] Admin dashboard loads at http://localhost:3006
- [ ] Navigation works (Dashboard, Tenants, Settings)
- [ ] Dashboard shows service health status
- [ ] Can click "Create Tenant" button
- [ ] Step 1: Basic info form accepts input
- [ ] Step 2: Genesys OAuth popup opens
- [ ] Step 2: Organization details populate after login
- [ ] Step 3: WhatsApp signup popup opens
- [ ] Step 3: WABA details populate after signup
- [ ] Step 4: Review shows all data
- [ ] Tenant creation succeeds
- [ ] API key is displayed
- [ ] New tenant appears in tenants list
- [ ] Database has tenant record
- [ ] Database has credentials records
- [ ] Database has WhatsApp config record

## Next Steps After Testing

1. **Secure the Implementation**
   - Add admin authentication to dashboard
   - Implement credential encryption at rest
   - Add audit logging

2. **Deploy to Production**
   - Update environment variables for production URLs
   - Configure SSL/TLS certificates
   - Set up proper database backups
   - Configure monitoring and alerts

3. **Optional Enhancements**
   - Add tenant editing capability
   - Implement tenant usage statistics
   - Create tenant detail view
   - Add bulk operations

## Support

If you encounter issues:
1. Check service logs: `docker-compose logs <service-name>`
2. Verify environment variables are set correctly
3. Ensure all ports are available (3000, 3004, 3006, 3007)
4. Review the [walkthrough documentation](./walkthrough.md) for detailed architecture

---

**Ready to test!** 🚀

Start with `docker-compose up -d` and navigate to http://localhost:3006
