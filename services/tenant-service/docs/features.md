# Tenant Service Features

Based on the codebase analysis, the following features are implemented in `services/tenant-service`:

## 1. Tenant Management
*   **CRUD Operations**: Full Create, Read, and Update capabilities for Tenants are implemented in `tenantController.js` and `tenantService.js`.
*   **Auto-Provisioning**: The `ensureTenantByGenesysOrg` function logic automatically provisions a new tenant if one doesn't exist for a given Genesys Organization ID. It correctly generates a unique `slug` (based on the org name) and assigns a unique sub-domain.
*   **API Key Management**: The service automatically generates a secure `sk_...` API key for every newly created tenant.

## 2. Genesys Integration
*   **Credential Vault**: There are specific endpoints to securely set and retrieve Genesys OAuth credentials (`clientId`, `clientSecret`, `region`).
*   **Security & Masking**:
    *   Credentials are returned **masked** (e.g., `***1234`) to the user to prevent leakage.
    *   **Note**: The README references `encryption.util.js` for "Credential encryption", but this file was **not found** in the codebase. Currently, credentials appear to be stored as JSONB in the database without application-level encryption (relying on database security).

## 3. WhatsApp Business API (WABA) Onboarding
*   **Embedded Signup Flow**: The service includes a `handleSignupCallback` endpoint that supports the Meta Embedded Signup flow:
    *   It exchanges the authorization `code` for a long-lived access token.
    *   It automatically fetches the WABA ID, Phone Number ID, Display Name, and Quality Rating from Meta's Graph API using the token.
*   **Configuration Management**: Stores and updates WABA configuration (IDs, tokens) per tenant.

## 4. Infrastructure & Data
*   **Schema Management**: `schemaService.js` handles the initialization of the database tables.
*   **Caching**: Redis caching is implemented with a standard 1-hour TTL for:
    *   Tenant Data lookup
    *   Genesys Credentials lookup
    *   WhatsApp Configuration lookup

## 5. Comprehensive Database Schema

The service uses the following PostgreSQL schema definitions (extracted from `schemaService.js`):

### Tenants Table
Stores core tenant information and Genesys organization mapping.
```sql
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE,
  status VARCHAR(20) DEFAULT 'active',
  plan VARCHAR(50) DEFAULT 'standard',
  rate_limit INTEGER DEFAULT 100,
  genesys_org_id VARCHAR(100),
  genesys_org_name VARCHAR(255),
  genesys_region VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);
-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenant_subdomain ON tenants(subdomain);
```

### Tenant Credentials Table
Stores external system credentials (e.g., Genesys).
```sql
CREATE TABLE IF NOT EXISTS tenant_credentials (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(50) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  credential_type VARCHAR(50) NOT NULL, -- e.g. 'genesys'
  credentials JSONB NOT NULL,           -- e.g. { clientId, clientSecret, region }
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### WhatsApp Configuration Table
Stores Meta/WhatsApp Business API settings per tenant.
```sql
CREATE TABLE IF NOT EXISTS tenant_whatsapp_config (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(50) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  waba_id VARCHAR(100) NOT NULL,
  phone_number_id VARCHAR(100) NOT NULL,
  access_token TEXT NOT NULL,
  business_id VARCHAR(100),
  display_phone_number VARCHAR(50),
  quality_rating VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id)
);
-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_waba ON tenant_whatsapp_config(tenant_id);
```

### API Keys Table
Stores API keys for tenant authentication.
```sql
CREATE TABLE IF NOT EXISTS tenant_api_keys (
  api_key VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(50) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP
);
```

## 6. Connected Services

The Tenant Service interacts with the following internal and external components:

*   **Internal Services**:
    *   **PostgreSQL**: Primary data store for tenants and credentials.
    *   **Redis**: High-performance caching layer.
    *   **Agent Portal Service**: Consumes tenant data for user session management and routing.
    *   **Admin Dashboard**: UI for managing tenant configurations (downstream consumer).

*   **External Integrations**:
    *   **Genesys Cloud**: Validates organization details and OAuth credentials.
    *   **Meta Graph API (WhatsApp)**: Handles Embedded Signup and fetches WABA details.
