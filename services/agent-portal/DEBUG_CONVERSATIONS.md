# Debugging No Conversations Issue

## Step 1: Check Browser Console
Open browser DevTools (F12) and check:
1. **Network tab** - Look for the `/api/conversations` request
2. **Response** - What does the API return? Empty array or error?
3. **Console tab** - Any JavaScript errors?

## Step 2: Check WhatsApp Configuration
Run this SQL query in your PostgreSQL database:

```sql
-- Check if tenant has WhatsApp configured
SELECT
    t.tenant_id,
    t.name as tenant_name,
    twc.waba_id,
    twc.phone_number_id,
    twc.display_phone_number,
    twc.is_active,
    twc.created_at,
    twc.updated_at
FROM tenants t
LEFT JOIN tenant_whatsapp_config twc ON t.tenant_id = twc.tenant_id
ORDER BY t.created_at DESC;
```

**Expected:** You should see a row with `phone_number_id` filled and `is_active = true`

**If NULL or FALSE:** Run WhatsApp onboarding/signup flow

## Step 3: Check for Conversations in Database
```sql
-- Check if conversations exist for your phone number
SELECT
    cm.conversation_id,
    cm.wa_id,
    cm.phone_number_id,
    cm.contact_name,
    cm.status,
    cm.last_activity_at,
    cm.created_at
FROM conversation_mappings cm
WHERE cm.phone_number_id = 'YOUR_PHONE_NUMBER_ID_HERE'  -- Replace with actual value from Step 2
ORDER BY cm.last_activity_at DESC
LIMIT 10;
```

**Expected:** You should see conversation records
**If empty:** No conversations have been created yet - need to receive WhatsApp messages

## Step 4: Check User/Tenant Mapping
```sql
-- Verify the user is associated with the right tenant
SELECT
    gu.user_id,
    gu.name,
    gu.genesys_user_id,
    gu.tenant_id,
    t.name as tenant_name,
    twc.phone_number_id
FROM genesys_users gu
JOIN tenants t ON gu.tenant_id = t.tenant_id
LEFT JOIN tenant_whatsapp_config twc ON t.tenant_id = twc.tenant_id
WHERE gu.genesys_email = 'YOUR_EMAIL_HERE'  -- Replace with your login email
   OR gu.user_id = YOUR_USER_ID;  -- Or use user_id if known
```

## Step 5: Test the API Directly
Use curl to test the backend endpoint:

```bash
# Get your access token from browser localStorage or network request
TOKEN="your_access_token_here"

curl -X GET "http://localhost:3000/api/conversations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq
```

Look for:
- `conversations` array - should contain conversation objects
- `total` count - should be > 0
- Any error messages

## Step 6: Check Authentication
In Workspace.jsx, add console logging to `loadData()`:

```javascript
const loadData = async () => {
    try {
        const agentData = await authService.getProfile();
        console.log('Agent data:', agentData);  // ← Add this
        setAgent(agentData);

        const convData = await conversationService.getConversations();
        console.log('Conversations response:', convData);  // ← Add this
        setConversations(convData.conversations || []);
    } catch (error) {
        console.error('Failed to load data:', error);
        // ... rest
    }
};
```

## Common Solutions

### Solution 1: WhatsApp Not Configured
Complete the WhatsApp onboarding flow:
1. Navigate to `/onboarding` in the agent portal
2. Complete all WhatsApp configuration steps
3. Verify `tenant_whatsapp_config` table has your data

### Solution 2: No Test Data
Create test conversations by:
1. Sending a WhatsApp message to your configured WhatsApp Business number
2. OR insert test data manually:

```sql
INSERT INTO conversation_mappings (
    wa_id,
    phone_number_id,
    conversation_id,
    contact_name,
    status
) VALUES (
    '1234567890',  -- WhatsApp ID (phone number)
    'YOUR_PHONE_NUMBER_ID',  -- From tenant_whatsapp_config
    'test-conv-001',
    'Test Contact',
    'active'
);
```

### Solution 3: Fix phone_number_id Mismatch
Update the tenant_whatsapp_config with the correct phone_number_id:

```sql
UPDATE tenant_whatsapp_config
SET phone_number_id = 'CORRECT_PHONE_NUMBER_ID',
    is_active = true
WHERE tenant_id = 'YOUR_TENANT_ID';
```

## Quick Health Check
Run this comprehensive query to see the full picture:

```sql
SELECT
    'Tenants' as table_name,
    COUNT(*) as count
FROM tenants
UNION ALL
SELECT 'WhatsApp Configs', COUNT(*) FROM tenant_whatsapp_config WHERE is_active = true
UNION ALL
SELECT 'Conversations', COUNT(*) FROM conversation_mappings
UNION ALL
SELECT 'Users', COUNT(*) FROM genesys_users
UNION ALL
SELECT 'Active Sessions', COUNT(*) FROM genesys_user_sessions WHERE is_active = true;
```
