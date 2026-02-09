# Tenant Service - Implementation Plan

## Goal

Build a secure, scalable tenant management system that handles multi-tenant credentials, configurations, API keys, provisioning workflows, and usage tracking with encryption and audit capabilities.

## Phased Implementation

### Phase 1: Credential Management (Priority: CRITICAL)
**Duration**: 2 weeks

#### 1.1 Encryption Layer
- **Files**:
  - `src/services/encryptionService.js` - Encryption/decryption
  - `src/config/encryption.config.js` - Encryption configuration

- **Implementation**:
  - Use AES-256-GCM for credential encryption
  - Integrate with AWS KMS or HashiCorp Vault
  - Implement key rotation mechanism
  - Add encryption at rest and in transit

#### 1.2 WhatsApp Credential Storage
- **Files**:
  - `src/models/WhatsAppAccount.js` - WhatsApp account model
  - `src/services/whatsappCredentialService.js` - Credential management
  - `migrations/xxx_create_whatsapp_accounts.ts` - Database migration

- **Schema**:
```javascript
{
  id: uuid,
  tenant_id: uuid,
  business_account_id: string,
  phone_number_id: string,
  access_token: encrypted_string,
  app_secret: encrypted_string,
  display_name: string,
  is_active: boolean
}
```

#### 1.3 Genesys Credential Storage
- **Files**:
  - `src/models/GenesysOrganization.js` - Genesys org model
  - `src/services/genesysCredentialService.js` - Credential management

- **Schema**:
```javascript
{
  id: uuid,
  tenant_id: uuid,
  organization_id: string,
  deployment_region: string,
  client_id: encrypted_string,
  client_secret: encrypted_string,
  is_active: boolean
}
```

---

### Phase 2: API Key Management (Priority: HIGH)
**Duration**: 1 week

#### 2.1 API Key Generation
- **Files**:
  - `src/services/apiKeyService.js` - API key operations
  - `src/models/APIKey.js` - API key model

- **Implementation**:
  - Generate cryptographically secure API keys
  - Support key prefixes (tenant-specific)
  - Store hashed keys in database
  - Track key creation and last used timestamps

#### 2.2 Key Lifecycle Management
- **Implementation**:
  - Implement key expiration (configurable)
  - Add key revocation endpoints
  - Support key rotation
  - Track key usage metrics

---

### Phase 3: Tenant Provisioning (Priority: HIGH)
**Duration**: 2 weeks

#### 3.1 Onboarding Workflow
- **Files**:
  - `src/services/provisioningService.js` - Provisioning logic
  - `src/controllers/provisioning.controller.js` - API endpoints

- **Workflow**:
  1. Create tenant record
  2. Verify WhatsApp Business Account
  3. Verify Genesys organization
  4. Generate API keys
  5. Configure webhooks
  6. Initialize configurations

#### 3.2 Verification Services
- **Files**:
  - `src/services/whatsappVerificationService.js`
  - `src/services/genesysVerificationService.js`

- **Implementation**:
  - Verify WhatsApp credentials with Meta API
  - Verify Genesys credentials with OAuth flow
  - Validate webhook URLs
  - Test connectivity

---

### Phase 4: Tenant Configurations (Priority: MEDIUM)
**Duration**: 1.5 weeks

#### 4.1 Configuration Management
- **Files**:
  - `src/models/TenantConfig.js` - Configuration model
  - `src/services/configService.js` - Config operations

- **Configurations**:
```javascript
{
  tenant_id: uuid,
  rate_limits: {
    messages_per_minute: number,
    api_calls_per_hour: number
  },
  retention_policy: {
    message_retention_days: number,
    conversation_retention_days: number
  },
  features: {
    template_messages: boolean,
    media_messages: boolean,
    analytics: boolean
  },
  branding: {
    logo_url: string,
    primary_color: string,
    company_name: string
  }
}
```

---

### Phase 5: Usage Tracking & Analytics (Priority: MEDIUM)
**Duration**: 1.5 weeks

#### 5.1 Usage Metrics
- **Files**:
  - `src/models/TenantUsage.js` - Usage tracking model
  - `src/services/usageTracker.js` - Usage tracking service

- **Metrics to Track**:
  - Message count (inbound/outbound)
  - API call count
  - Storage usage
  - Active conversations
  - Template message usage

#### 5.2 Quota Management
- **Files**:
  - `src/services/quotaService.js` - Quota enforcement

- **Implementation**:
  - Define quotas per tenant tier
  - Enforce quota limits
  - Send alerts when approaching limits
  - Support quota overrides

---

### Phase 6: Audit & Compliance (Priority: MEDIUM)
**Duration**: 1 week

#### 6.1 Audit Logging
- **Files**:
  - `src/models/AuditLog.js` - Audit log model
  - `src/middleware/auditMiddleware.js` - Audit middleware

- **Events to Audit**:
  - Credential access and updates
  - Configuration changes
  - API key generation/revocation
  - Tenant provisioning/deprovisioning

---

### Phase 7: Multi-region Support (Priority: LOW)
**Duration**: 1 week

#### 7.1 Regional Configuration
- **Files**:
  - `src/services/regionService.js` - Region management

- **Implementation**:
  - Support region-specific configurations
  - Implement data residency compliance
  - Add cross-region tenant lookup

---

## Dependencies

```json
{
  "crypto": "built-in",
  "aws-sdk": "^2.1500.0",
  "bcryptjs": "^2.4.3",
  "uuid": "^9.0.1"
}
```

**External Services**:
- AWS KMS or HashiCorp Vault (encryption keys)
- PostgreSQL (tenant data)
- Redis (caching)

---

## Verification Plan

### Unit Tests
- Credential encryption/decryption
- API key generation and validation
- Tenant provisioning workflow
- Usage tracking logic

### Integration Tests
- WhatsApp credential verification
- Genesys OAuth verification
- End-to-end provisioning
- Multi-tenant isolation

### Security Tests
- Encryption strength verification
- Key rotation testing
- Access control validation
- Audit log completeness

### Manual Testing
1. Provision new tenant with WhatsApp and Genesys
2. Generate and validate API keys
3. Update tenant configuration
4. Verify credential encryption
5. Test quota enforcement

---

## Rollback Strategy
- Database migrations are reversible
- Encrypted credentials remain accessible
- Feature flags for provisioning workflow
- Maintain backward compatibility for API keys
