# Customer Portal (Agent Portal) - Implementation Plan

## Goal

Build a comprehensive **Customer Portal** for the XYPR-Messaging Service. This is the primary interface where customers with Genesys credentials access and manage their WhatsApp Business integration. The portal provides Genesys OAuth authentication, WABA (WhatsApp Business Account) Embedded Signup, subscription management, analytics, and an integrated agent widget that replicates the Genesys agent interface.

> [!IMPORTANT]
> **Service Role Clarification**: Despite the directory name `agent-portal`, this is actually the **Customer Portal** where customers manage their XYPR service, NOT an agent workspace. The integrated agent widget within this portal replicates Genesys agent functionality.

## Phased Implementation

### Phase 1: Genesys OAuth Authentication (Priority: CRITICAL)
**Duration**: 1 week

#### 1.1 OAuth Flow Implementation
- **Files**:
  - `src/services/authService.ts` - Genesys OAuth client
  - `src/pages/Login.tsx` - Login page with Genesys button
  - `src/contexts/AuthContext.tsx` - Authentication state management

- **Implementation**:
  - Implement Genesys OAuth 2.0 authorization code flow
  - Store JWT tokens securely (httpOnly cookies)
  - Auto-refresh token mechanism
  - Protected route wrapper component
  - Logout and session management

#### 1.2 Customer Onboarding
- **Files**:
  - `src/pages/Onboarding.tsx` - First-time setup wizard
  - `src/services/tenantService.ts` - Tenant creation API

- **Features**:
  - Create tenant account on first login
  - Organization profile setup
  - Initial configuration wizard

---

### Phase 2: WABA Embedded Signup (Priority: CRITICAL)
**Duration**: 2 weeks

#### 2.1 WhatsApp Business Setup
- **Files**:
  - `src/components/WABASetup.tsx` - WABA Embedded Signup component
  - `src/services/whatsappService.ts` - WhatsApp API integration

- **Implementation**:
  - Integrate Meta's Embedded Signup flow
  - Handle OAuth callback from Meta
  - Store WABA ID, Phone Number ID, and Access Token
  - Webhook verification and setup
  - Display connected WhatsApp numbers

#### 2.2 Webhook Configuration
- **Files**:
  - `src/pages/Settings/WebhookConfig.tsx` - Webhook settings

- **Features**:
  - Auto-configure webhook URLs
  - Verify webhook connectivity
  - Display webhook event logs
  - Test webhook delivery

---

### Phase 3: Subscription Management (Priority: HIGH)
**Duration**: 1.5 weeks

#### 3.1 Subscription Plans
- **Files**:
  - `src/pages/Subscription.tsx` - Subscription plan display
  - `src/components/PricingTable.tsx` - Pricing tiers

- **Implementation**:
  - Display available subscription plans
  - Current plan status and usage
  - Upgrade/downgrade flows
  - Billing history

#### 3.2 Payment Integration
- **Files**:
  - `src/services/paymentService.ts` - Payment gateway integration

- **Features**:
  - Stripe/PayPal integration (TBD)
  - Invoice generation
  - Payment method management

---

### Phase 4: Dashboard & Analytics (Priority: HIGH)
**Duration**: 2 weeks

#### 4.1 Main Dashboard
- **Files**:
  - `src/pages/Dashboard.tsx` - Main dashboard
  - `src/components/analytics/MetricsCard.tsx` - Metric displays

- **Metrics**:
  - Total conversations (today/week/month)
  - Message volume (inbound/outbound)
  - Response time averages
  - Active vs. closed conversations
  - Customer satisfaction scores

#### 4.2 Reports & Analytics
- **Files**:
  - `src/pages/Reports.tsx` - Detailed reports
  - `src/components/charts/` - Chart components

- **Features**:
  - Conversation trend charts
  - Agent performance metrics
  - Peak hours heatmap
  - Export to CSV/PDF
  - Custom date range selection

---

### Phase 5: All Chats View (Priority: HIGH)
**Duration**: 1.5 weeks

#### 5.1 Conversation List
- **Files**:
  - `src/pages/Chats.tsx` - All conversations view
  - `src/components/ConversationList.tsx` - Conversation list

- **Features**:
  - Real-time conversation list
  - Filter by status (active/closed)
  - Search by customer name/phone
  - Sort by date/activity
  - Pagination/infinite scroll

#### 5.2 Conversation Details
- **Files**:
  - `src/components/ConversationDetails.tsx` - Conversation sidebar

- **Display**:
  - Customer profile information
  - Message history
  - Agent assignments
  - Conversation metadata

---

### Phase 6: Integrated Agent Widget (Priority: CRITICAL)
**Duration**: 2 weeks

#### 6.1 Agent Workspace
- **Files**:
  - `src/pages/AgentWorkspace.tsx` - Agent interface
  - `src/components/MessageComposer.tsx` - Message composition
  - `src/components/TemplateSelector.tsx` - WhatsApp template picker

- **Features**:
  - Real-time message updates (Socket.IO)
  - Message composition with formatting
  - WhatsApp template selection
  - Media attachment (image, document)
  - Quick replies
  - Typing indicators

#### 6.2 Customer Context Panel
- **Files**:
  - `src/components/CustomerProfile.tsx` - Customer details

- **Display**:
  - Customer name and profile picture
  - Phone number and WhatsApp ID
  - Previous conversation count
  - Last interaction timestamp
  - Customer notes and tags

**Note**: This widget replicates the Genesys agent interface functionality within the customer portal.

---

### Phase 7: Settings & Configuration (Priority: MEDIUM)
**Duration**: 1 week

#### 7.1 Organization Settings
- **Files**:
  - `src/pages/Settings/Organization.tsx` - Org settings
  - `src/pages/Settings/TeamManagement.tsx` - User management

- **Features**:
  - Update organization profile
  - Manage team members
  - Role assignments
  - API key management

#### 7.2 Integration Settings
- **Files**:
  - `src/pages/Settings/Integrations.tsx` - Integration config

- **Configuration**:
  - Genesys Cloud settings
  - WhatsApp Business settings
  - Webhook configuration
  - Custom field mapping

---

## Dependencies

```json
{
  "react": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "socket.io-client": "^4.6.1",
  "axios": "^1.6.2",
  "@tanstack/react-query": "^5.13.0",
  "tailwindcss": "^3.3.5",
  "recharts": "^2.10.0",
  "react-hook-form": "^7.48.0",
  "zod": "^3.22.0"
}
```

---

## Verification Plan

### Unit Tests
- OAuth flow components
- WABA setup workflow
- Dashboard metric calculations
- Payment integration

### Integration Tests
- End-to-end Genesys OAuth
- WABA Embedded Signup callback
- Subscription upgrade/downgrade
- Analytics data accuracy
- Agent widget real-time updates

### Manual Testing
1. **Authentication**: Login via Genesys → Verify tenant creation
2. **WABA Setup**: Complete Embedded Signup → Verify credentials stored
3. **Subscription**: Select plan → Verify payment processing
4. **Dashboard**: View metrics → Verify data accuracy
5. **Chats**: Browse conversations → Verify filtering/search
6. **Agent Widget**: Send/receive messages → Verify real-time updates

---

## Rollback Strategy
- Feature flags for new modules (OAuth, WABA, Subscriptions)
- Graceful degradation for missing backend features
- Keep legacy components during migration
- Database migration rollback scripts
