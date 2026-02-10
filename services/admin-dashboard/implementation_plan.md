# Admin Dashboard - Implementation Plan

## Goal

Build a comprehensive administrative dashboard for monitoring message flows, conversation states, service health, tenant management, and analytics with real-time updates.

## Phased Implementation

### Phase 1: Real-time Monitoring (Priority: HIGH)
**Duration**: 2 weeks

#### 1.1 WebSocket Integration
- **Files**:
  - `src/services/socketService.ts` - Socket.IO client
  - `src/hooks/useMetrics.ts` - Real-time metrics hook

- **Metrics to Track**:
  - Active conversations count
  - Messages per minute (inbound/outbound)
  - Queue depths (RabbitMQ)
  - Error rates by service

#### 1.2 Message Flow Monitoring
- **Files**:
  - `src/components/MessageFlowDashboard.tsx` - Flow visualization
  - `src/services/metricsService.ts` - Metrics API client

- **Display**:
  - Inbound message queue status
  - Outbound message queue status
  - Transformation success/failure rates
  - Webhook delivery status

---

### Phase 2: Service Health Monitoring (Priority: HIGH)
**Duration**: 1.5 weeks

#### 2.1 Health Check Dashboard
- **Files**:
  - `src/components/ServiceHealthDashboard.tsx` - Health display
  - `src/services/healthCheckService.ts` - Health check API

- **Services to Monitor**:
  - API Gateway status
  - Auth Service status
  - State Manager status
  - WhatsApp API connectivity
  - Genesys API connectivity
  - Redis connection
  - RabbitMQ connection
  - PostgreSQL connection

#### 2.2 Alert Integration
- **Files**:
  - `src/components/AlertPanel.tsx` - Alert display

- **Alerts**:
  - Service down notifications
  - Error rate thresholds exceeded
  - Queue depth warnings
  - Rate limit approaching

---

### Phase 3: Analytics & Reporting (Priority: MEDIUM)
**Duration**: 2 weeks

#### 3.1 Analytics Dashboard
- **Files**:
  - `src/components/AnalyticsDashboard.tsx` - Analytics display
  - `src/services/analyticsService.ts` - Analytics API

- **Metrics**:
  - Message volume trends (daily, weekly)
  - Average response time
  - Conversation duration
  - Template usage statistics
  - Error rate trends

#### 3.2 Charts & Visualizations
- **Files**:
  - `src/components/charts/` - Chart components

- **Libraries**: Recharts or Chart.js
- **Charts**:
  - Line charts for trends
  - Bar charts for comparisons
  - Pie charts for distributions

---

### Phase 4: Tenant Management (Priority: MEDIUM)
**Duration**: 1.5 weeks

#### 4.1 Tenant Administration
- **Files**:
  - `src/components/TenantManagement.tsx` - Tenant UI
  - `src/services/tenantAdminService.ts` - Tenant API

- **Features**:
  - List all tenants
  - View tenant details and configurations
  - Monitor per-tenant message quotas
  - View tenant-specific health
  - Configure tenant settings

---

### Phase 5: Configuration Management (Priority: LOW)
**Duration**: 1 week

#### 5.1 System Configuration
- **Files**:
  - `src/components/ConfigurationPanel.tsx` - Config UI

- **Configurable Items**:
  - Rate limits
  - Queue thresholds
  - Alert thresholds
  - Retention policies

---

## Dependencies

```json
{
  "react": "^18.2.0",
  "socket.io-client": "^4.6.1",
  "recharts": "^2.10.0",
  "axios": "^1.6.2",
  "react-router-dom": "^6.20.0",
  "tailwindcss": "^3.3.5"
}
```

---

## Verification Plan

### Unit Tests
- Component rendering
- Metrics calculation
- API integration

### Manual Testing
1. View message flow → verify real-time updates
2. Check service health → verify statuses accurate
3. View analytics → verify charts correct
4. Test alerts → verify notifications appear

---

## Rollback Strategy
- Feature flags for new dashboards
- Keep existing monitoring during migration
