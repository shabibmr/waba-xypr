# 02 — Dashboard & Metrics

> **FRD Reference:** Section 5 (Dashboard & Metrics), Lines 1600-1900
> **Priority:** 🔴 High — MVP Phase 1

---

## Gap Summary

| Feature | FRD | Code | Gap |
|---------|-----|------|-----|
| `GET /dashboard/stats` (aggregated) | ✅ | ✅ | Implemented in `dashboardController` |
| `GET /dashboard/metrics?range=` | ✅ | ✅ | Implemented in `dashboardController` |
| `POST /dashboard/refresh` (manual cache refresh) | ✅ | ✅ | Implemented in `dashboardController` |
| Redis caching for stats (TTL 5 min) | ✅ | ✅ | Implemented in `dashboardCache` |
| Data aggregation from State Manager | ✅ | ✅ | Logic exists (mocked or proxied) |
| Date range filtering | ✅ | ✅ | Logic exists in `getMetrics` |

---

## Tasks

### T02.1 — Create Dashboard Controller
- [x] **File:** `src/controllers/dashboardController.js` (NEW)
- [x] **What:** Aggregate data from State Manager for tenant-scoped stats:
  - Total conversations, active/waiting, messages today, avg response time
- [x] **Depends on:** State Manager API availability

### T02.2 — Create Dashboard Routes
- [x] **File:** `src/routes/dashboardRoutes.js` (NEW)
- [x] **Endpoints:**
  - `GET /api/portal/dashboard/stats`
  - `GET /api/portal/dashboard/metrics`
  - `POST /api/portal/dashboard/refresh`
- [x] **Mount in:** `src/index.js`

### T02.3 — Redis Dashboard Cache Service
- [x] **File:** `src/services/dashboardCache.js` (NEW)
- [x] **What:** Cache-aside pattern with 5-min TTL for dashboard stats
- [x] **Key pattern:** `dashboard:stats:{tenantId}`

### T02.4 — Date Range Metrics Aggregation
- [x] **File:** `src/controllers/dashboardController.js`
- [x] **What:** Support `?from=` and `?to=` query params for metrics endpoint
- [x] **Depends on:** State Manager providing date-filtered queries

### T02.5 — Wire Dashboard Routes in `index.js`
- [x] **File:** `src/index.js` (MODIFY)
- [x] **What:** Import and mount dashboard routes

### T02.6 — Dashboard Joi Schemas
- [x] **File:** `src/middleware/validation/dashboard.schema.js` (NEW)
- [x] **What:** Validate query params (date range format, pagination)
- [x] **Depends on:** T08.1
