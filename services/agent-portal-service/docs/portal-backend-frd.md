# Agent Portal Service - Complete Technical Specification

**Document Type**: Functional Requirements & Implementation Guide  
**Service Name**: `agent-portal-service`  
**Version**: 2.0 (LLM-Optimized for Claude Code)  
**Architecture**: Stateless Orchestration Layer  
**Tech Stack**: Node.js/Express, Redis, WebSocket (Socket.IO), REST APIs  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Service Architecture](#2-service-architecture)
3. [System Context & Dependencies](#3-system-context--dependencies)
4. [Data Architecture](#4-data-architecture)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Onboarding Workflow](#6-onboarding-workflow)
7. [Dashboard & Metrics](#7-dashboard--metrics)
8. [Conversation Management](#8-conversation-management)
9. [Agent Widget Integration](#9-agent-widget-integration)
10. [Real-time Monitoring](#10-real-time-monitoring)
11. [API Specification](#11-api-specification)
12. [Security Implementation](#12-security-implementation)
13. [Performance & Scalability](#13-performance--scalability)
14. [Error Handling & Resilience](#14-error-handling--resilience)
15. [Observability](#15-observability)
16. [Implementation Guide](#16-implementation-guide)

---

# 1. Executive Summary

## 1.1 Purpose

The **Agent Portal Service** is the backend orchestration engine that powers the customer portal interface.
It provides a secure, stateless API layer between frontend applications and backend microservices.

**Key Principle**: This service is a **pure orchestration layer** - it does NOT own any data permanently.
All data is either retrieved from authoritative services or cached temporarily in Redis.

## 1.2 Core Responsibilities

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    AGENT PORTAL SERVICE                         â”‚
â”‚                  (Stateless Orchestration)                      â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                 â”‚
â”‚  1. SESSION MANAGEMENT                                          â”‚
â”‚     â€¢ Genesys Cloud SSO authentication flow                     â”‚
â”‚     â€¢ Token validation via Auth Service                         â”‚
â”‚     â€¢ HTTP-only secure session cookies                          â”‚
â”‚     â€¢ Multi-tenant isolation enforcement                        â”‚
â”‚                                                                 â”‚
â”‚  2. ONBOARDING ORCHESTRATION                                    â”‚
â”‚     â€¢ Multi-step wizard state management                        â”‚
â”‚     â€¢ Credential validation (Genesys + WhatsApp)                â”‚
â”‚     â€¢ Webhook URL generation                                    â”‚
â”‚     â€¢ Configuration persistence via Tenant Service              â”‚
â”‚                                                                 â”‚
â”‚  3. DATA AGGREGATION                                            â”‚
â”‚     â€¢ Metrics calculation from State Manager                    â”‚
â”‚     â€¢ Conversation history retrieval                            â”‚
â”‚     â€¢ Dashboard data caching (Redis)                            â”‚
â”‚     â€¢ Pagination for large datasets                             â”‚
â”‚                                                                 â”‚
â”‚  4. CONFIGURATION PROXY                                         â”‚
â”‚     â€¢ Secure tenant config updates                              â”‚
â”‚     â€¢ Validation before persistence                             â”‚
â”‚     â€¢ Prevent direct frontend-to-service access                 â”‚
â”‚                                                                 â”‚
â”‚  5. REAL-TIME MONITORING                                        â”‚
â”‚     â€¢ WebSocket-based message streaming                         â”‚
â”‚     â€¢ Live status updates                                       â”‚
â”‚     â€¢ Debug and support visibility                              â”‚
â”‚                                                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

## 1.3 Service Characteristics

| Characteristic | Description |
|----------------|-------------|
| **Data Ownership** | None - pure mediator pattern |
| **State Management** | Stateless (sessions in Redis) |
| **Scalability** | Horizontally scalable |
| **Availability** | High (99.9% target) |
| **Latency** | < 300ms for dashboard queries |
| **Security** | OAuth 2.0, tenant isolation, encryption |

---

# 2. Service Architecture

## 2.1 High-Level Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        FRONTEND LAYER                           â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Agent Portal UI   â”‚  Agent Interaction Widget                  â”‚
â”‚  (React/Vue)       â”‚  (Embedded in Genesys)                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚                    â”‚
         â”‚ HTTPS              â”‚ HTTPS + WebSocket
         â–¼                    â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚              AGENT PORTAL SERVICE (THIS SERVICE)                â”‚
â”‚                                                                 â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ Auth         â”‚  â”‚ Onboarding   â”‚  â”‚ Dashboard          â”‚   â”‚
â”‚  â”‚ Controller   â”‚  â”‚ Controller   â”‚  â”‚ Controller         â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                                 â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ History      â”‚  â”‚ Widget       â”‚  â”‚ WebSocket          â”‚   â”‚
â”‚  â”‚ Controller   â”‚  â”‚ Controller   â”‚  â”‚ Manager            â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                                 â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚              Middleware Layer                           â”‚   â”‚
â”‚  â”‚  â€¢ Authentication   â€¢ Validation   â€¢ Rate Limiting      â”‚   â”‚
â”‚  â”‚  â€¢ CORS             â€¢ Error Handler â€¢ Logger            â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚              â”‚              â”‚             â”‚
         â”‚              â”‚              â”‚             â”‚ (cache)
         â–¼              â–¼              â–¼             â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   Auth      â”‚  â”‚   Tenant    â”‚  â”‚   State    â”‚  â”‚  Redis   â”‚
â”‚   Service   â”‚  â”‚   Service   â”‚  â”‚   Manager  â”‚  â”‚          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

## 2.2 Design Patterns

### Mediator Pattern
Acts as intermediary between frontend and backend services,
preventing direct coupling and enforcing security boundaries.

### Facade Pattern
Provides simplified, unified interface to complex backend operations
(e.g., multi-step onboarding abstracts multiple service calls).

### Cache-Aside Pattern
Checks cache first, retrieves from source on miss, updates cache.
Used for metrics and conversation data.

### Circuit Breaker Pattern
Protects against cascading failures from downstream services.
Implements fallback responses and automatic recovery.

---

# 3. System Context & Dependencies

## 3.1 External Service Dependencies

### 3.1.1 Auth Service

**Purpose**: OAuth 2.0 token validation and user profile resolution

**Endpoints**:
```javascript
const AUTH_SERVICE = {
  baseUrl: process.env.AUTH_SERVICE_URL,
  
  endpoints: {
    // Validate Genesys OAuth token
    validateToken: 'POST /api/v1/auth/validate',
    // Request body: { token: string }
    // Response: { valid: boolean, userId: string, expiresAt: string }
    
    // Get user profile from validated token
    getUserProfile: 'GET /api/v1/auth/profile',
    // Headers: { Authorization: 'Bearer <token>' }
    // Response: { userId, email, name, tenantId, role }
    
    // Refresh access token
    refreshToken: 'POST /api/v1/auth/refresh',
    // Request body: { refreshToken: string }
    // Response: { accessToken, refreshToken, expiresAt }
  },
  
  // Timeout configuration
  timeouts: {
    validateToken: 3000,    // 3 seconds
    getUserProfile: 2000,   // 2 seconds
    refreshToken: 3000      // 3 seconds
  }
};
```

**Example Implementation**:
```javascript
class AuthServiceClient {
  constructor(baseUrl, timeout = 3000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: timeout
    });
  }
  
  async validateToken(token) {
    try {
      const response = await this.axios.post('/api/v1/auth/validate', {
        token
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Auth Service token validation failed', {
        error: error.message,
        statusCode: error.response?.status
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async getUserProfile(accessToken) {
    try {
      const response = await this.axios.get('/api/v1/auth/profile', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      return {
        success: true,
        profile: response.data
      };
    } catch (error) {
      logger.error('Auth Service profile retrieval failed', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

### 3.1.2 Tenant Service

**Purpose**: Tenant configuration CRUD operations

**Endpoints**:
```javascript
const TENANT_SERVICE = {
  baseUrl: process.env.TENANT_SERVICE_URL,
  
  endpoints: {
    // Create new tenant
    createTenant: 'POST /api/v1/tenants',
    // Request: { companyName, region, contactEmail, status }
    // Response: { id, companyName, region, status, createdAt }
    
    // Get tenant by ID
    getTenant: 'GET /api/v1/tenants/:id',
    // Response: { id, companyName, region, genesysConfig, whatsappConfig, ... }
    
    // Update tenant configuration
    updateTenant: 'PUT /api/v1/tenants/:id',
    // Request: { genesysConfig?, whatsappConfig?, status?, ... }
    // Response: { id, ...updated fields, updatedAt }
    
    // Get tenant by user ID
    getTenantByUserId: 'GET /api/v1/tenants/by-user/:userId',
    // Response: { id, companyName, ... }
    
    // Validate credentials
    validateCredentials: 'POST /api/v1/tenants/validate',
    // Request: { type: 'genesys'|'whatsapp', credentials: {...} }
    // Response: { valid: boolean, message: string }
  },
  
  timeouts: {
    createTenant: 5000,      // 5 seconds
    updateTenant: 5000,      // 5 seconds
    getTenant: 2000,         // 2 seconds
    validateCredentials: 10000 // 10 seconds (external API calls)
  }
};
```

**Example Implementation**:
```javascript
class TenantServiceClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: 5000
    });
  }
  
  async createTenant(data) {
    const response = await this.axios.post('/api/v1/tenants', {
      companyName: data.companyName,
      region: data.region,
      contactEmail: data.contactEmail,
      status: 'onboarding'
    });
    
    return response.data;
  }
  
  async updateTenant(tenantId, updates) {
    const response = await this.axios.put(
      `/api/v1/tenants/${tenantId}`,
      updates
    );
    
    return response.data;
  }
  
  async getTenantByUserId(userId) {
    const response = await this.axios.get(
      `/api/v1/tenants/by-user/${userId}`
    );
    
    return response.data;
  }
  
  async validateGenesysCredentials(credentials) {
    const response = await this.axios.post(
      '/api/v1/tenants/validate',
      {
        type: 'genesys',
        credentials: {
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          region: credentials.region
        }
      },
      { timeout: 10000 }
    );
    
    return response.data;
  }
  
  async validateWhatsAppCredentials(credentials) {
    const response = await this.axios.post(
      '/api/v1/tenants/validate',
      {
        type: 'whatsapp',
        credentials: {
          phoneNumberId: credentials.phoneNumberId,
          systemUserToken: credentials.systemUserToken
        }
      },
      { timeout: 10000 }
    );
    
    return response.data;
  }
}
```

### 3.1.3 State Manager

**Purpose**: Message tracking and conversation data retrieval

**Endpoints**:
```javascript
const STATE_MANAGER = {
  baseUrl: process.env.STATE_MANAGER_URL,
  
  endpoints: {
    // Get conversations for tenant
    getConversations: 'GET /api/v1/conversations',
    // Query params: { tenantId, page, limit, status? }
    // Response: { data: [...], pagination: {...} }
    
    // Get specific conversation
    getConversation: 'GET /api/v1/conversations/:id',
    // Response: { id, tenantId, waId, status, createdAt, ... }
    
    // Get messages for conversation
    getMessages: 'GET /api/v1/conversations/:id/messages',
    // Response: [ { messageId, direction, text, status, timestamp, ... } ]
    
    // Get metrics for tenant
    getMetrics: 'GET /api/v1/metrics/:tenantId',
    // Query params: { period: 'today'|'week'|'month' }
    // Response: { totalMessages, sent, delivered, read, failed, ... }
  },
  
  timeouts: {
    getConversations: 5000,  // 5 seconds
    getMessages: 5000,       // 5 seconds
    getMetrics: 3000         // 3 seconds
  }
};
```

**Example Implementation**:
```javascript
class StateManagerClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: 5000
    });
  }
  
  async getConversations(tenantId, options = {}) {
    const params = {
      tenantId,
      page: options.page || 1,
      limit: options.limit || 20,
      ...(options.status && { status: options.status })
    };
    
    const response = await this.axios.get('/api/v1/conversations', {
      params
    });
    
    return response.data;
  }
  
  async getConversation(conversationId) {
    const response = await this.axios.get(
      `/api/v1/conversations/${conversationId}`
    );
    
    return response.data;
  }
  
  async getMessages(conversationId) {
    const response = await this.axios.get(
      `/api/v1/conversations/${conversationId}/messages`
    );
    
    return response.data;
  }
  
  async getMetrics(tenantId, period = 'today') {
    const response = await this.axios.get(
      `/api/v1/metrics/${tenantId}`,
      {
        params: { period },
        timeout: 3000
      }
    );
    
    return response.data;
  }
}
```

### 3.1.4 Redis

**Purpose**: Session storage, metrics caching, onboarding state

**Configuration**:
```javascript
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0,
  
  // Key expiration times (seconds)
  ttl: {
    session: 86400,        // 24 hours
    onboarding: 3600,      // 1 hour
    metrics: 600,          // 10 minutes
    conversations: 300     // 5 minutes
  },
  
  // Key patterns
  keys: {
    session: (sessionId) => `session:${sessionId}`,
    onboarding: (tenantId) => `onboarding:${tenantId}`,
    metrics: (tenantId, period) => `metrics:${tenantId}:${period}`,
    conversations: (tenantId, page) => `conversations:${tenantId}:${page}`
  }
};
```

**Example Implementation**:
```javascript
const Redis = require('ioredis');

class RedisClient {
  constructor(config) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });
    
    this.ttl = config.ttl;
    this.keys = config.keys;
  }
  
  // Session management
  async setSession(sessionId, data) {
    const key = this.keys.session(sessionId);
    await this.client.setex(
      key,
      this.ttl.session,
      JSON.stringify(data)
    );
  }
  
  async getSession(sessionId) {
    const key = this.keys.session(sessionId);
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }
  
  async deleteSession(sessionId) {
    const key = this.keys.session(sessionId);
    await this.client.del(key);
  }
  
  // Onboarding state
  async setOnboardingState(tenantId, state) {
    const key = this.keys.onboarding(tenantId);
    await this.client.setex(
      key,
      this.ttl.onboarding,
      JSON.stringify(state)
    );
  }
  
  async getOnboardingState(tenantId) {
    const key = this.keys.onboarding(tenantId);
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }
  
  async deleteOnboardingState(tenantId) {
    const key = this.keys.onboarding(tenantId);
    await this.client.del(key);
  }
  
  // Metrics caching
  async cacheMetrics(tenantId, period, metrics) {
    const key = this.keys.metrics(tenantId, period);
    await this.client.setex(
      key,
      this.ttl.metrics,
      JSON.stringify(metrics)
    );
  }
  
  async getCachedMetrics(tenantId, period) {
    const key = this.keys.metrics(tenantId, period);
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }
  
  async clearMetricsCache(tenantId) {
    const pattern = `metrics:${tenantId}:*`;
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
}
```

## 3.2 Dependency Flow Diagram

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    REQUEST FLOW EXAMPLE:                        â”‚
â”‚              Get Dashboard Metrics for Tenant                   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

1. Frontend Request
   GET /api/v1/dashboard/stats
   Cookie: sessionId=abc123
   
   â†“
   
2. Agent Portal Service
   â€¢ Validate session from Redis
   â€¢ Extract tenantId from session
   â€¢ Check metrics cache in Redis
   
   â†“ (cache miss)
   
3. Query State Manager
   GET /api/v1/metrics/:tenantId?period=today
   
   â†“
   
4. State Manager Response
   {
     totalMessages: 1000,
     sent: 950,
     delivered: 920,
     read: 850,
     failed: 30,
     activeConversations: 45,
     distinctWaIds: 38
   }
   
   â†“
   
5. Agent Portal Service
   â€¢ Calculate success rate
   â€¢ Cache result in Redis (10 min TTL)
   â€¢ Return formatted response
   
   â†“
   
6. Frontend Response
   {
     totalMessages: 1000,
     sentCount: 950,
     deliveredCount: 920,
     readCount: 850,
     failedCount: 30,
     successRate: "92.0",
     activeConversations: 45,
     uniqueCustomers: 38,
     period: "today",
     lastUpdated: "2026-02-12T08:30:00Z"
   }
```

---

# 4. Data Architecture

## 4.1 Data Ownership Principle

**Critical Principle**: Agent Portal Service is a **pure orchestration layer**.

```
âœ… DOES:
   â€¢ Cache temporary data in Redis
   â€¢ Aggregate data from multiple sources
   â€¢ Transform/format data for frontend
   â€¢ Manage ephemeral session state

âŒ DOES NOT:
   â€¢ Own tenant configurations (Tenant Service)
   â€¢ Own message data (State Manager)
   â€¢ Own user authentication (Auth Service)
   â€¢ Persist any business data to database
```

## 4.2 Redis Data Schemas

### 4.2.1 Session Storage

**Key Pattern**: `session:{sessionId}`  
**TTL**: 24 hours (86400 seconds)  
**Purpose**: Maintain authenticated user sessions

**Schema**:
```javascript
{
  userId: "string",           // Genesys user ID
  tenantId: "string",          // Associated tenant UUID
  role: "admin|agent|viewer",  // User role for RBAC
  email: "string",             // User email
  name: "string",              // User display name
  createdAt: "ISO timestamp",  // Session creation time
  expiresAt: "ISO timestamp",  // Session expiration time
  lastActivity: "ISO timestamp" // Last request timestamp
}
```

**Example**:
```javascript
// Create session
await redis.setSession('sess_abc123', {
  userId: 'user_xyz789',
  tenantId: 'tenant_def456',
  role: 'admin',
  email: 'john.doe@example.com',
  name: 'John Doe',
  createdAt: '2026-02-12T08:00:00Z',
  expiresAt: '2026-02-13T08:00:00Z',
  lastActivity: '2026-02-12T08:00:00Z'
});

// Retrieve session
const session = await redis.getSession('sess_abc123');
if (!session) {
  throw new Error('Session expired or invalid');
}

// Update last activity
session.lastActivity = new Date().toISOString();
await redis.setSession('sess_abc123', session);

// Destroy session
await redis.deleteSession('sess_abc123');
```

### 4.2.2 Onboarding State Cache

**Key Pattern**: `onboarding:{tenantId}`  
**TTL**: 30-60 minutes (3600 seconds)  
**Purpose**: Track multi-step onboarding wizard progress

**Schema**:
```javascript
{
  step: 1-5,                   // Current wizard step
  tenantId: "string",          // Tenant UUID
  
  // Step 1: Organization Details
  organizationDetails: {
    companyName: "string",
    region: "string",          // Genesys region
    contactEmail: "string"
  },
  
  // Step 2: Genesys Configuration
  genesysConfig: {
    clientId: "string",
    clientSecret: "string",    // Encrypted
    region: "string",
    validated: boolean
  },
  
  // Step 3: WhatsApp Configuration
  whatsappConfig: {
    phoneNumberId: "string",
    systemUserToken: "string", // Encrypted
    validated: boolean
  },
  
  // Metadata
  createdAt: "ISO timestamp",
  lastUpdated: "ISO timestamp",
  completedSteps: [1, 2, 3]    // Array of completed step numbers
}
```

**Example**:
```javascript
// Initialize onboarding
await redis.setOnboardingState('tenant_123', {
  step: 1,
  tenantId: 'tenant_123',
  organizationDetails: {
    companyName: 'Acme Corp',
    region: 'us-east-1',
    contactEmail: 'admin@acme.com'
  },
  createdAt: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  completedSteps: [1]
});

// Update for next step
const state = await redis.getOnboardingState('tenant_123');
state.step = 2;
state.genesysConfig = {
  clientId: 'client_abc',
  clientSecret: encryptedSecret,
  region: 'us-east-1',
  validated: true
};
state.completedSteps.push(2);
state.lastUpdated = new Date().toISOString();
await redis.setOnboardingState('tenant_123', state);

// Complete onboarding - clean up
await redis.deleteOnboardingState('tenant_123');
```

### 4.2.3 Metrics Cache

**Key Pattern**: `metrics:{tenantId}:{period}`  
**TTL**: 5-15 minutes (600 seconds)  
**Purpose**: Cache calculated dashboard metrics

**Schema**:
```javascript
{
  totalMessages: number,
  sentCount: number,
  deliveredCount: number,
  readCount: number,
  failedCount: number,
  successRate: string,         // Percentage as string (e.g., "92.5")
  activeConversations: number,
  uniqueCustomers: number,     // Distinct wa_id count
  period: "today|week|month",
  calculatedAt: "ISO timestamp"
}
```

**Example**:
```javascript
// Cache metrics
await redis.cacheMetrics('tenant_123', 'today', {
  totalMessages: 1000,
  sentCount: 950,
  deliveredCount: 920,
  readCount: 850,
  failedCount: 30,
  successRate: "92.0",
  activeConversations: 45,
  uniqueCustomers: 38,
  period: 'today',
  calculatedAt: '2026-02-12T08:30:00Z'
});

// Retrieve cached metrics
const cached = await redis.getCachedMetrics('tenant_123', 'today');
if (cached) {
  return cached;
}

// Clear all metric caches for tenant
await redis.clearMetricsCache('tenant_123');
```

### 4.2.4 Conversation List Cache

**Key Pattern**: `conversations:{tenantId}:{page}`  
**TTL**: 5 minutes (300 seconds)  
**Purpose**: Cache paginated conversation lists

**Schema**:
```javascript
{
  data: [
    {
      wa_id: "string",
      conversation_id: "string",
      last_activity: "ISO timestamp",
      status: "active|closed",
      message_count: number
    }
  ],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  },
  cachedAt: "ISO timestamp"
}
```

## 4.3 Cookie Configuration

**Session Cookie Settings**:
```javascript
const SESSION_COOKIE_CONFIG = {
  name: 'sessionId',
  httpOnly: true,              // Prevent XSS attacks
  secure: true,                // HTTPS only in production
  sameSite: 'strict',          // CSRF protection
  maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  path: '/',
  domain: process.env.COOKIE_DOMAIN || undefined,
  signed: true                 // Use cookie-parser secret
};

// Usage in Express
app.use(cookieParser(process.env.COOKIE_SECRET));

// Set cookie
res.cookie('sessionId', sessionId, SESSION_COOKIE_CONFIG);

// Read cookie
const sessionId = req.signedCookies.sessionId;

// Clear cookie
res.clearCookie('sessionId', SESSION_COOKIE_CONFIG);
```

---

# 5. Authentication & Authorization

## 5.1 SSO Flow (REQ-PORTAL-01)

**Complete OAuth 2.0 Authorization Code Flow with Genesys Cloud**

### Flow Diagram

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚          â”‚  1. GET /auth/login                  â”‚             â”‚
â”‚          â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–ºâ”‚             â”‚
â”‚          â”‚                                      â”‚             â”‚
â”‚          â”‚  2. Redirect to Genesys OAuth       â”‚   Agent     â”‚
â”‚  User    â”‚â—„â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤   Portal    â”‚
â”‚  Browser â”‚  Location: https://login.genesys...  â”‚   Service   â”‚
â”‚          â”‚                                      â”‚             â”‚
â”‚          â”‚  3. User authenticates with Genesys  â”‚             â”‚
â”‚          â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                   â”‚             â”‚
â”‚          â”‚                  â”‚                   â”‚             â”‚
â”‚          â”‚  4. Genesys redirects with code      â”‚             â”‚
â”‚          â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–ºâ”‚             â”‚
â”‚          â”‚  GET /auth/callback?code=xyz&state=abc             â”‚
â”‚          â”‚                                      â”‚             â”‚
â”‚          â”‚  5. Validate token via Auth Service  â”‚             â”‚
â”‚          â”‚                     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤             â”‚
â”‚          â”‚                     â”‚                â”‚             â”‚
â”‚          â”‚                     â–¼                â”‚             â”‚
â”‚          â”‚              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”‚             â”‚
â”‚          â”‚              â”‚    Auth     â”‚         â”‚             â”‚
â”‚          â”‚              â”‚   Service   â”‚         â”‚             â”‚
â”‚          â”‚              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚             â”‚
â”‚          â”‚                     â”‚                â”‚             â”‚
â”‚          â”‚  6. Get user profile & tenant        â”‚             â”‚
â”‚          â”‚                     â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤             â”‚
â”‚          â”‚                     â”‚                â”‚             â”‚
â”‚          â”‚                     â–¼                â”‚             â”‚
â”‚          â”‚              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”‚             â”‚
â”‚          â”‚              â”‚   Tenant    â”‚         â”‚             â”‚
â”‚          â”‚              â”‚   Service   â”‚         â”‚             â”‚
â”‚          â”‚              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚             â”‚
â”‚          â”‚                     â”‚                â”‚             â”‚
â”‚          â”‚  7. Create session in Redis          â”‚             â”‚
â”‚          â”‚                     â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤             â”‚
â”‚          â”‚                     â”‚                â”‚             â”‚
â”‚          â”‚                     â–¼                â”‚             â”‚
â”‚          â”‚                â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”            â”‚             â”‚
â”‚          â”‚                â”‚ Redis  â”‚            â”‚             â”‚
â”‚          â”‚                â””â”€â”€â”€â”€â”€â”€â”€â”€â”˜            â”‚             â”‚
â”‚          â”‚                     â”‚                â”‚             â”‚
â”‚          â”‚  8. Set HTTP-only cookie & redirect  â”‚             â”‚
â”‚          â”‚â—„â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤             â”‚
â”‚          â”‚  Set-Cookie: sessionId=...           â”‚             â”‚
â”‚          â”‚  Location: /dashboard                â”‚             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Implementation

#### Step 1: Initiate Login

```javascript
/**
 * Endpoint: GET /api/v1/auth/login
 * Purpose: Initiate Genesys Cloud OAuth 2.0 flow
 */
router.get('/auth/login', (req, res) => {
  // Generate secure state parameter for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  
  // Store state in short-lived session (5 minutes)
  req.session.oauthState = state;
  
  // Construct Genesys authorization URL
  const authUrl = new URL('https://login.mypurecloud.com/oauth/authorize');
  authUrl.searchParams.set('client_id', process.env.GENESYS_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', process.env.GENESYS_REDIRECT_URI);
  authUrl.searchParams.set('state', state);
  
  // Optional: Add scope if needed
  // authUrl.searchParams.set('scope', 'openid profile email');
  
  logger.info('Initiating OAuth login', {
    redirectUri: process.env.GENESYS_REDIRECT_URI,
    state: state.substring(0, 8) + '...' // Log partial state
  });
  
  res.redirect(authUrl.toString());
});
```

#### Step 2-3: User Authentication (Genesys Cloud)

User authenticates with Genesys Cloud directly.
This happens on Genesys servers, not in our application.

#### Step 4-8: Handle OAuth Callback

```javascript
/**
 * Endpoint: GET /api/v1/auth/callback
 * Purpose: Handle OAuth callback from Genesys Cloud
 */
router.get('/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  try {
    // 1. Validate state parameter (CSRF protection)
    if (!state || state !== req.session.oauthState) {
      logger.warn('OAuth state mismatch', { 
        received: state, 
        expected: req.session.oauthState 
      });
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    
    // Clear used state
    delete req.session.oauthState;
    
    // 2. Check for OAuth errors
    if (error) {
      logger.error('OAuth error from Genesys', { error });
      return res.redirect('/login?error=' + encodeURIComponent(error));
    }
    
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }
    
    // 3. Validate authorization code with Auth Service
    logger.info('Validating authorization code', { 
      code: code.substring(0, 10) + '...' 
    });
    
    const tokenValidation = await authService.validateToken(code);
    
    if (!tokenValidation.success) {
      logger.error('Token validation failed', { 
        error: tokenValidation.error 
      });
      return res.redirect('/login?error=token_validation_failed');
    }
    
    const { accessToken, expiresAt } = tokenValidation.data;
    
    // 4. Get user profile from Auth Service
    const profileResponse = await authService.getUserProfile(accessToken);
    
    if (!profileResponse.success) {
      logger.error('Failed to retrieve user profile', { 
        error: profileResponse.error 
      });
      return res.redirect('/login?error=profile_retrieval_failed');
    }
    
    const userProfile = profileResponse.profile;
    
    // 5. Resolve tenant via Tenant Service
    logger.info('Resolving tenant for user', { userId: userProfile.userId });
    
    const tenant = await tenantService.getTenantByUserId(userProfile.userId);
    
    if (!tenant) {
      logger.error('No tenant found for user', { userId: userProfile.userId });
      return res.redirect('/login?error=no_tenant');
    }
    
    // 6. Create session in Redis
    const sessionId = generateSecureSessionId();
    const sessionData = {
      userId: userProfile.userId,
      tenantId: tenant.id,
      role: userProfile.role || 'agent',
      email: userProfile.email,
      name: userProfile.name,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      lastActivity: new Date().toISOString()
    };
    
    await redis.setSession(sessionId, sessionData);
    
    logger.info('Session created successfully', {
      sessionId: sessionId.substring(0, 8) + '...',
      userId: userProfile.userId,
      tenantId: tenant.id
    });
    
    // 7. Set HTTP-only secure cookie
    res.cookie('sessionId', sessionId, SESSION_COOKIE_CONFIG);
    
    // 8. Redirect to dashboard
    res.redirect('/dashboard');
    
  } catch (error) {
    logger.error('OAuth callback error', {
      error: error.message,
      stack: error.stack
    });
    
    res.redirect('/login?error=unexpected_error');
  }
});
```

#### Helper: Generate Secure Session ID

```javascript
function generateSecureSessionId() {
  // Generate cryptographically secure random session ID
  const randomBytes = crypto.randomBytes(32);
  const timestamp = Date.now().toString(36);
  const random = randomBytes.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `sess_${timestamp}_${random}`;
}
```

## 5.2 Session Validation Middleware

```javascript
/**
 * Authentication Middleware
 * Validates session on every protected route
 */
async function requireAuth(req, res, next) {
  const correlationId = req.id; // From express-request-id
  
  try {
    // 1. Extract session ID from cookie
    const sessionId = req.signedCookies.sessionId;
    
    if (!sessionId) {
      logger.warn('Missing session cookie', { correlationId });
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'NO_SESSION'
      });
    }
    
    // 2. Retrieve session from Redis
    const sessionData = await redis.getSession(sessionId);
    
    if (!sessionData) {
      logger.warn('Session not found in Redis', { 
        sessionId: sessionId.substring(0, 8) + '...',
        correlationId 
      });
      return res.status(401).json({ 
        error: 'Session expired or invalid',
        code: 'SESSION_EXPIRED'
      });
    }
    
    // 3. Check session expiration
    const expiresAt = new Date(sessionData.expiresAt);
    if (expiresAt < new Date()) {
      logger.warn('Session expired', {
        sessionId: sessionId.substring(0, 8) + '...',
        expiresAt: sessionData.expiresAt,
        correlationId
      });
      
      // Clean up expired session
      await redis.deleteSession(sessionId);
      res.clearCookie('sessionId');
      
      return res.status(401).json({ 
        error: 'Session expired',
        code: 'SESSION_EXPIRED'
      });
    }
    
    // 4. Update last activity timestamp
    sessionData.lastActivity = new Date().toISOString();
    await redis.setSession(sessionId, sessionData);
    
    // 5. Attach session data to request
    req.session = sessionData;
    req.userId = sessionData.userId;
    req.tenantId = sessionData.tenantId;
    req.userRole = sessionData.role;
    
    logger.debug('Session validated', {
      sessionId: sessionId.substring(0, 8) + '...',
      userId: sessionData.userId,
      tenantId: sessionData.tenantId,
      correlationId
    });
    
    next();
    
  } catch (error) {
    logger.error('Session validation error', {
      error: error.message,
      stack: error.stack,
      correlationId
    });
    
    res.status(500).json({ 
      error: 'Authentication service error',
      code: 'AUTH_ERROR'
    });
  }
}

// Usage
app.use('/api/v1/dashboard', requireAuth, dashboardRouter);
app.use('/api/v1/onboarding', requireAuth, onboardingRouter);
app.use('/api/v1/history', requireAuth, historyRouter);
```

## 5.3 Tenant Isolation Middleware

```javascript
/**
 * Tenant Isolation Middleware
 * Ensures users can only access data for their own tenant
 */
function enforceTenantIsolation(req, res, next) {
  const { tenantId: sessionTenantId } = req.session;
  
  // Check URL parameters
  const urlTenantId = req.params.tenantId;
  if (urlTenantId && urlTenantId !== sessionTenantId) {
    logger.warn('Tenant isolation violation attempt', {
      sessionTenantId,
      requestedTenantId: urlTenantId,
      userId: req.userId,
      path: req.path
    });
    
    return res.status(403).json({ 
      error: 'Access denied - tenant mismatch',
      code: 'TENANT_ISOLATION_VIOLATION'
    });
  }
  
  // Check request body
  const bodyTenantId = req.body.tenantId;
  if (bodyTenantId && bodyTenantId !== sessionTenantId) {
    logger.warn('Tenant isolation violation attempt in body', {
      sessionTenantId,
      requestedTenantId: bodyTenantId,
      userId: req.userId
    });
    
    return res.status(403).json({ 
      error: 'Access denied - tenant mismatch',
      code: 'TENANT_ISOLATION_VIOLATION'
    });
  }
  
  next();
}

// Usage
router.get('/conversations/:conversationId', 
  requireAuth, 
  enforceTenantIsolation, 
  async (req, res) => {
    // At this point, req.tenantId is guaranteed to match session
    // ...
  }
);
```

## 5.4 Token Refresh

```javascript
/**
 * Endpoint: POST /api/v1/auth/refresh
 * Purpose: Refresh expired access token
 */
router.post('/auth/refresh', requireAuth, async (req, res) => {
  const { sessionId } = req.signedCookies;
  
  try {
    // Get current session
    const session = await redis.getSession(sessionId);
    
    if (!session) {
      return res.status(401).json({ error: 'Session not found' });
    }
    
    // Request new token from Auth Service
    const refreshResponse = await authService.refreshToken(
      session.userId
    );
    
    if (!refreshResponse.success) {
      logger.error('Token refresh failed', {
        userId: session.userId,
        error: refreshResponse.error
      });
      
      return res.status(401).json({ 
        error: 'Token refresh failed',
        code: 'REFRESH_FAILED'
      });
    }
    
    // Update session expiration
    session.expiresAt = refreshResponse.data.expiresAt;
    await redis.setSession(sessionId, session);
    
    logger.info('Token refreshed successfully', {
      userId: session.userId,
      newExpiresAt: session.expiresAt
    });
    
    res.json({ 
      success: true,
      expiresAt: session.expiresAt
    });
    
  } catch (error) {
    logger.error('Token refresh error', {
      error: error.message
    });
    
    res.status(500).json({ error: 'Token refresh failed' });
  }
});
```

## 5.5 Logout

```javascript
/**
 * Endpoint: POST /api/v1/auth/logout
 * Purpose: End user session
 */
router.post('/auth/logout', requireAuth, async (req, res) => {
  const sessionId = req.signedCookies.sessionId;
  
  try {
    // Delete session from Redis
    await redis.deleteSession(sessionId);
    
    // Clear cookie
    res.clearCookie('sessionId', SESSION_COOKIE_CONFIG);
    
    logger.info('User logged out', {
      userId: req.userId,
      tenantId: req.tenantId,
      sessionId: sessionId.substring(0, 8) + '...'
    });
    
    res.json({ success: true, message: 'Logged out successfully' });
    
  } catch (error) {
    logger.error('Logout error', {
      error: error.message,
      userId: req.userId
    });
    
    // Still clear cookie even if Redis fails
    res.clearCookie('sessionId', SESSION_COOKIE_CONFIG);
    
    res.status(500).json({ 
      error: 'Logout failed',
      message: 'Session cleared locally'
    });
  }
});
```

---

# 6. Onboarding Workflow

## 6.1 Overview (REQ-PORTAL-02)

**Purpose**: Guide new tenants through 5-step configuration wizard

**State Management**: Redis-backed stateful wizard with 30-60 minute TTL

**Flow**:
```
Step 1: Organization Details
   â†“
Step 2: Genesys Configuration + Validation
   â†“
Step 3: WhatsApp Configuration + Validation
   â†“
Step 4: Integration Testing (parallel)
   â†“
Step 5: Webhook Setup + Finalization
```

## 6.2 Step 1: Organization Details

**Purpose**: Collect basic tenant information

**Endpoint**: `POST /api/v1/onboarding/step1`

**Request Body**:
```json
{
  "companyName": "Acme Corporation",
  "region": "us-east-1",
  "contactEmail": "admin@acme.com"
}
```

**Validation Rules**:
- `companyName`: Required, 2-100 characters
- `region`: Required, valid Genesys region
- `contactEmail`: Required, valid email format

**Implementation**:
```javascript
router.post('/onboarding/step1', requireAuth, async (req, res) => {
  const { companyName, region, contactEmail } = req.body;
  const { userId, tenantId: sessionTenantId } = req.session;
  
  try {
    // 1. Validate input
    const validation = validateStep1Input({ 
      companyName, 
      region, 
      contactEmail 
    });
    
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validation.errors
      });
    }
    
    // 2. Create preliminary tenant entry in Tenant Service
    logger.info('Creating preliminary tenant', {
      companyName,
      region,
      userId
    });
    
    const tenant = await tenantService.createTenant({
      companyName,
      region,
      contactEmail,
      status: 'onboarding',
      createdBy: userId
    });
    
    // 3. Initialize onboarding state in Redis
    const onboardingState = {
      step: 1,
      tenantId: tenant.id,
      organizationDetails: {
        companyName,
        region,
        contactEmail
      },
      completedSteps: [1],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    await redis.setOnboardingState(tenant.id, onboardingState);
    
    logger.info('Step 1 completed', {
      tenantId: tenant.id,
      companyName
    });
    
    res.json({
      success: true,
      tenantId: tenant.id,
      currentStep: 1,
      nextStep: 2,
      data: {
        companyName,
        region
      }
    });
    
  } catch (error) {
    logger.error('Step 1 failed', {
      error: error.message,
      userId
    });
    
    res.status(500).json({ 
      error: 'Failed to complete step 1',
      message: error.message
    });
  }
});

// Validation function
function validateStep1Input({ companyName, region, contactEmail }) {
  const errors = [];
  
  if (!companyName || companyName.length < 2 || companyName.length > 100) {
    errors.push('Company name must be between 2-100 characters');
  }
  
  const validRegions = [
    'us-east-1', 'us-east-2', 'us-west-2', 
    'eu-west-1', 'eu-central-1',
    'ap-southeast-2', 'ap-northeast-1'
  ];
  
  if (!region || !validRegions.includes(region)) {
    errors.push(`Region must be one of: ${validRegions.join(', ')}`);
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!contactEmail || !emailRegex.test(contactEmail)) {
    errors.push('Valid email address required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

## 6.3 Step 2: Genesys Configuration

**Purpose**: Configure and validate Genesys Cloud integration

**Endpoint**: `POST /api/v1/onboarding/step2`

**Request Body**:
```json
{
  "tenantId": "tenant_uuid",
  "clientId": "genesys_client_id",
  "clientSecret": "genesys_client_secret",
  "region": "us-east-1"
}
```

**Implementation**:
```javascript
router.post('/onboarding/step2', requireAuth, async (req, res) => {
  const { tenantId, clientId, clientSecret, region } = req.body;
  const { userId } = req.session;
  
  try {
    // 1. Retrieve onboarding state
    const state = await redis.getOnboardingState(tenantId);
    
    if (!state) {
      return res.status(400).json({ 
        error: 'Onboarding session expired',
        code: 'SESSION_EXPIRED'
      });
    }
    
    if (state.step !== 1) {
      return res.status(400).json({ 
        error: `Must complete step ${state.step} first`,
        code: 'INVALID_STEP'
      });
    }
    
    // 2. Validate Genesys credentials
    logger.info('Validating Genesys credentials', {
      tenantId,
      clientId: clientId.substring(0, 8) + '...',
      region
    });
    
    const validation = await validateGenesysCredentials({
      clientId,
      clientSecret,
      region
    });
    
    if (!validation.success) {
      logger.warn('Genesys validation failed', {
        tenantId,
        error: validation.error
      });
      
      return res.status(400).json({
        error: 'Invalid Genesys credentials',
        details: validation.error,
        code: 'VALIDATION_FAILED'
      });
    }
    
    // 3. Encrypt credentials before caching
    const encryptedSecret = await encryptCredential(clientSecret);
    
    // 4. Update onboarding state
    state.step = 2;
    state.genesysConfig = {
      clientId,
      clientSecret: encryptedSecret,
      region,
      validated: true,
      validatedAt: new Date().toISOString()
    };
    state.completedSteps.push(2);
    state.lastUpdated = new Date().toISOString();
    
    await redis.setOnboardingState(tenantId, state);
    
    logger.info('Step 2 completed', {
      tenantId,
      region
    });
    
    res.json({
      success: true,
      tenantId,
      currentStep: 2,
      nextStep: 3,
      validated: true
    });
    
  } catch (error) {
    logger.error('Step 2 failed', {
      error: error.message,
      tenantId,
      userId
    });
    
    res.status(500).json({ 
      error: 'Failed to complete step 2',
      message: error.message
    });
  }
});

/**
 * Validate Genesys Cloud credentials
 * Attempts OAuth token exchange
 */
async function validateGenesysCredentials({ clientId, clientSecret, region }) {
  try {
    // Construct region-specific OAuth URL
    const tokenUrl = `https://login.${region}.pure.cloud/oauth/token`;
    
    const response = await axios.post(
      tokenUrl,
      {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      },
      { timeout: 10000 }
    );
    
    if (response.data.access_token) {
      logger.info('Genesys credentials validated', {
        clientId: clientId.substring(0, 8) + '...',
        region,
        expiresIn: response.data.expires_in
      });
      
      return { 
        success: true, 
        token: response.data.access_token,
        expiresIn: response.data.expires_in
      };
    }
    
    return { 
      success: false, 
      error: 'No access token received'
    };
    
  } catch (error) {
    logger.error('Genesys validation error', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
}

/**
 * Encrypt sensitive credential data
 * Uses AES-256-GCM encryption
 */
async function encryptCredential(plaintext) {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return iv + authTag + encrypted data
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt credential data
 */
async function decryptCredential(encrypted) {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

## 6.4 Step 3: WhatsApp Configuration

**Purpose**: Configure and validate Meta WhatsApp Business API

**Endpoint**: `POST /api/v1/onboarding/step3`

**Request Body**:
```json
{
  "tenantId": "tenant_uuid",
  "phoneNumberId": "whatsapp_phone_number_id",
  "systemUserToken": "meta_system_user_token"
}
```

**Implementation**:
```javascript
router.post('/onboarding/step3', requireAuth, async (req, res) => {
  const { tenantId, phoneNumberId, systemUserToken } = req.body;
  
  try {
    // 1. Retrieve onboarding state
    const state = await redis.getOnboardingState(tenantId);
    
    if (!state) {
      return res.status(400).json({ 
        error: 'Onboarding session expired'
      });
    }
    
    if (state.step !== 2) {
      return res.status(400).json({ 
        error: `Must complete step ${state.step} first`
      });
    }
    
    // 2. Validate WhatsApp credentials
    logger.info('Validating WhatsApp credentials', {
      tenantId,
      phoneNumberId
    });
    
    const validation = await validateWhatsAppCredentials({
      phoneNumberId,
      systemUserToken
    });
    
    if (!validation.success) {
      logger.warn('WhatsApp validation failed', {
        tenantId,
        phoneNumberId,
        error: validation.error
      });
      
      return res.status(400).json({
        error: 'Invalid WhatsApp credentials',
        details: validation.error,
        code: 'VALIDATION_FAILED'
      });
    }
    
    // 3. Encrypt token before caching
    const encryptedToken = await encryptCredential(systemUserToken);
    
    // 4. Update onboarding state
    state.step = 3;
    state.whatsappConfig = {
      phoneNumberId,
      systemUserToken: encryptedToken,
      validated: true,
      validatedAt: new Date().toISOString(),
      phoneNumber: validation.phoneNumber // Retrieved from Meta API
    };
    state.completedSteps.push(3);
    state.lastUpdated = new Date().toISOString();
    
    await redis.setOnboardingState(tenantId, state);
    
    logger.info('Step 3 completed', {
      tenantId,
      phoneNumberId
    });
    
    res.json({
      success: true,
      tenantId,
      currentStep: 3,
      nextStep: 4,
      validated: true,
      phoneNumber: validation.phoneNumber
    });
    
  } catch (error) {
    logger.error('Step 3 failed', {
      error: error.message,
      tenantId
    });
    
    res.status(500).json({ 
      error: 'Failed to complete step 3'
    });
  }
});

/**
 * Validate WhatsApp Business API credentials
 * Tests Meta Graph API access
 */
async function validateWhatsAppCredentials({ phoneNumberId, systemUserToken }) {
  try {
    // Query Meta Graph API to verify phone number and access
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}`;
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${systemUserToken}`
      },
      params: {
        fields: 'id,display_phone_number,verified_name,quality_rating'
      },
      timeout: 10000
    });
    
    if (response.data.id === phoneNumberId) {
      logger.info('WhatsApp credentials validated', {
        phoneNumberId,
        phoneNumber: response.data.display_phone_number,
        verified: response.data.verified_name
      });
      
      return {
        success: true,
        phoneNumber: response.data.display_phone_number,
        verifiedName: response.data.verified_name,
        qualityRating: response.data.quality_rating
      };
    }
    
    return {
      success: false,
      error: 'Phone number ID mismatch'
    };
    
  } catch (error) {
    logger.error('WhatsApp validation error', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    if (error.response?.status === 403) {
      return {
        success: false,
        error: 'Invalid access token or insufficient permissions'
      };
    }
    
    if (error.response?.status === 404) {
      return {
        success: false,
        error: 'Phone number ID not found'
      };
    }
    
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
}
```

## 6.5 Step 4: Integration Validation

**Purpose**: Test both integrations in parallel

**Endpoint**: `GET /api/v1/onboarding/validate`

**Implementation**:
```javascript
router.get('/onboarding/validate', requireAuth, async (req, res) => {
  const { tenantId } = req.query;
  
  try {
    // 1. Retrieve onboarding state
    const state = await redis.getOnboardingState(tenantId);
    
    if (!state) {
      return res.status(400).json({ 
        error: 'Onboarding session expired'
      });
    }
    
    if (state.step !== 3) {
      return res.status(400).json({ 
        error: 'Complete steps 1-3 first'
      });
    }
    
    // 2. Decrypt credentials
    const genesysSecret = await decryptCredential(
      state.genesysConfig.clientSecret
    );
    const whatsappToken = await decryptCredential(
      state.whatsappConfig.systemUserToken
    );
    
    // 3. Test connections in parallel
    logger.info('Testing integrations', { tenantId });
    
    const [genesysResult, whatsappResult] = await Promise.allSettled([
      testGenesysConnection({
        clientId: state.genesysConfig.clientId,
        clientSecret: genesysSecret,
        region: state.genesysConfig.region
      }),
      testWhatsAppConnection({
        phoneNumberId: state.whatsappConfig.phoneNumberId,
        systemUserToken: whatsappToken
      })
    ]);
    
    // 4. Process results
    const results = {
      genesys: genesysResult.status === 'fulfilled' && genesysResult.value.success
        ? 'success'
        : 'failed',
      whatsapp: whatsappResult.status === 'fulfilled' && whatsappResult.value.success
        ? 'success'
        : 'failed',
      details: {
        genesys: genesysResult.status === 'fulfilled'
          ? genesysResult.value.message
          : genesysResult.reason?.message || 'Connection test failed',
        whatsapp: whatsappResult.status === 'fulfilled'
          ? whatsappResult.value.message
          : whatsappResult.reason?.message || 'Connection test failed'
      }
    };
    
    logger.info('Integration validation results', {
      tenantId,
      genesys: results.genesys,
      whatsapp: results.whatsapp
    });
    
    res.json(results);
    
  } catch (error) {
    logger.error('Integration validation error', {
      error: error.message,
      tenantId
    });
    
    res.status(500).json({ 
      error: 'Validation failed',
      message: error.message
    });
  }
});

/**
 * Test Genesys Cloud connectivity
 */
async function testGenesysConnection({ clientId, clientSecret, region }) {
  try {
    // Attempt to get organization info via Genesys API
    const tokenResponse = await axios.post(
      `https://login.${region}.pure.cloud/oauth/token`,
      {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      },
      { timeout: 10000 }
    );
    
    const accessToken = tokenResponse.data.access_token;
    
    // Verify API access
    const orgResponse = await axios.get(
      `https://api.${region}.pure.cloud/api/v2/organizations/me`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        timeout: 5000
      }
    );
    
    return {
      success: true,
      message: `Connected to ${orgResponse.data.name}`,
      organizationId: orgResponse.data.id
    };
    
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message
    };
  }
}

/**
 * Test WhatsApp Business API connectivity
 */
async function testWhatsAppConnection({ phoneNumberId, systemUserToken }) {
  try {
    // Retrieve phone number info
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${phoneNumberId}`,
      {
        headers: {
          Authorization: `Bearer ${systemUserToken}`
        },
        params: {
          fields: 'id,display_phone_number,verified_name,quality_rating,messaging_limit_tier'
        },
        timeout: 10000
      }
    );
    
    return {
      success: true,
      message: `Connected to ${response.data.display_phone_number}`,
      phoneNumber: response.data.display_phone_number,
      verifiedName: response.data.verified_name,
      qualityRating: response.data.quality_rating
    };
    
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.error?.message || error.message
    };
  }
}
```

## 6.6 Step 5: Webhook Setup & Completion

**Purpose**: Generate webhook URLs and finalize configuration

**Endpoint**: `POST /api/v1/onboarding/complete`

**Implementation**:
```javascript
router.post('/onboarding/complete', requireAuth, async (req, res) => {
  const { tenantId } = req.body;
  const { userId } = req.session;
  
  try {
    // 1. Retrieve final onboarding state
    const state = await redis.getOnboardingState(tenantId);
    
    if (!state) {
      return res.status(400).json({ 
        error: 'Onboarding session expired'
      });
    }
    
    if (state.step !== 3) {
      return res.status(400).json({ 
        error: 'Complete all previous steps first'
      });
    }
    
    // 2. Generate webhook URLs and secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    
    const webhooks = {
      genesys: `${process.env.BASE_URL}/webhooks/genesys/${tenantId}`,
      meta: `${process.env.BASE_URL}/webhooks/meta/${tenantId}`,
      secret: webhookSecret,
      verifyToken: crypto.randomBytes(16).toString('hex')
    };
    
    logger.info('Generated webhook configuration', {
      tenantId,
      genesysUrl: webhooks.genesys,
      metaUrl: webhooks.meta
    });
    
    // 3. Decrypt credentials for persistence
    const genesysSecret = await decryptCredential(
      state.genesysConfig.clientSecret
    );
    const whatsappToken = await decryptCredential(
      state.whatsappConfig.systemUserToken
    );
    
    // 4. Persist complete configuration to Tenant Service
    await tenantService.updateTenant(tenantId, {
      genesysConfig: {
        clientId: state.genesysConfig.clientId,
        clientSecret: genesysSecret, // Tenant Service will re-encrypt
        region: state.genesysConfig.region
      },
      whatsappConfig: {
        phoneNumberId: state.whatsappConfig.phoneNumberId,
        systemUserToken: whatsappToken, // Tenant Service will re-encrypt
        phoneNumber: state.whatsappConfig.phoneNumber
      },
      webhooks,
      status: 'active',
      onboardedBy: userId,
      onboardedAt: new Date().toISOString()
    });
    
    logger.info('Tenant configuration persisted', {
      tenantId,
      status: 'active'
    });
    
    // 5. Clean up onboarding state from Redis
    await redis.deleteOnboardingState(tenantId);
    
    // 6. Return webhook URLs for manual configuration
    res.json({
      success: true,
      message: 'Onboarding completed successfully',
      tenantId,
      status: 'active',
      webhooks: {
        genesys: {
          url: webhooks.genesys,
          instructions: 'Configure this URL in Genesys Cloud > Admin > Integrations > Custom Webhooks'
        },
        meta: {
          url: webhooks.meta,
          verifyToken: webhooks.verifyToken,
          instructions: 'Configure this URL in Meta Business Suite > WhatsApp > Settings > Webhooks'
        },
        secret: webhooks.secret,
        note: 'Save the webhook secret securely - it will be used to verify incoming webhook requests'
      }
    });
    
  } catch (error) {
    logger.error('Onboarding completion failed', {
      error: error.message,
      tenantId,
      userId
    });
    
    res.status(500).json({ 
      error: 'Failed to complete onboarding',
      message: error.message
    });
  }
});
```

## 6.7 Resume Onboarding

**Purpose**: Allow users to continue incomplete onboarding

**Endpoint**: `GET /api/v1/onboarding/status/:tenantId`

**Implementation**:
```javascript
router.get('/onboarding/status/:tenantId', requireAuth, async (req, res) => {
  const { tenantId } = req.params;
  
  try {
    // Check onboarding state in Redis
    const state = await redis.getOnboardingState(tenantId);
    
    if (!state) {
      return res.status(404).json({ 
        error: 'No active onboarding session',
        code: 'NOT_FOUND'
      });
    }
    
    // Return current state (without sensitive data)
    res.json({
      tenantId,
      currentStep: state.step,
      completedSteps: state.completedSteps,
      organizationDetails: state.organizationDetails,
      genesysConfigured: !!state.genesysConfig?.validated,
      whatsappConfigured: !!state.whatsappConfig?.validated,
      createdAt: state.createdAt,
      lastUpdated: state.lastUpdated
    });
    
  } catch (error) {
    logger.error('Failed to retrieve onboarding status', {
      error: error.message,
      tenantId
    });
    
    res.status(500).json({ error: 'Failed to retrieve status' });
  }
});
```

---

# 7. Dashboard & Metrics

## 7.1 Overview (REQ-PORTAL-03)

**Purpose**: Aggregate and display tenant-specific metrics

**Data Source**: State Manager (authoritative source)  
**Caching Strategy**: Cache-aside pattern with Redis (5-15 min TTL)  
**Refresh**: Manual refresh endpoint to clear cache

## 7.2 Get Dashboard Stats

**Endpoint**: `GET /api/v1/dashboard/stats`

**Query Parameters**:
```
period: 'today' | 'week' | 'month' (default: 'today')
```

**Response**:
```json
{
  "totalMessages": 1000,
  "sentCount": 950,
  "deliveredCount": 920,
  "readCount": 850,
  "failedCount": 30,
  "successRate": "92.0",
  "activeConversations": 45,
  "uniqueCustomers": 38,
  "period": "today",
  "lastUpdated": "2026-02-12T08:30:00Z"
}
```

**Implementation**:
```javascript
router.get('/dashboard/stats', requireAuth, async (req, res) => {
  const { tenantId } = req.session;
  const { period = 'today' } = req.query;
  
  // Validate period parameter
  const validPeriods = ['today', 'week', 'month'];
  if (!validPeriods.includes(period)) {
    return res.status(400).json({ 
      error: 'Invalid period',
      validValues: validPeriods
    });
  }
  
  try {
    // 1. Check cache first
    const cacheKey = `metrics:${tenantId}:${period}`;
    const cached = await redis.getCachedMetrics(tenantId, period);
    
    if (cached) {
      logger.debug('Metrics cache hit', {
        tenantId,
        period,
        cachedAt: cached.calculatedAt
      });
      
      return res.json(cached);
    }
    
    // 2. Cache miss - fetch from State Manager
    logger.info('Fetching metrics from State Manager', {
      tenantId,
      period
    });
    
    const rawMetrics = await stateManager.getMetrics(tenantId, period);
    
    // 3. Calculate aggregates
    const stats = {
      totalMessages: rawMetrics.totalMessages,
      sentCount: rawMetrics.sent,
      deliveredCount: rawMetrics.delivered,
      readCount: rawMetrics.read,
      failedCount: rawMetrics.failed,
      successRate: calculateSuccessRate(
        rawMetrics.delivered,
        rawMetrics.totalMessages
      ),
      activeConversations: rawMetrics.activeConversations,
      uniqueCustomers: rawMetrics.distinctWaIds,
      period,
      lastUpdated: new Date().toISOString()
    };
    
    // 4. Cache result
    await redis.cacheMetrics(tenantId, period, stats);
    
    logger.info('Metrics calculated and cached', {
      tenantId,
      period,
      totalMessages: stats.totalMessages,
      successRate: stats.successRate
    });
    
    res.json(stats);
    
  } catch (error) {
    logger.error('Dashboard stats error', {
      error: error.message,
      tenantId,
      period
    });
    
    // Return graceful error response
    res.status(500).json({ 
      error: 'Failed to retrieve dashboard stats',
      message: 'Unable to fetch metrics at this time'
    });
  }
});

/**
 * Calculate success rate percentage
 */
function calculateSuccessRate(delivered, total) {
  if (total === 0) return "0.0";
  
  const rate = (delivered / total) * 100;
  return rate.toFixed(1); // One decimal place
}
```

## 7.3 Manual Refresh

**Endpoint**: `POST /api/v1/dashboard/refresh`

**Purpose**: Clear cached metrics to force fresh data fetch

**Implementation**:
```javascript
router.post('/dashboard/refresh', requireAuth, async (req, res) => {
  const { tenantId } = req.session;
  
  try {
    // Clear all metric caches for this tenant
    await redis.clearMetricsCache(tenantId);
    
    logger.info('Metrics cache cleared', {
      tenantId,
      triggeredBy: req.userId
    });
    
    res.json({ 
      success: true,
      message: 'Cache cleared. Next request will fetch fresh data.'
    });
    
  } catch (error) {
    logger.error('Cache clear failed', {
      error: error.message,
      tenantId
    });
    
    res.status(500).json({ 
      error: 'Failed to clear cache'
    });
  }
});
```

## 7.4 Metrics by Date Range

**Endpoint**: `GET /api/v1/dashboard/metrics/range`

**Query Parameters**:
```
startDate: ISO date string (e.g., '2026-02-01')
endDate: ISO date string (e.g., '2026-02-12')
```

**Implementation**:
```javascript
router.get('/dashboard/metrics/range', requireAuth, async (req, res) => {
  const { tenantId } = req.session;
  const { startDate, endDate } = req.query;
  
  try {
    // Validate dates
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate required'
      });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use ISO 8601 (YYYY-MM-DD)'
      });
    }
    
    if (start > end) {
      return res.status(400).json({ 
        error: 'startDate must be before endDate'
      });
    }
    
    // Fetch from State Manager
    const metrics = await stateManager.getMetrics(tenantId, {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    });
    
    res.json({
      tenantId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      metrics
    });
    
  } catch (error) {
    logger.error('Date range metrics error', {
      error: error.message,
      tenantId
    });
    
    res.status(500).json({ 
      error: 'Failed to retrieve metrics'
    });
  }
});
```

---

# 8. Conversation Management

## 8.1 List Conversations (REQ-PORTAL-04)

**Endpoint**: `GET /api/v1/history/threads`

**Query Parameters**:
```
page: number (default: 1)
limit: number (default: 20, max: 100)
status: 'active' | 'closed' (optional)
```

**Response**:
```json
{
  "data": [
    {
      "wa_id": "1234567890",
      "conversation_id": "conv_uuid",
      "last_activity": "2026-02-12T08:25:00Z",
      "status": "active",
      "message_count": 15
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Implementation**:
```javascript
router.get('/history/threads', requireAuth, async (req, res) => {
  const { tenantId } = req.session;
  const { 
    page = 1, 
    limit = 20, 
    status 
  } = req.query;
  
  try {
    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (pageNum < 1) {
      return res.status(400).json({ 
        error: 'page must be >= 1'
      });
    }
    
    if (limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ 
        error: 'limit must be between 1 and 100'
      });
    }
    
    // Validate status filter
    if (status && !['active', 'closed'].includes(status)) {
      return res.status(400).json({ 
        error: 'status must be "active" or "closed"'
      });
    }
    
    // Check cache
    const cacheKey = `conversations:${tenantId}:${pageNum}:${limitNum}:${status || 'all'}`;
    // Note: Simplified - actual implementation would check Redis
    
    // Fetch from State Manager
    logger.info('Fetching conversations', {
      tenantId,
      page: pageNum,
      limit: limitNum,
      status
    });
    
    const threads = await stateManager.getConversations(tenantId, {
      page: pageNum,
      limit: limitNum,
      ...(status && { status })
    });
    
    // Format response
    const response = {
      data: threads.data.map(thread => ({
        wa_id: thread.wa_id,
        conversation_id: thread.conversation_id,
        last_activity: thread.last_activity,
        status: thread.status,
        message_count: thread.message_count
      })),
      pagination: {
        page: threads.page,
        limit: threads.limit,
        total: threads.total,
        totalPages: Math.ceil(threads.total / threads.limit)
      }
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Failed to fetch conversations', {
      error: error.message,
      tenantId
    });
    
    res.status(500).json({ 
      error: 'Failed to retrieve conversations'
    });
  }
});
```

## 8.2 Get Conversation Messages

**Endpoint**: `GET /api/v1/history/threads/:id/messages`

**Response**:
```json
{
  "conversation_id": "conv_uuid",
  "wa_id": "1234567890",
  "messages": [
    {
      "message_id": "msg_uuid",
      "direction": "inbound",
      "text": "Hello, I need help",
      "media_url": null,
      "status": "read",
      "timestamp": "2026-02-12T08:20:00Z",
      "error": null
    }
  ]
}
```

**Implementation**:
```javascript
router.get('/history/threads/:id/messages', requireAuth, async (req, res) => {
  const { tenantId } = req.session;
  const { id: conversationId } = req.params;
  
  try {
    // 1. Verify conversation belongs to tenant
    const conversation = await stateManager.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ 
        error: 'Conversation not found',
        code: 'NOT_FOUND'
      });
    }
    
    if (conversation.tenant_id !== tenantId) {
      logger.warn('Tenant isolation violation attempt', {
        tenantId,
        conversationTenantId: conversation.tenant_id,
        conversationId
      });
      
      return res.status(403).json({ 
        error: 'Access denied',
        code: 'TENANT_MISMATCH'
      });
    }
    
    // 2. Fetch messages
    logger.info('Fetching conversation messages', {
      tenantId,
      conversationId,
      waId: conversation.wa_id
    });
    
    const messages = await stateManager.getMessages(conversationId);
    
    // 3. Format response
    const response = {
      conversation_id: conversationId,
      wa_id: conversation.wa_id,
      messages: messages.map(msg => ({
        message_id: msg.message_id,
        direction: msg.direction,
        text: msg.text,
        media_url: msg.media_url || null,
        status: msg.status,
        timestamp: msg.timestamp,
        error: msg.error || null
      }))
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Failed to fetch messages', {
      error: error.message,
      tenantId,
      conversationId
    });
    
    res.status(500).json({ 
      error: 'Failed to retrieve messages'
    });
  }
});
```

---

# 9. Agent Widget Integration

## 9.1 Overview (REQ-PORTAL-05)

**Purpose**: Support embedded Agent Interaction Widget in Genesys

**Responsibilities**:
- Validate conversation ownership
- Provide fallback message send endpoint
- Confirm tenant context

## 9.2 Widget Message Send

**Endpoint**: `POST /api/v1/widget/send`

**Request Body**:
```json
{
  "conversationId": "conv_uuid",
  "text": "Agent response message",
  "mediaUrl": "https://example.com/image.jpg" // optional
}
```

**Implementation**:
```javascript
router.post('/widget/send', requireAuth, async (req, res) => {
  const { tenantId, userId } = req.session;
  const { conversationId, text, mediaUrl } = req.body;
  
  try {
    // 1. Validate input
    if (!conversationId || !text) {
      return res.status(400).json({ 
        error: 'conversationId and text required'
      });
    }
    
    if (text.length > 4096) {
      return res.status(400).json({ 
        error: 'text must be <= 4096 characters'
      });
    }
    
    // 2. Verify conversation belongs to tenant
    const conversation = await stateManager.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ 
        error: 'Conversation not found'
      });
    }
    
    if (conversation.tenant_id !== tenantId) {
      logger.warn('Widget send - tenant mismatch', {
        tenantId,
        conversationTenantId: conversation.tenant_id,
        userId
      });
      
      return res.status(403).json({ 
        error: 'Access denied'
      });
    }
    
    // 3. Generate message ID
    const messageId = `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    // 4. Publish to outbound message queue
    const messagePayload = {
      message_id: messageId,
      tenant_id: tenantId,
      conversation_id: conversationId,
      wa_id: conversation.wa_id,
      text,
      ...(mediaUrl && { media_url: mediaUrl }),
      source: 'widget',
      agent_id: userId,
      timestamp: new Date().toISOString()
    };
    
    await messageBus.publish('outbound.message', messagePayload);
    
    logger.info('Widget message queued', {
      messageId,
      conversationId,
      tenantId,
      agentId: userId
    });
    
    res.json({
      success: true,
      message_id: messageId,
      status: 'queued',
      queued_at: messagePayload.timestamp
    });
    
  } catch (error) {
    logger.error('Widget send error', {
      error: error.message,
      conversationId,
      tenantId
    });
    
    res.status(500).json({ 
      error: 'Failed to send message'
    });
  }
});

// Message Bus Client (simplified)
class MessageBusClient {
  async publish(topic, message) {
    // Implementation depends on message broker (RabbitMQ, Kafka, etc.)
    // This is a placeholder
    logger.debug('Publishing message', { topic, messageId: message.message_id });
  }
}

const messageBus = new MessageBusClient();
```

---

# 10. Real-time Monitoring

## 10.1 Overview (REQ-PORTAL-05)

**Purpose**: Stream live message updates via WebSocket

**Technology**: Socket.IO  
**Namespace Pattern**: `/tenant/{tenantId}/portal`  
**Events**: `message_update`, `status_update`

## 10.2 WebSocket Server Setup

```javascript
const { Server } = require('socket.io');
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  }
});

// Dynamic namespace for each tenant
io.of(/^\/tenant\/[\w-]+\/portal$/).use(async (socket, next) => {
  // 1. Authenticate WebSocket connection
  const sessionId = socket.handshake.auth.sessionId;
  
  if (!sessionId) {
    return next(new Error('Authentication required'));
  }
  
  // 2. Validate session
  const sessionData = await redis.getSession(sessionId);
  
  if (!sessionData) {
    return next(new Error('Invalid or expired session'));
  }
  
  // 3. Extract tenant ID from namespace
  const namespacePath = socket.nsp.name; // e.g., "/tenant/123/portal"
  const namespaceTenantId = namespacePath.split('/')[2];
  
  // 4. Verify tenant match
  if (namespaceTenantId !== sessionData.tenantId) {
    logger.warn('WebSocket tenant mismatch', {
      namespaceTenant: namespaceTenantId,
      sessionTenant: sessionData.tenantId,
      userId: sessionData.userId
    });
    
    return next(new Error('Access denied - tenant mismatch'));
  }
  
  // 5. Attach session to socket
  socket.session = sessionData;
  socket.tenantId = sessionData.tenantId;
  
  logger.info('WebSocket authenticated', {
    tenantId: socket.tenantId,
    userId: socket.session.userId,
    socketId: socket.id
  });
  
  next();
});

// Handle connections
io.of(/^\/tenant\/[\w-]+\/portal$/).on('connection', (socket) => {
  const { tenantId, session } = socket;
  
  logger.info('Portal monitoring connected', {
    tenantId,
    userId: session.userId,
    socketId: socket.id
  });
  
  // Subscribe to message bus for this tenant
  const messageSubscription = messageBus.subscribe(
    `tenant.${tenantId}.messages`,
    (message) => {
      socket.emit('message_update', {
        type: message.direction,
        conversation_id: message.conversation_id,
        message_id: message.message_id,
        text: message.text,
        status: message.status,
        timestamp: message.timestamp
      });
    }
  );
  
  // Subscribe to status updates
  const statusSubscription = messageBus.subscribe(
    `tenant.${tenantId}.status`,
    (update) => {
      socket.emit('status_update', {
        message_id: update.message_id,
        status: update.status,
        timestamp: update.timestamp
      });
    }
  );
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    logger.info('Portal monitoring disconnected', {
      tenantId,
      userId: session.userId,
      socketId: socket.id,
      reason
    });
    
    // Clean up subscriptions
    messageSubscription.unsubscribe();
    statusSubscription.unsubscribe();
  });
  
  // Handle errors
  socket.on('error', (error) => {
    logger.error('WebSocket error', {
      tenantId,
      error: error.message,
      socketId: socket.id
    });
  });
});
```

## 10.3 Frontend WebSocket Client Example

```javascript
// Frontend connection example
import io from 'socket.io-client';

// Get session ID from cookie
const sessionId = getCookie('sessionId');
const tenantId = getCurrentTenantId();

// Connect to tenant-specific namespace
const socket = io(`wss://api.example.com/tenant/${tenantId}/portal`, {
  auth: {
    sessionId: sessionId
  },
  transports: ['websocket', 'polling']
});

// Listen for message updates
socket.on('message_update', (data) => {
  console.log('New message:', data);
  
  // Update UI
  if (data.type === 'inbound') {
    addInboundMessage(data);
  } else {
    addOutboundMessage(data);
  }
});

// Listen for status updates
socket.on('status_update', (data) => {
  console.log('Status update:', data);
  
  // Update message status in UI
  updateMessageStatus(data.message_id, data.status);
});

// Handle connection events
socket.on('connect', () => {
  console.log('Connected to monitoring service');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
```

---

# 11. API Specification

## 11.1 Complete Endpoint List

### Authentication Endpoints

```
GET  /api/v1/auth/login          Initiate Genesys SSO
GET  /api/v1/auth/callback       OAuth callback handler
POST /api/v1/auth/refresh        Refresh access token
POST /api/v1/auth/logout         End session
```

### Onboarding Endpoints

```
POST /api/v1/onboarding/step1    Organization details
POST /api/v1/onboarding/step2    Genesys configuration
POST /api/v1/onboarding/step3    WhatsApp configuration
GET  /api/v1/onboarding/validate Test integrations
POST /api/v1/onboarding/complete Finalize & generate webhooks
GET  /api/v1/onboarding/status/:tenantId Resume onboarding
```

### Dashboard Endpoints

```
GET  /api/v1/dashboard/stats        Aggregated metrics
POST /api/v1/dashboard/refresh      Clear metric cache
GET  /api/v1/dashboard/metrics/range Metrics by date range
```

### History Endpoints

```
GET  /api/v1/history/threads              List conversations
GET  /api/v1/history/threads/:id/messages Fetch messages
```

### Widget Endpoints

```
POST /api/v1/widget/send          Fallback message send
```

### WebSocket Namespace

```
/tenant/:tenantId/portal          Real-time monitoring
```

## 11.2 Error Response Format

**Standard Error Response**:
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    // Optional additional context
  }
}
```

**Common Error Codes**:
```
NO_SESSION             - Session cookie missing
SESSION_EXPIRED        - Session expired or invalid
AUTH_ERROR             - Authentication service error
TENANT_MISMATCH        - Tenant isolation violation
VALIDATION_FAILED      - Input validation failed
NOT_FOUND              - Resource not found
RATE_LIMIT_EXCEEDED    - Too many requests
INTERNAL_ERROR         - Unexpected server error
```

---

# 12. Security Implementation

## 12.1 Security Checklist

```javascript
const SECURITY_REQUIREMENTS = {
  // 1. Session Security
  session: {
    httpOnly: true,              // âœ… Prevent XSS
    secure: true,                // âœ… HTTPS only
    sameSite: 'strict',          // âœ… CSRF protection
    signed: true,                // âœ… Cookie signing
    maxAge: 86400000             // âœ… 24 hour expiration
  },
  
  // 2. CSRF Protection
  csrf: {
    enabled: true,
    tokenLength: 32,
    headerName: 'X-CSRF-Token'
  },
  
  // 3. Rate Limiting
  rateLimit: {
    onboarding: {
      windowMs: 15 * 60 * 1000,  // 15 minutes
      max: 5                      // 5 attempts per window
    },
    api: {
      windowMs: 60 * 1000,        // 1 minute
      max: 100                    // 100 requests per window
    },
    auth: {
      windowMs: 15 * 60 * 1000,   // 15 minutes
      max: 10                     // 10 login attempts
    }
  },
  
  // 4. Encryption
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,                // 256 bits
    ivLength: 16,                 // 128 bits
    tagLength: 16                 // 128 bits
  },
  
  // 5. Headers
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'"
  }
};
```

## 12.2 Rate Limiting Implementation

```javascript
const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,           // 1 minute
  max: 100,                      // 100 requests per window
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,          // Return rate limit info in headers
  legacyHeaders: false
});

// Onboarding rate limiter (stricter)
const onboardingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,      // 15 minutes
  max: 5,                        // 5 requests per window
  skipSuccessfulRequests: true,  // Don't count successful requests
  message: {
    error: 'Too many onboarding attempts',
    code: 'ONBOARDING_RATE_LIMIT',
    retryAfter: '15 minutes'
  }
});

// Auth rate limiter (strictest)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,      // 15 minutes
  max: 10,                       // 10 attempts per window
  skipSuccessfulRequests: false, // Count all attempts
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMIT',
    retryAfter: '15 minutes'
  }
});

// Apply to routes
app.use('/api/v1', apiLimiter);
app.use('/api/v1/onboarding', onboardingLimiter);
app.use('/api/v1/auth', authLimiter);
```

## 12.3 Input Validation

```javascript
const Joi = require('joi');

// Validation schemas
const schemas = {
  onboardingStep1: Joi.object({
    companyName: Joi.string().min(2).max(100).required(),
    region: Joi.string().valid(
      'us-east-1', 'us-east-2', 'us-west-2',
      'eu-west-1', 'eu-central-1',
      'ap-southeast-2', 'ap-northeast-1'
    ).required(),
    contactEmail: Joi.string().email().required()
  }),
  
  onboardingStep2: Joi.object({
    tenantId: Joi.string().uuid().required(),
    clientId: Joi.string().min(10).max(100).required(),
    clientSecret: Joi.string().min(10).max(200).required(),
    region: Joi.string().required()
  }),
  
  widgetSend: Joi.object({
    conversationId: Joi.string().uuid().required(),
    text: Joi.string().min(1).max(4096).required(),
    mediaUrl: Joi.string().uri().optional()
  })
};

// Validation middleware
function validateRequest(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }
    
    // Replace body with validated/sanitized value
    req.body = value;
    next();
  };
}

// Usage
router.post('/onboarding/step1', 
  requireAuth,
  validateRequest(schemas.onboardingStep1),
  async (req, res) => {
    // req.body is now validated and sanitized
    // ...
  }
);
```

## 12.4 Security Headers

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.ALLOWED_WEBSOCKET_ORIGIN]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  noSniff: true,
  xssFilter: true
}));
```

---

# 13. Performance & Scalability

## 13.1 Caching Strategy

```javascript
const CACHE_CONFIG = {
  // TTL values in seconds
  ttl: {
    session: 86400,        // 24 hours
    metrics: 600,          // 10 minutes
    conversations: 300,    // 5 minutes
    onboarding: 3600       // 1 hour
  },
  
  // Cache invalidation triggers
  invalidate: {
    metrics: [
      'message.sent',
      'message.delivered',
      'message.failed'
    ],
    conversations: [
      'conversation.created',
      'conversation.closed',
      'message.received'
    ]
  }
};

// Cache invalidation on events
messageBus.subscribe('message.sent', async (event) => {
  const { tenantId } = event;
  await redis.clearMetricsCache(tenantId);
});
```

## 13.2 Pagination

```javascript
const PAGINATION_CONFIG = {
  defaultLimit: 20,
  maxLimit: 100,
  defaultPage: 1
};

function paginateQuery(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(
    PAGINATION_CONFIG.maxLimit,
    Math.max(1, parseInt(req.query.limit) || PAGINATION_CONFIG.defaultLimit)
  );
  
  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
}

function paginateResponse(data, total, page, limit) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  };
}
```

## 13.3 Circuit Breaker

```javascript
const CircuitBreaker = require('opossum');

// Circuit breaker for State Manager
const stateManagerBreaker = new CircuitBreaker(
  async (tenantId, options) => {
    return await stateManager.getMetrics(tenantId, options);
  },
  {
    timeout: 5000,          // 5 second timeout
    errorThresholdPercentage: 50,  // Open after 50% failures
    resetTimeout: 30000,    // Try again after 30 seconds
    fallback: (tenantId) => {
      logger.warn('State Manager circuit open, using fallback', { tenantId });
      return {
        totalMessages: 0,
        error: 'Service temporarily unavailable'
      };
    }
  }
);

// Usage
router.get('/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const metrics = await stateManagerBreaker.fire(
      req.tenantId,
      { period: req.query.period }
    );
    res.json(metrics);
  } catch (error) {
    res.status(503).json({ 
      error: 'Service temporarily unavailable'
    });
  }
});
```

---

# 14. Error Handling & Resilience

## 14.1 Global Error Handler

```javascript
// Error handler middleware (must be last)
function errorHandler(err, req, res, next) {
  const correlationId = req.id;
  
  // Log error with context
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    tenantId: req.session?.tenantId,
    userId: req.session?.userId,
    correlationId
  });
  
  // Don't expose internal errors to client
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      correlationId
    });
  }
  
  // Generic error response
  res.status(500).json({
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    correlationId
  });
}

// Custom API Error class
class ApiError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Usage
throw new ApiError(404, 'Conversation not found', 'NOT_FOUND');
```

## 14.2 Retry Logic

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      
      logger.warn('Retry attempt', {
        attempt,
        maxRetries,
        delay,
        error: error.message
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Usage
const metrics = await retryWithBackoff(async () => {
  return await stateManager.getMetrics(tenantId, period);
});
```

---

# 15. Observability

## 15.1 Logging

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'agent-portal-service',
    environment: process.env.NODE_ENV
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Structured logging
logger.info('Session created', {
  sessionId: 'sess_abc',
  userId: 'user_123',
  tenantId: 'tenant_456',
  correlationId: req.id
});
```

## 15.2 Metrics (Prometheus)

```javascript
const promClient = require('prom-client');

// Register default metrics
promClient.collectDefaultMetrics();

// Custom metrics
const metrics = {
  activeSessions: new promClient.Gauge({
    name: 'portal_active_sessions_total',
    help: 'Number of active user sessions'
  }),
  
  apiLatency: new promClient.Histogram({
    name: 'portal_api_latency_seconds',
    help: 'API endpoint latency',
    labelNames: ['method', 'path', 'status']
  }),
  
  onboardingCompletions: new promClient.Counter({
    name: 'portal_onboarding_completions_total',
    help: 'Number of completed onboardings',
    labelNames: ['status']
  }),
  
  cacheHits: new promClient.Counter({
    name: 'portal_cache_hits_total',
    help: 'Cache hit/miss count',
    labelNames: ['cache_type', 'result']
  })
};

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// Usage in code
const end = metrics.apiLatency.startTimer();
// ... do work ...
end({ method: req.method, path: req.path, status: res.statusCode });
```

---

# 16. Implementation Guide

## 16.1 Project Structure

```
agent-portal-service/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ controllers/
â”‚   â”‚   â”œâ”€â”€ auth.controller.js
â”‚   â”‚   â”œâ”€â”€ onboarding.controller.js
â”‚   â”‚   â”œâ”€â”€ dashboard.controller.js
â”‚   â”‚   â”œâ”€â”€ history.controller.js
â”‚   â”‚   â””â”€â”€ widget.controller.js
â”‚   â”œâ”€â”€ middleware/
â”‚   â”‚   â”œâ”€â”€ auth.middleware.js
â”‚   â”‚   â”œâ”€â”€ validation.middleware.js
â”‚   â”‚   â”œâ”€â”€ rateLimit.middleware.js
â”‚   â”‚   â””â”€â”€ errorHandler.middleware.js
â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”œâ”€â”€ authService.client.js
â”‚   â”‚   â”œâ”€â”€ tenantService.client.js
â”‚   â”‚   â”œâ”€â”€ stateManager.client.js
â”‚   â”‚   â””â”€â”€ redis.client.js
â”‚   â”œâ”€â”€ utils/
â”‚   â”‚   â”œâ”€â”€ encryption.js
â”‚   â”‚   â”œâ”€â”€ validation.js
â”‚   â”‚   â””â”€â”€ logger.js
â”‚   â”œâ”€â”€ websocket/
â”‚   â”‚   â””â”€â”€ monitoring.namespace.js
â”‚   â”œâ”€â”€ routes/
â”‚   â”‚   â””â”€â”€ index.js
â”‚   â””â”€â”€ server.js
â”œâ”€â”€ config/
â”‚   â”œâ”€â”€ default.js
â”‚   â”œâ”€â”€ production.js
â”‚   â””â”€â”€ test.js
â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ unit/
â”‚   â”œâ”€â”€ integration/
â”‚   â””â”€â”€ e2e/
â”œâ”€â”€ .env.example
â”œâ”€â”€ .gitignore
â”œâ”€â”€ package.json
â”œâ”€â”€ README.md
â””â”€â”€ Dockerfile
```

## 16.2 Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3000
BASE_URL=https://api.example.com

# Genesys OAuth
GENESYS_CLIENT_ID=your_client_id
GENESYS_REDIRECT_URI=https://api.example.com/api/v1/auth/callback

# Service URLs
AUTH_SERVICE_URL=http://auth-service:8080
TENANT_SERVICE_URL=http://tenant-service:8080
STATE_MANAGER_URL=http://state-manager:8080

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# Security
ENCRYPTION_KEY=your_256_bit_hex_key
COOKIE_SECRET=your_cookie_secret
COOKIE_DOMAIN=.example.com

# Logging
LOG_LEVEL=info

# Frontend
FRONTEND_URL=https://portal.example.com
```

## 16.3 Deployment Checklist

- [ ] Environment variables configured
- [ ] Redis connection established
- [ ] Service endpoints verified
- [ ] HTTPS/TLS certificates installed
- [ ] Rate limiting enabled
- [ ] CORS configured correctly
- [ ] Security headers enabled
- [ ] Logging configured
- [ ] Metrics endpoint exposed
- [ ] Health check endpoint responding
- [ ] Horizontal scaling tested
- [ ] Circuit breakers configured
- [ ] Session persistence verified
- [ ] WebSocket connections tested

---

## Appendix A: Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env

# Run database migrations (if any)
npm run migrate

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

## Appendix B: Health Check Endpoint

```javascript
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };
  
  // Check Redis
  try {
    await redis.client.ping();
    health.checks.redis = 'ok';
  } catch (error) {
    health.checks.redis = 'error';
    health.status = 'degraded';
  }
  
  // Check Auth Service
  try {
    await axios.get(`${AUTH_SERVICE_URL}/health`, { timeout: 2000 });
    health.checks.authService = 'ok';
  } catch (error) {
    health.checks.authService = 'error';
    health.status = 'degraded';
  }
  
  // Check Tenant Service
  try {
    await axios.get(`${TENANT_SERVICE_URL}/health`, { timeout: 2000 });
    health.checks.tenantService = 'ok';
  } catch (error) {
    health.checks.tenantService = 'error';
    health.status = 'degraded';
  }
  
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

---

**Document Version**: 2.0 (Enhanced for Claude Code)  
**Optimized For**: Complete implementation, code generation, system understanding  
**Total Sections**: 16 major sections with complete code examples  
**Lines of Code**: 2000+ lines of production-ready implementations